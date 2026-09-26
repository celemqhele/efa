export interface AggregateScore {
  home: number
  away: number
}

export interface SiblingData {
  fixture: any
  result: any
}

export function getSiblingMatchday(matchday: number): number | null {
  const leg2Matchdays = [111, 112, 113, 114, 211, 212]
  if (leg2Matchdays.includes(matchday)) return matchday - 10
  const leg1Matchdays = [101, 102, 103, 104, 201, 202]
  if (leg1Matchdays.includes(matchday)) return matchday + 10
  return null
}

export function isTwoLegKnockout(roundType: string, matchday: number): boolean {
  if (!['qf', 'sf'].includes(roundType)) return false
  return [101, 102, 103, 104, 111, 112, 113, 114, 201, 202, 211, 212].includes(matchday)
}

export function isLeg2(matchday: number): boolean {
  return [111, 112, 113, 114, 211, 212].includes(matchday)
}

export function isLeg1(matchday: number): boolean {
  return [101, 102, 103, 104, 201, 202].includes(matchday)
}

export async function fetchSiblingFixture(
  db: any,
  tournamentId: string,
  matchday: number,
  leg: number
): Promise<SiblingData | null> {
  const siblingMd = getSiblingMatchday(matchday)
  if (!siblingMd) return null

  const { data } = await db
    .from('fixtures')
    .select(`
      *,
      result:results(*)
    `)
    .eq('tournament_id', tournamentId)
    .eq('matchday', siblingMd)
    .maybeSingle()

  if (!data) return null

  const fixture = data
  const result = data.result?.[0] ?? data.result ?? null

  return { fixture, result }
}

export function computeAggregate(
  leg1Result: any,
  leg2Result: any
): AggregateScore | null {
  if (!leg1Result || !leg2Result) return null

  const leg1Home = leg1Result.home_score ?? 0
  const leg1Away = leg1Result.away_score ?? 0
  const leg2Home = leg2Result.home_score ?? 0
  const leg2Away = leg2Result.away_score ?? 0

  return {
    home: leg1Home + leg2Away,
    away: leg1Away + leg2Home,
  }
}

export function flipAggregate(agg: AggregateScore): AggregateScore {
  return { home: agg.away, away: agg.home }
}

export async function resolveTournamentGdLeader(
  db: any,
  tournamentId: string,
  teamA: string | null,
  teamB: string | null
): Promise<string | null> {
  if (!teamA || !teamB || teamA === teamB) return null

  const { data: fixtures } = await db
    .from('fixtures')
    .select('home_team_id, away_team_id, status, results!results_fixture_id_fkey(home_score, away_score, is_abandoned, abandoned_type, override_reason)')
    .eq('tournament_id', tournamentId)

  const gd = new Map<string, number>()
  const add = (teamId: string | null, delta: number) => {
    if (!teamId) return
    gd.set(teamId, (gd.get(teamId) ?? 0) + delta)
  }

  for (const f of fixtures ?? []) {
    if (f.status !== 'confirmed') continue
    const res = Array.isArray(f.results) ? f.results[0] : f.results
    if (!res) continue

    // Both-absent ties are scored 0-0 but the standings engine still applies a
    // -3 GD penalty per side (gd_penalty), so mirror that here for parity.
    const reason = String(res.override_reason ?? '').toLowerCase()
    const bothAbsent =
      (res.is_abandoned === true && res.abandoned_type === 'both') ||
      (reason.includes('both') && reason.includes('absent'))
    if (bothAbsent) {
      add(f.home_team_id, -3)
      add(f.away_team_id, -3)
      continue
    }

    const homeScore = res.home_score ?? 0
    const awayScore = res.away_score ?? 0
    add(f.home_team_id, homeScore - awayScore)
    add(f.away_team_id, awayScore - homeScore)
  }

  const gdA = gd.get(teamA) ?? 0
  const gdB = gd.get(teamB) ?? 0
  if (gdA === gdB) return null
  return gdA > gdB ? teamA : teamB
}

export function determineAggregateWinner(
  leg1Fixture: any,
  leg1Result: any,
  leg2Fixture: any,
  leg2Result: any
): string | null {
  const agg = computeAggregate(leg1Result, leg2Result)
  if (!agg) return null

  if (agg.home > agg.away) return leg1Fixture.home_team_id
  if (agg.away > agg.home) return leg1Fixture.away_team_id

  // Aggregate level — check pen scores on leg 2
  const penHome = leg2Result.pen_home_score
  const penAway = leg2Result.pen_away_score
  if (penHome != null && penAway != null) {
    if (penHome > penAway) return leg2Fixture.home_team_id
    if (penAway > penHome) return leg2Fixture.away_team_id
  }

  // Fallback: leg 2 result as tiebreaker
  if (leg2Result.home_score > leg2Result.away_score) return leg2Fixture.home_team_id
  if (leg2Result.away_score > leg2Result.home_score) return leg2Fixture.away_team_id

  return null
}
