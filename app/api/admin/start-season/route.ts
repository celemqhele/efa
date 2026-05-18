import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures } from '@/lib/fixture-generator'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { season_name, start_date, end_date, league_team_ids, ucl_team_ids, europa_team_ids } = body

  if (!season_name || !start_date || !end_date || !league_team_ids?.length) {
    return Response.json({ error: 'season_name, start_date, end_date, and league_team_ids are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // 1. Create season
  const { data: season, error: seasonErr } = await adminSupabase
    .from('seasons')
    .insert({ name: season_name, base_league: 'EFA Premier League', status: 'active', start_date, end_date })
    .select('id')
    .single()
  if (seasonErr || !season) return Response.json({ error: seasonErr?.message ?? 'Failed to create season' }, { status: 500 })

  const season_id = season.id

  // Helper: create tournament + participants + standings rows (for league) + generate fixtures
  async function createTournamentWithFixtures(
    name: string,
    type: string,
    teamIds: string[],
    generateFixtures: boolean
  ): Promise<string | null> {
    const { data: t, error: tErr } = await adminSupabase
      .from('tournaments')
      .insert({ season_id, name, type, status: 'active', settings: { start_date, end_date } })
      .select('id')
      .single()
    if (tErr || !t) { console.error(`Failed to create ${name}:`, tErr?.message); return null }

    const tid = t.id

    await adminSupabase.from('tournament_participants').insert(
      teamIds.map((team_id) => ({ tournament_id: tid, team_id }))
    )

    if (type === 'league') {
      await adminSupabase.from('standings').insert(
        teamIds.map((team_id) => ({
          tournament_id: tid, team_id,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, points: 0,
          form: '', unbeaten_run: 0, clean_sheets: 0,
        }))
      )
    }

    if (generateFixtures) {
      const generated = generateLeagueFixtures(teamIds, start_date, end_date, [], tid)
      if (generated.length > 0) {
        await adminSupabase.from('fixtures').insert(
          generated.map((f) => ({
            tournament_id: tid,
            home_team_id: f.home_team_id,
            away_team_id: f.away_team_id,
            matchday: f.matchday,
            scheduled_date: f.scheduled_date,
            deadline: f.deadline,
            round_type: f.round_type,
            leg: f.leg,
            status: 'scheduled',
            is_postponed: false,
          }))
        )
      }
    }

    return tid
  }

  // 2. Create league tournament with all fixtures
  const leagueTid = await createTournamentWithFixtures(
    'EFA Premier League',
    'league',
    league_team_ids,
    true
  )

  // 3. Create UCL if teams provided (from previous season)
  if (ucl_team_ids?.length >= 2) {
    await createTournamentWithFixtures('EFA Champions League', 'ucl', ucl_team_ids, false)
  }

  // 4. Create Europa if teams provided (from previous season)
  if (europa_team_ids?.length >= 2) {
    await createTournamentWithFixtures('EFA Europa League', 'europa', europa_team_ids, false)
  }

  // 5. Notify all league participants
  const { data: teams } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .in('id', league_team_ids)

  const notifs = (teams ?? [])
    .filter((t) => t.manager_id)
    .map((t) => ({
      user_id: t.manager_id as string,
      type: 'fixtures_released',
      title: 'Season Started!',
      body: `${season_name} has kicked off. Your league fixtures are now live!`,
      data: { season_id },
    }))

  if (notifs.length > 0) {
    await adminSupabase.from('notifications').insert(notifs)
  }

  // 6. Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'start_season',
    target_type: 'season',
    target_id: season_id,
    details: {
      season_name,
      league_teams: league_team_ids.length,
      ucl_teams: ucl_team_ids?.length ?? 0,
      europa_teams: europa_team_ids?.length ?? 0,
    },
  })

  return Response.json({ success: true, season_id, league_tournament_id: leagueTid })
}
