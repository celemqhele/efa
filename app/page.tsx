import { createClient } from '@/lib/supabase/server'
import PageWrapper from '@/components/ui/PageWrapper'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let userTeam: { id: string; name: string } | null = null
  let userTeamIds: string[] = []
  if (user) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .eq('manager_id', user.id)
    userTeam = (teamRows?.[0] as any) ?? null
    userTeamIds = (teamRows ?? []).map((t: any) => t.id)
  }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, type')
    .eq('type', 'league')
    .eq('status', 'active')
    .single()

  const { data: standings } = tournament
    ? await supabase
        .from('standings')
        .select('*, teams(id, name, logo_league_folder, logo_team_slug, profiles!manager_id(username))')
        .eq('tournament_id', tournament.id)
        .order('points', { ascending: false })
        .order('goal_difference', { ascending: false })
        .order('goals_for', { ascending: false })
        .limit(6)
    : { data: null }

  const teamOrFilter = userTeamIds.length > 0
    ? userTeamIds.flatMap(id => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`]).join(',')
    : null

  const today = new Date().toISOString().split('T')[0]
  let upcomingQuery = supabase
    .from('fixtures')
    .select('scheduled_date')
    .gte('scheduled_date', today)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .order('scheduled_date', { ascending: true })
    .limit(1)

  if (teamOrFilter) {
    upcomingQuery = upcomingQuery.or(teamOrFilter)
  }

  const { data: nextDateRow } = await upcomingQuery
  const nextDate: string | null = (nextDateRow?.[0] as any)?.scheduled_date?.slice(0, 10) ?? null

  let upcomingFixtures: any[] = []
  if (nextDate) {
    let batchQuery = supabase
      .from('fixtures')
      .select(`
        id, matchday, scheduled_date, status, deadline,
        home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
        away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
        results(home_score, away_score)
      `)
      .eq('scheduled_date', nextDate)
      .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
      .order('deadline')

    if (teamOrFilter) {
      batchQuery = batchQuery.or(teamOrFilter)
    }

    const { data } = await batchQuery
    upcomingFixtures = (data ?? []) as any[]
  }

  let latestResults: any[] = []
  if (userTeamIds.length > 0) {
    const teamOrFilterResults = userTeamIds
      .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
      .join(',')
    const { data: myFixtureIds } = await supabase
      .from('fixtures')
      .select('id')
      .or(teamOrFilterResults)
      .in('status', ['confirmed', 'completed', 'abandoned'])
    const ids = (myFixtureIds ?? []).map((f: any) => f.id)
    if (ids.length > 0) {
      const { data } = await supabase
        .from('results')
        .select(`
          id, home_score, away_score, created_at,
          fixtures(
            id, scheduled_date,
            home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
            away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
          )
        `)
        .in('fixture_id', ids)
        .order('created_at', { ascending: false })
        .limit(5)
      latestResults = data ?? []
    }
  } else {
    const { data } = await supabase
      .from('results')
      .select(`
        id, home_score, away_score, created_at,
        fixtures(
          id, scheduled_date,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)
    latestResults = data ?? []
  }

  const { data: unbeaten } = tournament
    ? await supabase
        .from('standings')
        .select('unbeaten_run, teams(name, logo_league_folder, logo_team_slug)')
        .eq('tournament_id', tournament.id)
        .gte('unbeaten_run', 5)
        .order('unbeaten_run', { ascending: false })
        .limit(3)
    : { data: null }

  // Calendar data for current month
  const now = new Date()
  const calYear = now.getFullYear()
  const calMonth = now.getMonth() + 1
  const monthStart = `${calYear}-${String(calMonth).padStart(2, '0')}-01`
  const lastDay = new Date(calYear, calMonth, 0).getDate()
  const monthEnd = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  let calQuery = supabase
    .from('fixtures')
    .select(`
      id, scheduled_date, status,
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
      result:results(home_score, away_score)
    `)
    .gte('scheduled_date', monthStart)
    .lte('scheduled_date', monthEnd + 'T23:59:59')
    .order('scheduled_date', { ascending: true })

  if (teamOrFilter) {
    calQuery = calQuery.or(teamOrFilter)
  }

  const { data: calFixtures } = await calQuery.limit(500)

  const { data: breaksRaw } = await supabase
    .from('season_breaks')
    .select('id, break_start, break_end, reason')
    .lte('break_start', monthEnd)
    .gte('break_end', monthStart)

  const data = {
    userTeam,
    userTeamIds,
    tournament,
    standings,
    nextDate,
    upcomingFixtures,
    latestResults,
    unbeaten,
    calendar: { year: calYear, month: calMonth, fixtures: (calFixtures ?? []) as any[], breaks: (breaksRaw ?? []) as any[] },
  }

  return (
    <PageWrapper>
      <Shell data={data} />
    </PageWrapper>
  )
}
