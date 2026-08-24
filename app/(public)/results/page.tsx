import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { computeAggregate, flipAggregate } from '@/lib/aggregate'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Results',
  description: 'Latest EFA match results — scores, scorers, and match reports.',
  openGraph: { title: 'Results | EFA', description: 'Latest EFA match results — scores, scorers, and match reports.' },
}

export default async function ResultsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const teams: any[] = []
  const teamIds: string[] = []
  let fixturesWithResults: any[] = []
  let primaryTeam: any = null
  let wins = 0, draws = 0, losses = 0

  if (user) {
    const { data: _userTeams } = await supabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug')
      .eq('manager_id', user.id)
    const userTeams = (_userTeams ?? []) as any[]
    teams.push(...userTeams)
    teamIds.push(...teams.map((t: any) => t.id))

    if (teamIds.length > 0) {
      const teamOrFilter = teamIds
        .flatMap((id: string) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
        .join(',')

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date, status, round_type, leg, tournament_id, home_team_id, away_team_id,
          tournament:tournaments(id, name, type),
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
        `)
        .or(teamOrFilter)
        .in('status', ['confirmed', 'completed', 'abandoned'])
        .order('scheduled_date', { ascending: false })

      const fixtureIds = (fixtures ?? []).map((f: any) => f.id)
      const { data: resultsData } = fixtureIds.length > 0
        ? await supabase
            .from('results')
            .select('fixture_id, home_score, away_score')
            .in('fixture_id', fixtureIds)
        : { data: [] }

      const resultsByFixture: Record<string, any> = {}
      for (const r of resultsData ?? []) {
        resultsByFixture[(r as any).fixture_id] = r as any
      }

      fixturesWithResults = (fixtures ?? []).map((f: any) => ({
        ...f,
        _result: resultsByFixture[f.id] ?? null,
      }))

      // Fetch sibling results for 2-leg knockout aggregate display
      const leg2Fixtures = fixturesWithResults.filter(
        (f: any) => f.leg === 2 && ['qf', 'sf'].includes(f.round_type) && f._result
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
          const leg2Ids = leg2Fixtures.map((f: any) => f.id)
          const { data: penRows } = await supabase
            .from('results')
            .select('fixture_id, pen_home_score, pen_away_score')
            .in('fixture_id', leg2Ids)
          for (const row of penRows ?? []) {
            penScores[row.fixture_id] = { pen_home_score: row.pen_home_score, pen_away_score: row.pen_away_score }
          }
        } catch {
          // pen scores not available — skip
        }

        for (const f of fixturesWithResults) {
          if (f.leg === 2 && ['qf', 'sf'].includes(f.round_type) && f._result) {
            const leg1Key = `${f.tournament_id}_${f.matchday - 10}`
            const leg1Result = siblingResultsByKey[leg1Key]
            const isLeg2Home = teamIds.includes(f.home_team_id)
            if (leg1Result) {
              const agg = computeAggregate(leg1Result, f._result)
              if (agg) (f as any)._aggregate = isLeg2Home ? flipAggregate(agg) : agg
            }
            const penScore = penScores[f.id]
            if (penScore && penScore.pen_home_score != null) {
              ;(f as any)._penScore = isLeg2Home
                ? { home: penScore.pen_home_score, away: penScore.pen_away_score }
                : { home: penScore.pen_away_score, away: penScore.pen_home_score }
            }
          }
        }
      }

      for (const f of fixtures ?? []) {
        const result = resultsByFixture[(f as any).id]
        if (!result) continue
        const home = Array.isArray((f as any).home_team) ? (f as any).home_team[0] : (f as any).home_team
        const isHome = teamIds.includes(home?.id)
        const myScore = isHome ? result.home_score : result.away_score
        const oppScore = isHome ? result.away_score : result.home_score
        if (myScore > oppScore) wins++
        else if (myScore < oppScore) losses++
        else draws++
      }

      primaryTeam = teams[0]
    }
  }

  const grouped: Record<string, any[]> = {}
  for (const f of fixturesWithResults) {
    const d = f.scheduled_date
    const key = d ? d.slice(0, 7) : 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(f)
  }

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return <Shell data={{ user, teams, teamIds, fixturesWithResults, grouped, sortedKeys, primaryTeam, wins, draws, losses }} />
}
