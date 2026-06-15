import { createClient, createAdminClient } from '@/lib/supabase/server'
import { drawGroups, drawKnockoutRound, drawOpenBracket, determineQualifiers } from '@/lib/tournament-draw'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string; phase?: 'groups' | 'knockout' }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tournament_id, phase = 'groups' } = body
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // Load tournament
  const { data: tournament } = await db('tournaments').select('*').eq('id', tournament_id).single()
  if (!tournament) return Response.json({ error: 'Tournament not found' }, { status: 404 })

  const settings = tournament.settings ?? {}

  // Load participants
  const { data: participants } = await db('tournament_participants')
    .select('*, team:team_id(id, name)')
    .eq('tournament_id', tournament_id)

  const teams = (participants ?? []).map((p: any) => ({
    id: p.team_id,
    rank: p.seed_pot ?? 0,
    label: p.team?.name,
  }))

  if (teams.length < 2) {
    return Response.json({ error: 'Not enough teams' }, { status: 400 })
  }

  if (phase === 'groups') {
    return await handleGroupDraw(adminSupabase, tournament, teams, settings, db)
  }

  return await handleKnockoutDraw(adminSupabase, tournament, teams, settings, db)
}

async function handleGroupDraw(adminSupabase: any, tournament: any, teams: any[], settings: any, db: any) {
  const groupCount = settings.num_groups ?? settings.group_count ?? Math.max(2, Math.floor(teams.length / 3))

  // Run the draw
  const result = drawGroups({
    teams,
    groupCount,
    restriction: settings.restriction ?? undefined,
  })

  if (!result.valid) {
    return Response.json({ error: 'Could not generate valid groups after 10000 attempts' }, { status: 500 })
  }

  // Organise by group
  const groups = new Map<number, string[]>()
  for (const a of result.groups) {
    if (!groups.has(a.group)) groups.set(a.group, [])
    groups.get(a.group)!.push(a.teamId)
  }

  // Assign group names (A, B, C, ...)
  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const assignments: { group_name: string; teams: string[]; pot: number }[] = []

  for (const [groupIdx, teamIds] of groups) {
    const groupName = groupNames[groupIdx] ?? `Group ${groupIdx + 1}`
    assignments.push({ group_name: groupName, teams: teamIds, pot: 0 })

    // Update tournament_participants with group assignment
    for (const teamId of teamIds) {
      const pot = result.groups.find((a) => a.teamId === teamId)?.pot ?? 0
      await db('tournament_participants')
        .update({ group_name: groupName, seed_pot: pot })
        .eq('tournament_id', tournament.id)
        .eq('team_id', teamId)
    }
  }

  // Create group standings rows
  for (const { group_name, teams: groupTeamIds } of assignments) {
    const standingRows = groupTeamIds.map((teamId: string) => ({
      tournament_id: tournament.id,
      group_name,
      team_id: teamId,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, points: 0,
    }))
    await db('group_standings').upsert(standingRows, { onConflict: 'tournament_id,group_name,team_id' })
  }

  await db('audit_log').insert({
    admin_id: (await adminSupabase.auth.getUser()).data.user?.id,
    action: 'tournament_group_draw',
    target_type: 'tournament',
    target_id: tournament.id,
    details: {
      groups: assignments.map((a) => ({ group: a.group_name, teams: a.teams.length })),
      iterations: result.iterations,
    },
  })

  return Response.json({
    success: true,
    groups: assignments.map((a) => ({
      name: a.group_name,
      teamCount: a.teams.length,
    })),
    iterations: result.iterations,
  })
}

async function handleKnockoutDraw(adminSupabase: any, tournament: any, teams: any[], settings: any, db: any) {
  // Load group standings to determine seeded/unseeded
  const { data: groupStandings } = await db('group_standings')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('group_name')
    .order('points', { ascending: false })
    .order('goal_difference', { ascending: false })
    .order('goals_for', { ascending: false })

  if (!groupStandings || groupStandings.length === 0) {
    return Response.json({ error: 'No group standings found. Run group draw first.' }, { status: 400 })
  }

  const autoQualifyPerGroup = settings.qualifiers_per_group ?? settings.auto_qualify_per_group ?? 2
  const additionalSlots = settings.additional_knockout_slots ?? 0

  const standings = groupStandings.map((gs: any) => ({
    group: gs.group_name,
    teamId: gs.team_id,
    points: gs.points,
    gd: (gs.goals_for ?? 0) - (gs.goals_against ?? 0),
    gf: gs.goals_for ?? 0,
  }))

  const { autoQualifiers, additionalQualifiers } = determineQualifiers(
    standings,
    autoQualifyPerGroup,
    additionalSlots
  )

  const allQualifiers = [...autoQualifiers, ...additionalQualifiers]

  if (allQualifiers.length < 2) {
    return Response.json({ error: 'Not enough qualifiers' }, { status: 400 })
  }

  // Build forbidden pairs: teams from the same group
  const byGroup = new Map<string, Set<string>>()
  for (const gs of groupStandings) {
    if (!byGroup.has(gs.group_name)) byGroup.set(gs.group_name, new Set())
    byGroup.get(gs.group_name)!.add(gs.team_id)
  }
  const forbiddenPairs: Set<string>[] = []
  for (const [, teamIds] of byGroup) {
    if (teamIds.size >= 2) forbiddenPairs.push(teamIds)
  }

  // First round: seeded (group winners) vs unseeded (runners-up + extras)
  const firstRoundQualifiers = settings.first_round_teams ?? allQualifiers.length
  const firstRoundTeams = allQualifiers.slice(0, firstRoundQualifiers)

  // Seed by group position (first half = winners, second half = runners-up)
  const autoCount = autoQualifiers.length
  const seeded = autoQualifiers.slice(0, Math.ceil(autoCount / 2))
  const unseeded = allQualifiers.filter((id) => !seeded.includes(id)).slice(0, seeded.length)

  let knockoutDraw
  if (seeded.length === unseeded.length && seeded.length > 0) {
    knockoutDraw = drawKnockoutRound({
      seededTeams: seeded,
      unseededTeams: unseeded,
      roundName: 'first_round',
      forbiddenPairs,
      totalRounds: 1,
      currentRound: 1,
    })
  } else {
    // Open draw if unbalanced
    const pairs = drawOpenBracket(firstRoundTeams)
    knockoutDraw = {
      pairings: pairs.map((p) => ({ seeded: p.home, unseeded: p.away })),
      valid: true,
    }
  }

  if (!knockoutDraw || !knockoutDraw.valid) {
    return Response.json({ error: 'Could not generate valid knockout pairings' }, { status: 500 })
  }

  // Create the first knockout round as TBC fixtures
  const matchdayBase = settings.knockout_start_matchday ?? 100
  const fixtures = knockoutDraw.pairings.map((p, idx) => ({
    tournament_id: tournament.id,
    home_team_id: p.seeded,
    away_team_id: p.unseeded,
    matchday: matchdayBase + idx + 1,
    round_type: 'qf' as const,
    leg: 1,
    status: 'scheduled' as const,
    is_postponed: false,
  }))

  await db('fixtures').insert(fixtures)

  await db('audit_log').insert({
    admin_id: (await adminSupabase.auth.getUser()).data.user?.id,
    action: 'tournament_knockout_draw',
    target_type: 'tournament',
    target_id: tournament.id,
    details: {
      qualifiers: allQualifiers.length,
      pairings: knockoutDraw.pairings.length,
    },
  })

  return Response.json({
    success: true,
    pairings: knockoutDraw.pairings,
    qualifiers: allQualifiers,
  })
}
