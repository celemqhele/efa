import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures } from '@/lib/fixture-generator'
import { insertNotificationsAndPush } from '@/lib/notify'
import { resolveUserClubId, stampFixtureParticipants } from '@/lib/slot-utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { season_name, start_date, end_date, league_team_ids, ucl_team_ids, europa_team_ids, league_user_ids, ucl_user_ids, europa_user_ids } = body

  // Slot-driven resolution: prefer user ids (each user's current club), fall back to bare team ids
  async function resolveSlots(userIds: string[] | undefined, teamIds: string[] | undefined): Promise<{ user_id: string | null; team_id: string }[]> {
    if (userIds && userIds.length > 0) {
      const slots: { user_id: string | null; team_id: string }[] = []
      for (const uid of userIds) {
        const team_id = await resolveUserClubId(adminSupabase, uid)
        if (!team_id) throw new Error('Every user must currently manage a team')
        slots.push({ user_id: uid, team_id })
      }
      return slots
    }
    return (teamIds ?? []).map((team_id) => ({ user_id: null, team_id }))
  }

  const leagueSlots = await resolveSlots(league_user_ids, league_team_ids)

  if (!season_name || !start_date || !end_date || leagueSlots.length === 0) {
    return Response.json({ error: 'season_name, start_date, end_date, and league participants are required' }, { status: 400 })
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
    slots: { user_id: string | null; team_id: string }[],
    generateFixtures: boolean
  ): Promise<string | null> {
    const fixtureMode = type === 'league' ? 'round_robin' : 'groups'
    const { data: t, error: tErr } = await adminSupabase
      .from('tournaments')
      .insert({ season_id, name, type, status: 'active', settings: { start_date, end_date, fixture_mode: fixtureMode } })
      .select('id')
      .single()
    if (tErr || !t) { console.error(`Failed to create ${name}:`, tErr?.message); return null }

    const tid = t.id

    const { data: insertedParticipants } = await adminSupabase.from('tournament_participants').insert(
      slots.map((s) => ({ tournament_id: tid, team_id: s.team_id, user_id: s.user_id }))
    ).select('id, team_id')

    const participantByTeamId = new Map<string, string>()
    for (const row of insertedParticipants ?? []) {
      if (row.team_id) participantByTeamId.set(row.team_id, row.id)
    }

    if (type === 'league') {
      await adminSupabase.from('standings').insert(
        slots.map((s) => ({
          tournament_id: tid, team_id: s.team_id,
          participant_id: participantByTeamId.get(s.team_id) ?? null,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, points: 0,
          form: '', unbeaten_run: 0, clean_sheets: 0,
        }))
      )
    }

    if (generateFixtures) {
      const generated = await generateLeagueFixtures(adminSupabase, slots.map((s) => s.team_id), tid)
      if (generated.length > 0) {
        const stamped = await stampFixtureParticipants(adminSupabase, tid, generated)
        await adminSupabase.from('fixtures').insert(
          stamped.map((f) => ({
            tournament_id: tid,
            home_team_id: f.home_team_id,
            away_team_id: f.away_team_id,
            home_participant_id: f.home_participant_id,
            away_participant_id: f.away_participant_id,
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
    leagueSlots,
    true
  )

  // 3. Create Tournament (Clubs) if participants provided
  const uclSlots = await resolveSlots(ucl_user_ids, ucl_team_ids)
  if (uclSlots.length >= 2) {
    await createTournamentWithFixtures('EFA Tournament (Clubs)', 'tournament_club', uclSlots, false)
  }

  // 4. Create Tournament (International) if participants provided
  const europaSlots = await resolveSlots(europa_user_ids, europa_team_ids)
  if (europaSlots.length >= 2) {
    await createTournamentWithFixtures('EFA Tournament (International)', 'tournament_international', europaSlots, false)
  }

  // 5. Notify all league participants
  const { data: teams } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .in('id', leagueSlots.map((s) => s.team_id))

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
    await insertNotificationsAndPush(adminSupabase, notifs)
  }

  // 6. Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'start_season',
    target_type: 'season',
    target_id: season_id,
    details: {
      season_name,
      league_teams: leagueSlots.length,
      ucl_teams: uclSlots.length,
      europa_teams: europaSlots.length,
    },
  })

  return Response.json({ success: true, season_id, league_tournament_id: leagueTid })
}
