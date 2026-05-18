import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures, type GeneratedFixture } from '@/lib/fixture-generator'
import type { Database } from '@/lib/supabase/types'

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

  // Check admin role
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

  if (!tournament_id) {
    return Response.json({ error: 'tournament_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Fetch tournament
  const { data: tournament, error: tournamentError } = await adminSupabase
    .from('tournaments')
    .select('id, name, type, settings, season_id')
    .eq('id', tournament_id)
    .single()

  if (tournamentError || !tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 })
  }

  // Fetch tournament participants
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

  // Fetch season breaks
  const { data: breaks } = await adminSupabase
    .from('season_breaks')
    .select('break_start, break_end')
    .eq('tournament_id', tournament_id)

  const seasonBreaks = breaks ?? []

  // Extract start/end dates from tournament settings
  const settings = tournament.settings as Record<string, string> | null
  const startDate = settings?.start_date
  const endDate = settings?.end_date

  if (!startDate || !endDate) {
    return Response.json(
      { error: 'Tournament settings must include start_date and end_date' },
      { status: 400 }
    )
  }

  // Check for existing fixtures (idempotent guard)
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

  // Generate fixtures
  const generated: GeneratedFixture[] = generateLeagueFixtures(
    teamIds,
    startDate,
    endDate,
    seasonBreaks,
    tournament_id
  )

  if (generated.length === 0) {
    return Response.json(
      { error: 'No fixtures could be generated for the given date range' },
      { status: 400 }
    )
  }

  // Build insert rows
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

  // Notify all participants
  const notifications = participants.map((p) => ({
    user_id: p.team_id, // will be resolved to manager_id below
    tournament_id,
  }))

  // Fetch manager_ids for participants
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
      await adminSupabase.from('notifications').insert(managerNotifications)
    }
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'generate_fixtures',
    target_type: 'tournament',
    target_id: tournament_id,
    details: { count: generated.length, tournament_name: tournament.name },
  })

  return Response.json({ success: true, count: generated.length })
}
