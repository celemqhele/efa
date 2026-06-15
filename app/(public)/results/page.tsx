import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

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
          id, matchday, scheduled_date, status, round_type, leg,
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

      const resultsByFixture: Record<string, { home_score: number; away_score: number }> = {}
      for (const r of resultsData ?? []) {
        resultsByFixture[(r as any).fixture_id] = r as any
      }

      fixturesWithResults = (fixtures ?? []).map((f: any) => ({
        ...f,
        _result: resultsByFixture[f.id] ?? null,
      }))

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
