import { createAdminClient } from '@/lib/supabase/server'
import { getAppTodayKey } from '@/lib/app-time'
import { getSiblingMatchday, computeAggregate } from '@/lib/aggregate'
import Shell from './_shell'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function FixturesManagePage({
  searchParams,
}: {
  searchParams: any
}) {
  const supabase = await createAdminClient()

  const resolvedParams = searchParams && typeof searchParams.then === 'function'
    ? await searchParams
    : searchParams

  const todayKey = await getAppTodayKey(supabase)
  const selectedDate = resolvedParams?.date ?? todayKey
  const tournamentFilter: string | null = resolvedParams?.tournament ?? null

  let filterTournament: { id: string; name: string } | null = null
  if (tournamentFilter) {
    const { data: ft } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('id', tournamentFilter)
      .maybeSingle()
    if (ft) filterTournament = ft
  }

  let query = supabase
    .from('fixtures')
    .select(`
      id, matchday, round_type, scheduled_date, status, is_postponed, leg, tournament_id,
      tournament:tournaments(id, name, type),
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      result:results(home_score, away_score)
    `)
    .eq('scheduled_date', selectedDate)
    .order('scheduled_date', { ascending: true })

  if (filterTournament) {
    query = query.eq('tournament_id', filterTournament.id)
  }

  const { data: fixtures, error: fixturesError } = await query

  // Fetch sibling results for 2-leg knockout aggregate display
  const leg2Fixtures = (fixtures ?? []).filter(
    (f: any) => f.leg === 2 && ['qf', 'sf'].includes(f.round_type) && f.result?.[0]
  )
  if (leg2Fixtures.length > 0) {
    const siblingMds = leg2Fixtures.map((f: any) => f.matchday - 10)
    const { data: siblingFixtures } = await supabase
      .from('fixtures')
      .select('id, matchday, tournament_id, results(fixture_id, home_score, away_score)')
      .in('tournament_id', [...new Set(leg2Fixtures.map((f: any) => f.tournament_id))])
      .in('matchday', siblingMds)

    const siblingResultsByKey: Record<string, any> = {}
    for (const sf of siblingFixtures ?? []) {
      const key = `${sf.tournament_id}_${sf.matchday}`
      const r = Array.isArray(sf.results) ? sf.results[0] : sf.results
      siblingResultsByKey[key] = r
    }

    // Fetch penalty scores separately (column may not exist yet)
    const penScores: Record<string, { pen_home_score: number; pen_away_score: number }> = {}
    try {
      const fixtureIds = leg2Fixtures.map((f: any) => f.id)
      const { data: penRows } = await supabase
        .from('results')
        .select('fixture_id, pen_home_score, pen_away_score')
        .in('fixture_id', fixtureIds)
      for (const row of penRows ?? []) {
        penScores[row.fixture_id] = { pen_home_score: row.pen_home_score, pen_away_score: row.pen_away_score }
      }
    } catch {
      // pen scores not available — skip
    }

    for (const f of fixtures ?? []) {
      if (f.leg === 2 && ['qf', 'sf'].includes(f.round_type) && f.result?.[0]) {
        const leg1Key = `${f.tournament_id}_${f.matchday - 10}`
        const leg1Result = siblingResultsByKey[leg1Key]
        const leg2Result = Array.isArray(f.result) ? f.result[0] : f.result
        if (leg1Result && leg2Result) {
          const agg = computeAggregate(leg1Result, leg2Result)
          if (agg) (f as any)._aggregate = agg
        }
        const penScore = penScores[f.id]
        if (penScore && penScore.pen_home_score != null) {
          ;(f as any)._penScore = {
            home: penScore.pen_home_score,
            away: penScore.pen_away_score,
          }
        }
      }
    }
  }

  return <Shell data={{ fixtures: fixtures ?? [], todayKey, selectedDate, filterTournament, error: fixturesError?.message ?? null }} />
}
