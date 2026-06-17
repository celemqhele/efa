import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Fixtures',
  description: 'Upcoming EFA fixtures — see match schedules, dates, and kick-off times.',
  openGraph: { title: 'Fixtures | EFA', description: 'Upcoming EFA fixtures — see match schedules, dates, and kick-off times.' },
}

export default async function FixturesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const teams: any[] = []
  const teamIds: string[] = []
  let fixturesWithResults: any[] = []
  let primaryTeam: any = null

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
        .order('scheduled_date', { ascending: true })

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

      primaryTeam = teams[0]
    }
  }

  const upcomingStatuses = new Set(['scheduled', 'awaiting_confirmation'])
  const upcoming = fixturesWithResults.filter((f: any) => upcomingStatuses.has(f.status))

  const grouped: Record<string, any[]> = {}
  for (const f of upcoming) {
    const key = f.scheduled_date ? f.scheduled_date.slice(0, 10) : 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(f)
  }

  const sortedKeys = Object.keys(grouped).sort()

  return <Shell data={{ user, teams, teamIds, fixturesWithResults, upcoming, grouped, sortedKeys, primaryTeam }} />
}
