import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generatePhaseFixtures } from '@/lib/phase-fixture-generator'
import { addDays, format } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    season_name: string
    start_date: string
    league_team_ids: string[]
    ucl_team_ids: string[]
    europa_team_ids: string[]
    ucl_groups?: { A: string[]; B: string[] }
    europa_groups?: { A: string[]; B: string[] }
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { season_name, start_date, league_team_ids, ucl_team_ids, europa_team_ids, ucl_groups, europa_groups } = body

  if (!season_name?.trim() || !start_date) {
    return Response.json({ error: 'season_name and start_date are required' }, { status: 400 })
  }
  if (!league_team_ids || league_team_ids.length !== 20) {
    return Response.json({ error: 'Exactly 20 league team IDs required' }, { status: 400 })
  }
  if (!ucl_team_ids || ucl_team_ids.length !== 12) {
    return Response.json({ error: 'Exactly 12 UCL team IDs required' }, { status: 400 })
  }
  if (!europa_team_ids || europa_team_ids.length !== 8) {
    return Response.json({ error: 'Exactly 8 Europa team IDs required' }, { status: 400 })
  }
  if (!ucl_team_ids.every((id) => league_team_ids.includes(id))) {
    return Response.json({ error: 'UCL teams must all be in the league' }, { status: 400 })
  }
  if (!europa_team_ids.every((id) => league_team_ids.includes(id))) {
    return Response.json({ error: 'Europa teams must all be in the league' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // End date = start + 45 days (server-authoritative)
  const end_date = format(addDays(new Date(start_date), 45), 'yyyy-MM-dd')

  // Load only teams in the league (for manager notification lookups)
  const { data: allTeams, error: teamsErr } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .in('id', league_team_ids)

  if (teamsErr || !allTeams || allTeams.length < 2) {
    return Response.json({ error: 'Could not load teams' }, { status: 500 })
  }

  // Split UCL/Europa into groups if not explicitly provided
  const resolvedUclGroups = ucl_groups ?? {
    A: ucl_team_ids.slice(0, 6),
    B: ucl_team_ids.slice(6),
  }
  const resolvedEuropaGroups = europa_groups ?? {
    A: europa_team_ids.slice(0, 4),
    B: europa_team_ids.slice(4),
  }

  // Generate all phase fixtures in one shot
  const { leagueFixtures, uclFixtures, europaFixtures } = generatePhaseFixtures({
    leagueTeamIds: league_team_ids,
    uclGroups: resolvedUclGroups,
    europaGroups: resolvedEuropaGroups,
    startDate: start_date,
    endDate: end_date,
  })

  // ── 1. Season ────────────────────────────────────────────────────────────────

  const { data: season, error: seasonErr } = await adminSupabase
    .from('seasons')
    .insert({
      name: season_name,
      base_league: 'EFA Premier League',
      status: 'active',
      start_date,
      end_date,
    })
    .select('id')
    .single()

  if (seasonErr || !season) {
    return Response.json({ error: seasonErr?.message ?? 'Failed to create season' }, { status: 500 })
  }

  const season_id = season.id

  // ── 2. League tournament ─────────────────────────────────────────────────────

  const { data: leagueTournament } = await adminSupabase
    .from('tournaments')
    .insert({
      season_id,
      name: 'EFA Premier League',
      type: 'league',
      status: 'active',
      settings: { start_date, end_date },
    })
    .select('id')
    .single()

  if (!leagueTournament) {
    return Response.json({ error: 'Failed to create league tournament' }, { status: 500 })
  }

  const leagueTId = leagueTournament.id

  await adminSupabase.from('tournament_participants').insert(
    league_team_ids.map((team_id) => ({ tournament_id: leagueTId, team_id }))
  )

  await adminSupabase.from('standings').insert(
    league_team_ids.map((team_id) => ({
      tournament_id: leagueTId,
      team_id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
      form: '',
      unbeaten_run: 0,
      clean_sheets: 0,
    }))
  )

  if (leagueFixtures.length > 0) {
    await adminSupabase.from('fixtures').insert(
      leagueFixtures.map((f) => ({
        tournament_id: leagueTId,
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

  // ── 3. Tournament (Clubs) ─────────────────────────────────────────────────────

  const { data: uclTournament } = await adminSupabase
    .from('tournaments')
    .insert({
      season_id,
      name: 'EFA Tournament (Clubs)',
      type: 'tournament_club',
      status: 'active',
      settings: { start_date, end_date, fixture_mode: 'groups' },
    })
    .select('id')
    .single()

  if (!uclTournament) {
    return Response.json({ error: 'Failed to create Tournament (Clubs)' }, { status: 500 })
  }

  const uclTId = uclTournament.id

  const uclParticipants = [
    ...resolvedUclGroups.A.map((team_id) => ({ tournament_id: uclTId, team_id, group_name: 'A' })),
    ...resolvedUclGroups.B.map((team_id) => ({ tournament_id: uclTId, team_id, group_name: 'B' })),
  ]

  await adminSupabase.from('tournament_participants').insert(uclParticipants)

  await (adminSupabase.from('group_standings') as any).insert(
    uclParticipants.map((p) => ({
      tournament_id: uclTId,
      team_id: p.team_id,
      group_name: p.group_name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
    }))
  )

  if (uclFixtures.length > 0) {
    await adminSupabase.from('fixtures').insert(
      uclFixtures.map((f) => ({
        tournament_id: uclTId,
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

  // ── 4. Tournament (International) ───────────────────────────────────────────

  const { data: europaTournament } = await adminSupabase
    .from('tournaments')
    .insert({
      season_id,
      name: 'EFA Tournament (International)',
      type: 'tournament_international',
      status: 'active',
      settings: { start_date, end_date, fixture_mode: 'groups' },
    })
    .select('id')
    .single()

  if (!europaTournament) {
    return Response.json({ error: 'Failed to create Europa tournament' }, { status: 500 })
  }

  const europaTId = europaTournament.id

  const europaParticipants = [
    ...resolvedEuropaGroups.A.map((team_id) => ({ tournament_id: europaTId, team_id, group_name: 'A' })),
    ...resolvedEuropaGroups.B.map((team_id) => ({ tournament_id: europaTId, team_id, group_name: 'B' })),
  ]

  await adminSupabase.from('tournament_participants').insert(europaParticipants)

  await (adminSupabase.from('group_standings') as any).insert(
    europaParticipants.map((p) => ({
      tournament_id: europaTId,
      team_id: p.team_id,
      group_name: p.group_name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
    }))
  )

  if (europaFixtures.length > 0) {
    await adminSupabase.from('fixtures').insert(
      europaFixtures.map((f) => ({
        tournament_id: europaTId,
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

  // ── 5. Notify managers ───────────────────────────────────────────────────────

  const managedTeams = allTeams.filter((t) => t.manager_id)
  if (managedTeams.length > 0) {
    await adminSupabase.from('notifications').insert(
      managedTeams.map((t) => ({
        user_id: t.manager_id as string,
        type: 'fixtures_released',
        title: 'Phase Started!',
        body: `${season_name} has kicked off — your fixtures are live!`,
        data: { season_id },
      }))
    )
  }

  // ── 6. Audit log ─────────────────────────────────────────────────────────────

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'start_phase',
    target_type: 'season',
    target_id: season_id,
    details: {
      season_name,
      start_date,
      end_date,
      league_teams: league_team_ids.length,
      ucl_teams: ucl_team_ids.length,
      europa_teams: europa_team_ids.length,
      league_fixtures: leagueFixtures.length,
      ucl_fixtures: uclFixtures.length,
      europa_fixtures: europaFixtures.length,
    },
  })

  return Response.json({
    success: true,
    season_id,
    fixtures: {
      league: leagueFixtures.length,
      ucl: uclFixtures.length,
      europa: europaFixtures.length,
      total: leagueFixtures.length + uclFixtures.length + europaFixtures.length,
    },
  })
}
