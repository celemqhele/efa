import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures, generateGroupFixtures, type GeneratedFixture } from '@/lib/fixture-generator'
import type { Database } from '@/lib/supabase/types'
import { insertNotificationsAndPush } from '@/lib/notify'

type FixtureInsert = Database['public']['Tables']['fixtures']['Insert']

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tournament_id: string = body.tournament_id ?? body.tournamentId
  const start_date: string | undefined = body.start_date

  if (!tournament_id) {
    return Response.json({ error: 'tournament_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  const { data: tournament, error: tournamentError } = await adminSupabase
    .from('tournaments')
    .select('id, name, type, settings, season_id')
    .eq('id', tournament_id)
    .single()

  if (tournamentError || !tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 })
  }

  const { data: participants, error: participantsError } = await adminSupabase
    .from('tournament_participants')
    .select('team_id')
    .eq('tournament_id', tournament_id)

  if (participantsError || !participants || participants.length < 2) {
    return Response.json(
      { error: 'Tournament needs at least 2 participants' },
      { status: 400 }
    )
  }

  const teamIds = participants.map((p) => p.team_id)

  const settings = tournament.settings as Record<string, any> | null
  const numGroups = settings?.num_groups
  const teamsPerGroup = settings?.teams_per_group
  const numRounds = settings?.num_rounds ?? 2

  const { data: existingFixtures } = await adminSupabase
    .from('fixtures')
    .select('id')
    .eq('tournament_id', tournament_id)
    .limit(1)

  if (existingFixtures && existingFixtures.length > 0) {
    return Response.json(
      { error: 'Fixtures have already been generated for this tournament' },
      { status: 409 }
    )
  }

  let generated: GeneratedFixture[] = []

  if (numGroups && teamsPerGroup && settings?.fixture_mode === 'groups') {
    const shuffledTeamIds = [...teamIds].sort(() => Math.random() - 0.5)
    const groups: Record<string, string[]> = {}
    const participantUpdates: Array<{ id: string; group_name: string }> = []

    const { data: participantsWithIds } = await adminSupabase
      .from('tournament_participants')
      .select('id, team_id')
      .eq('tournament_id', tournament_id)

    for (let g = 0; g < numGroups; g++) {
      const groupName = String.fromCharCode(65 + g)
      const groupTeams = shuffledTeamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup)
      groups[groupName] = groupTeams

      groupTeams.forEach((tid) => {
        const participant = participantsWithIds?.find((p) => p.team_id === tid)
        if (participant) {
          participantUpdates.push({ id: participant.id, group_name: groupName })
        }
      })
    }

    for (const update of participantUpdates) {
      await adminSupabase
        .from('tournament_participants')
        .update({ group_name: update.group_name })
        .eq('id', update.id)
    }

    const groupStandingRows = participantUpdates.map((u) => {
      const tid = participantsWithIds?.find((p) => p.id === u.id)?.team_id
      return {
        tournament_id,
        team_id: tid,
        group_name: u.group_name,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, points: 0,
      }
    })

    const { error: gsErr } = await (adminSupabase.from('group_standings') as any).insert(groupStandingRows)
    if (gsErr) console.error('Failed to init group standings:', gsErr.message)

    generated = await generateGroupFixtures(adminSupabase, groups, numRounds, start_date, tournament_id)
  } else {
    generated = await generateLeagueFixtures(adminSupabase, teamIds, tournament_id, numRounds, start_date)
  }

  if (generated.length === 0) {
    return Response.json(
      { error: 'No fixtures could be generated' },
      { status: 400 }
    )
  }

  const fixtureRows: FixtureInsert[] = generated.map((f) => ({
    tournament_id,
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

  const { error: insertError } = await adminSupabase
    .from('fixtures')
    .insert(fixtureRows)

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  const { data: teams } = await adminSupabase
    .from('teams')
    .select('id, manager_id, name')
    .in('id', teamIds)

  if (teams) {
    const managerNotifications = teams
      .filter((t) => t.manager_id !== null)
      .map((t) => ({
        user_id: t.manager_id as string,
        type: 'fixtures_released',
        title: 'Fixtures Released',
        body: `Fixtures for ${tournament.name} are now live!`,
        data: { tournament_id, tournament: tournament.name },
      }))

    if (managerNotifications.length > 0) {
      await insertNotificationsAndPush(adminSupabase, managerNotifications)
    }
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'generate_fixtures',
    target_type: 'tournament',
    target_id: tournament_id,
    details: { count: generated.length, tournament_name: tournament.name },
  })

  return Response.json({ success: true, count: generated.length })
}
