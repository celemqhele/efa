// Removes the carry-over forfeit balance(s) that a fixture CREATED (because its
// result was submitted as a forfeit) and un-applies them from any later fixture
// that already consumed them.
//
// This is the counterpart of lib/forfeit-balance-apply.ts: that file APPLIES a
// carried-over balance to the next match, this one TAKES IT BACK when the source
// forfeit no longer stands (admin "Reset Result", or a corrected submission).
//
// Why it matters: a forfeit result inserts a forfeit_balances row with
// `fixture_id` = the match that produced it. Deleting the result on reset leaves
// that row behind, so the penalty keeps living on and gets added to the
// forfeiter's NEXT match. If that already happened, the later result is inflated
// and has to be trimmed back by the same amount.
//
// Only balances with `fixture_id = the given fixture` are touched - balances the
// fixture merely CONSUMED are left alone (the reset route re-opens those
// separately, because the match is going to be resubmitted).

export interface VoidedAdjustment {
  fixtureId: string
  homeScore: number
  awayScore: number
  tournamentId: string | null
}

export interface VoidCreatedResult {
  voided: number
  adjusted: VoidedAdjustment[]
  tournaments: string[]
}

function managerId(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.manager_id ?? null
  return t?.manager_id ?? null
}

export async function voidBalancesCreatedBy(db: any, fixtureId: string): Promise<VoidCreatedResult> {
  const { data: created, error } = await db
    .from('forfeit_balances')
    .select('id, fixture_id, forfeiting_manager_id, opponent_score, consumed_by_fixture_id')
    .eq('fixture_id', fixtureId)
  if (error) throw new Error(`forfeit_balances lookup failed: ${error.message}`)

  const balances = (created ?? []) as any[]
  const result: VoidCreatedResult = { voided: 0, adjusted: [], tournaments: [] }
  if (balances.length === 0) return result

  const tournamentIds = new Set<string>()

  for (const bal of balances) {
    const consumerId = bal.consumed_by_fixture_id ? String(bal.consumed_by_fixture_id) : null
    // A balance this fixture also consumed is just dropped with the rest.
    if (!consumerId || consumerId === String(fixtureId)) continue

    const { data: consumer } = await db
      .from('fixtures')
      .select(`
        id, tournament_id, home_team_id, away_team_id,
        home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
        away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id),
        results!results_fixture_id_fkey(home_score, away_score, override_reason)
      `)
      .eq('id', consumerId)
      .maybeSingle()
    if (!consumer) continue

    const resultRows = Array.isArray(consumer.results) ? consumer.results : consumer.results ? [consumer.results] : []
    const consumerResult = resultRows[0]
    if (!consumerResult) continue

    const goals = Number(bal.opponent_score ?? 0)
    const forfeitingIsHome = bal.forfeiting_manager_id === managerId(consumer.home_team)
    let homeScore = Number(consumerResult.home_score ?? 0)
    let awayScore = Number(consumerResult.away_score ?? 0)
    if (forfeitingIsHome) awayScore -= goals
    else homeScore -= goals
    homeScore = Math.max(0, homeScore)
    awayScore = Math.max(0, awayScore)

    // Drop the note line that cited this source match.
    const notePrefix = `forfeit_note:${bal.fixture_id}:`
    const keptNotes = String(consumerResult.override_reason ?? '')
      .split('\n')
      .filter((line: string) => line.trim() !== '' && !line.startsWith(notePrefix))
    const overrideReason = keptNotes.length > 0 ? keptNotes.join('\n') : null

    await db
      .from('results')
      .update({ home_score: homeScore, away_score: awayScore, override_reason: overrideReason })
      .eq('fixture_id', consumerId)

    if (consumer.tournament_id) tournamentIds.add(String(consumer.tournament_id))
    result.adjusted.push({
      fixtureId: consumerId,
      homeScore,
      awayScore,
      tournamentId: consumer.tournament_id ? String(consumer.tournament_id) : null,
    })

    await db.from('audit_log').insert({
      admin_id: null,
      action: 'forfeit_balance_voided',
      target_type: 'fixture',
      target_id: consumerId,
      details: {
        source_fixture_id: fixtureId,
        balance_id: bal.id,
        goals_removed: goals,
        home_score: homeScore,
        away_score: awayScore,
        reason: 'source forfeit result reset',
      },
    })
  }

  const { error: delErr } = await db.from('forfeit_balances').delete().eq('fixture_id', fixtureId)
  if (delErr) throw new Error(`forfeit_balances delete failed: ${delErr.message}`)
  result.voided = balances.length
  result.tournaments = [...tournamentIds]

  return result
}
