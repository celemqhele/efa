import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures, generateGroupFixtures, type GeneratedFixture } from '@/lib/fixture-generator'
import { findMatchDay, findTimeWindow, resolveAvailability, getDateForDay, type DaySchedule } from '@/lib/scheduling'
import { parseISO } from 'date-fns'
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

  // Extract start/end dates and format settings from tournament settings
  const settings = tournament.settings as Record<string, any> | null
  const startDate = settings?.start_date
  const endDate = settings?.end_date
  const numGroups = settings?.num_groups
  const teamsPerGroup = settings?.teams_per_group
  const numRounds = settings?.num_rounds ?? 2

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

  let generated: GeneratedFixture[] = []

  // Group-based tournament?
  if (numGroups && teamsPerGroup && tournament.type !== 'league') {
    // 1. Assign teams to groups
    const shuffledTeamIds = [...teamIds].sort(() => Math.random() - 0.5)
    const groups: Record<string, string[]> = {}
    const participantUpdates: Array<{ id: string; group_name: string }> = []

    // Fetch participant IDs to update them
    const { data: participantsWithIds } = await adminSupabase
      .from('tournament_participants')
      .select('id, team_id')
      .eq('tournament_id', tournament_id)

    for (let g = 0; g < numGroups; g++) {
      const groupName = String.fromCharCode(65 + g) // A, B, C...
      const groupTeams = shuffledTeamIds.slice(g * teamsPerGroup, (g + 1) * teamsPerGroup)
      groups[groupName] = groupTeams

      // Prepare updates for tournament_participants
      groupTeams.forEach((tid) => {
        const participant = participantsWithIds?.find((p) => p.team_id === tid)
        if (participant) {
          participantUpdates.push({ id: participant.id, group_name: groupName })
        }
      })
    }

    // Update participants with group names
    for (const update of participantUpdates) {
      await adminSupabase
        .from('tournament_participants')
        .update({ group_name: update.group_name })
        .eq('id', update.id)
    }

    // 2. Initialize group standings
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

    // 3. Generate group fixtures
    generated = generateGroupFixtures(groups, startDate, endDate, seasonBreaks, numRounds)
  } else {
    // Standard league generation
    generated = generateLeagueFixtures(
      teamIds,
      startDate,
      endDate,
      seasonBreaks,
      tournament_id,
      numRounds
    )
  }

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

  // ── Auto-schedule fixtures based on manager availability ──
  const { data: insertedFixtures } = await adminSupabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(manager_id),
      away_team:teams!fixtures_away_team_id_fkey(manager_id)
    `)
    .eq('tournament_id', tournament_id)

  if (insertedFixtures && insertedFixtures.length > 0) {
    const managerIds = [
      ...new Set(
        insertedFixtures.flatMap((f: any) => [
          (f.home_team as any)?.manager_id,
          (f.away_team as any)?.manager_id,
        ]).filter(Boolean),
      ),
    ] as string[]

    const availMap: Record<string, DaySchedule[]> = {}
    if (managerIds.length > 0) {
      const { data: availabilities } = await adminSupabase
        .from('manager_availability')
        .select('*')
        .in('profile_id', managerIds)

      for (const a of availabilities ?? []) {
        availMap[a.profile_id] = a.schedule as DaySchedule[]
      }
    }

    const seasonStart = settings?.start_date as string | undefined

    for (const fx of insertedFixtures as any[]) {
      const homeMgr = (fx.home_team as any)?.manager_id
      const awayMgr = (fx.away_team as any)?.manager_id

      const rawHome = homeMgr ? availMap[homeMgr] : undefined
      const rawAway = awayMgr ? availMap[awayMgr] : undefined

      const hAvail = resolveAvailability(rawHome, rawAway)
      const aAvail = resolveAvailability(rawAway, rawHome)

      const dayName = findMatchDay(hAvail, aAvail)
      const window = findTimeWindow(hAvail, aAvail, dayName)

      const refDate = fx.scheduled_date && seasonStart
        ? parseISO(String(fx.scheduled_date))
        : seasonStart
          ? parseISO(seasonStart)
          : new Date()

      const scheduledDate = seasonStart ? getDateForDay(dayName, refDate) : ''

      await adminSupabase
        .from('fixtures')
        .update({
          assigned_day: dayName,
          window_start: window.start,
          window_end: window.end,
          scheduled_date: scheduledDate ? `${scheduledDate}T${window.start}:00` : fx.scheduled_date,
          deadline: scheduledDate ? `${scheduledDate}T${window.end}:00` : fx.deadline,
        })
        .eq('id', fx.id)
    }
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
