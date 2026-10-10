// Applies active carry-over forfeit balances to a fixture result, mirroring the
// played-match path in app/api/submit-match/route.ts: every remaining balance of
// EITHER fixture manager is added to the correct side and consumed
// (remaining = 0, consumed_by_fixture_id = this fixture). If only one manager has
// a balance, only that one is applied.
//
// Used by the backdoor application writers (admin approve route + auto-finalise
// cron) so a backdoor decision (3-0 single claim or 0-0 both claim) absorbs the
// same carried-over scores a normally played match would.

export interface CarryOverContext {
  fixtureId: string
  homeManagerId: string | null
  awayManagerId: string | null
  homeTeamName: string
  awayTeamName: string
}

export interface CarryOverResult {
  homeScore: number
  awayScore: number
  noteLines: string[]
  appliedBalanceIds: string[]
}

export async function applyCarryOverBalances(
  db: any,
  ctx: CarryOverContext,
  baseHomeScore: number,
  baseAwayScore: number
): Promise<CarryOverResult> {
  let homeScore = baseHomeScore
  let awayScore = baseAwayScore
  const noteLines: string[] = []
  const appliedBalanceIds: string[] = []

  const managerIds = [ctx.homeManagerId, ctx.awayManagerId].filter((id): id is string => !!id)
  if (managerIds.length === 0) {
    return { homeScore, awayScore, noteLines, appliedBalanceIds }
  }

  // Re-open any balance this fixture already consumed (resubmission / admin
  // override of a result) so it is counted again below instead of being lost.
  await db
    .from('forfeit_balances')
    .update({ remaining: 1, consumed_by_fixture_id: null })
    .eq('consumed_by_fixture_id', ctx.fixtureId)

  const { data: balances } = await db
    .from('forfeit_balances')
    .select('id, forfeiting_score, opponent_score, forfeiting_manager_id, fixture_id')
    .in('forfeiting_manager_id', managerIds)
    .gt('remaining', 0)

  for (const bal of (balances ?? []) as any[]) {
    const forfeitingIsHome = bal.forfeiting_manager_id === ctx.homeManagerId
    const forfScore = bal.forfeiting_score ?? 0
    const oppScore = bal.opponent_score ?? 0
    if (forfeitingIsHome) {
      homeScore += forfScore
      awayScore += oppScore
    } else {
      awayScore += forfScore
      homeScore += oppScore
    }

    await db
      .from('forfeit_balances')
      .update({ remaining: 0, consumed_by_fixture_id: ctx.fixtureId })
      .eq('id', bal.id)
    appliedBalanceIds.push(bal.id)

    const forfeiterTeam = forfeitingIsHome ? ctx.homeTeamName : ctx.awayTeamName
    const winnerTeam = forfeitingIsHome ? ctx.awayTeamName : ctx.homeTeamName
    const baseDesc =
      baseHomeScore === baseAwayScore
        ? `${baseHomeScore}-${baseAwayScore} draw`
        : `${baseHomeScore}-${baseAwayScore} win`
    const noteSentence = `${forfeiterTeam} forfeited a match that ended in ${bal.opponent_score}-${bal.forfeiting_score}, so this ${baseDesc} became ${homeScore}-${awayScore} in favour of ${winnerTeam}.`
    noteLines.push(`forfeit_note:${bal.fixture_id}:${noteSentence}`)
  }

  return { homeScore, awayScore, noteLines, appliedBalanceIds }
}
