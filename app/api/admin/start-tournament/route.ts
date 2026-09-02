import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateGroupFixtures } from '@/lib/fixture-generator'
import { drawGroups } from '@/lib/tournament-draw'
import { sortStandingsRows } from '@/lib/standings-core'
import { stampFixtureParticipants } from '@/lib/slot-utils'

const CUP_TYPES = ['tournament_club', 'tournament_international'] as const

const CUP_NAMES: Record<string, string> = {
  tournament_club: 'EFA Tournament (Clubs)',
  tournament_international: 'EFA Tournament (International)',
}

const DONE_STATUSES = '("confirmed","abandoned_home","abandoned_away","abandoned_both")'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    season_id: string
    type: typeof CUP_TYPES[number]
    team_ids: string[]
    num_groups?: number
    qualifiers_per_group?: number
  }

  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { season_id, type, team_ids, num_groups = 2, qualifiers_per_group = 2 } = body

  if (!season_id || !type || !team_ids?.length) {
    return Response.json({ error: 'season_id, type and team_ids are required' }, { status: 400 })
  }
  if (!CUP_TYPES.includes(type)) {
    return Response.json({ error: 'Invalid tournament type' }, { status: 400 })
  }
  if (num_groups < 1 || team_ids.length < num_groups * 2 || team_ids.length % num_groups !== 0) {
    return Response.json({ error: 'Team count must divide evenly across the groups (min 2 per group)' }, { status: 400 })
  }
  if (qualifiers_per_group < 1) {
    return Response.json({ error: 'Qualifiers per group must be at least 1' }, { status: 400 })
  }
  if (new Set(team_ids).size !== team_ids.length) {
    return Response.json({ error: 'Duplicate teams in selection' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // Season must be active
  const { data: season } = await db('seasons')
    .select('id, name, status')
    .eq('id', season_id)
    .single()

  if (!season) return Response.json({ error: 'Season not found' }, { status: 404 })
  if (season.status !== 'active') {
    return Response.json({ error: 'Season is not active' }, { status: 400 })
  }

  // League tournaments (one per division) for this season
  const { data: leagueTournaments } = await db('tournaments')
    .select('id, division')
    .eq('season_id', season_id)
    .eq('type', 'league')
    .order('division', { ascending: true })

  if (!leagueTournaments || leagueTournaments.length === 0) {
    return Response.json({ error: 'No league tournament found for this season' }, { status: 404 })
  }

  // All league fixtures must be completed
  for (const leagueTournament of leagueTournaments) {
    const { data: pending } = await db('fixtures')
      .select('id')
      .eq('tournament_id', leagueTournament.id)
      .not('status', 'in', DONE_STATUSES)
      .limit(1)

    if (pending && pending.length > 0) {
      return Response.json({ error: 'Not all league fixtures are completed yet' }, { status: 400 })
    }
  }

  // No duplicate cup of this type for this season
  const { data: existing } = await db('tournaments')
    .select('id')
    .eq('season_id', season_id)
    .eq('type', type)
    .limit(1)

  if (existing && existing.length > 0) {
    return Response.json({ error: `A ${CUP_NAMES[type]} already exists for this season` }, { status: 409 })
  }

  // Teams must come from this season's league divisions (slot owners carry over)
  const leagueTIds = leagueTournaments.map((t: any) => t.id)
  const { data: leagueParticipants } = await db('tournament_participants')
    .select('team_id, user_id')
    .in('tournament_id', leagueTIds)

  const leagueIds = new Set((leagueParticipants ?? []).map((p: any) => p.team_id))
  if (!team_ids.every((id) => leagueIds.has(id))) {
    return Response.json({ error: 'All teams must be from this season\'s league' }, { status: 400 })
  }

  // No overlap with the other cup
  const otherType = CUP_TYPES.find((t) => t !== type)!
  const { data: otherTournaments } = await db('tournaments')
    .select('id')
    .eq('season_id', season_id)
    .eq('type', otherType)

  if (otherTournaments && otherTournaments.length > 0) {
    const { data: otherParticipants } = await db('tournament_participants')
      .select('team_id')
      .in('tournament_id', otherTournaments.map((t: any) => t.id))

    const otherIds = new Set((otherParticipants ?? []).map((p: any) => p.team_id))
    if (team_ids.some((id) => otherIds.has(id))) {
      return Response.json({ error: 'One or more teams are already in the other tournament' }, { status: 400 })
    }
  }

  // Final league standings ordered like the public standings page. Ranks are
  // per-division; Division 2 ranks are offset below Division 1 so higher
  // finishers seed into earlier pots.
  const rankByTeam = new Map<string, number>()
  let rankOffset = 0
  for (const leagueTournament of leagueTournaments) {
    const { data: standingsRows } = await db('standings')
      .select('team_id, points, goals_for, goals_against, gd_penalty, teams(name)')
      .eq('tournament_id', leagueTournament.id)

    const sorted = sortStandingsRows(standingsRows ?? [])
    for (const [idx, row] of sorted.entries()) {
      rankByTeam.set(row.team_id, rankOffset + idx + 1)
    }
    rankOffset += sorted.length
  }

  // Schedule cups after the last league fixture across both divisions
  const { data: lastLeagueFixture } = await db('fixtures')
    .select('scheduled_date')
    .in('tournament_id', leagueTIds)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const today = new Date().toISOString().split('T')[0]
  let scheduleStart = today
  if (lastLeagueFixture?.scheduled_date) {
    const nextDay = new Date(lastLeagueFixture.scheduled_date)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().split('T')[0]
    if (nextDayStr > scheduleStart) scheduleStart = nextDayStr
  }

  // Create the tournament
  const { data: tournament } = await db('tournaments')
    .insert({
      season_id,
      name: CUP_NAMES[type],
      type,
      status: 'active',
      settings: {
        start_date: scheduleStart,
        fixture_mode: 'groups',
        num_groups,
        num_rounds: 2,
        qualifiers_per_group,
      },
    })
    .select('id')
    .single()

  if (!tournament) return Response.json({ error: 'Failed to create tournament' }, { status: 500 })

  const tId = tournament.id

  const userByTeam = new Map<string, string | null>()
  for (const p of leagueParticipants ?? []) {
    if (p.team_id) userByTeam.set(p.team_id, p.user_id ?? null)
  }

  const { data: insertedParticipants } = await db('tournament_participants').insert(
    team_ids.map((team_id) => ({ tournament_id: tId, team_id, user_id: userByTeam.get(team_id) ?? null }))
  ).select('id, team_id')

  const participantByTeamId = new Map<string, string>()
  for (const row of insertedParticipants ?? []) {
    if (row.team_id) participantByTeamId.set(row.team_id, row.id)
  }

  // Seeded draw — league position determines pot (higher finishers spread across groups)
  const teamsPayload = team_ids.map((team_id) => ({
    id: team_id,
    rank: rankByTeam.get(team_id) ?? 999,
    label: '',
  }))

  const drawResult = drawGroups({ teams: teamsPayload, groupCount: num_groups })

  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const groups = new Map<number, string[]>()
  for (const a of drawResult.groups) {
    if (!groups.has(a.group)) groups.set(a.group, [])
    groups.get(a.group)!.push(a.teamId)
  }

  for (const [groupIdx, groupTeamIds] of groups) {
    const groupName = groupNames[groupIdx] ?? `Group ${groupIdx + 1}`
    for (const teamId of groupTeamIds) {
      const pot = drawResult.groups.find((a) => a.teamId === teamId)?.pot ?? 0
      await db('tournament_participants')
        .update({ group_name: groupName, seed_pot: pot })
        .eq('tournament_id', tId)
        .eq('team_id', teamId)
    }
  }

  const allGroupTeams: Record<string, string[]> = {}
  for (const [groupIdx, groupTeamIds] of groups) {
    const groupName = groupNames[groupIdx] ?? `Group ${groupIdx + 1}`
    allGroupTeams[groupName] = groupTeamIds

    for (const teamId of groupTeamIds) {
      await (db('group_standings') as any).upsert({
        tournament_id: tId, group_name: groupName, team_id: teamId,
        participant_id: participantByTeamId.get(teamId) ?? null,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, points: 0,
      }, { onConflict: 'tournament_id,group_name,participant_id' })
    }
  }

  const groupFixtures = await generateGroupFixtures(adminSupabase, allGroupTeams, 2, scheduleStart, tId)

  if (groupFixtures.length > 0) {
    const stamped = await stampFixtureParticipants(adminSupabase, tId, groupFixtures)
    await db('fixtures').insert(
      stamped.map((f) => ({
        tournament_id: tId, home_team_id: f.home_team_id, away_team_id: f.away_team_id,
        home_participant_id: f.home_participant_id, away_participant_id: f.away_participant_id,
        matchday: f.matchday, scheduled_date: f.scheduled_date, deadline: f.deadline,
        round_type: f.round_type, leg: f.leg, status: 'scheduled', is_postponed: false,
      }))
    )
  }

  // Notify participating managers
  const { data: teams } = await db('teams')
    .select('id, name, manager_id')
    .in('id', team_ids)

  const managedTeams = (teams ?? []).filter((t: any) => t.manager_id)
  if (managedTeams.length > 0) {
    await db('notifications').insert(
      managedTeams.map((t: any) => ({
        user_id: t.manager_id as string,
        type: 'fixtures_released',
        title: 'Fixtures Released',
        body: `${CUP_NAMES[type]} fixtures are now live!`,
        data: { tournament_id: tId, tournament: CUP_NAMES[type] },
      }))
    )
  }

  await db('audit_log').insert({
    admin_id: user.id,
    action: 'start_tournament',
    target_type: 'tournament',
    target_id: tId,
    details: {
      season_id,
      type,
      name: CUP_NAMES[type],
      teams: team_ids.length,
      groups: num_groups,
      qualifiers_per_group,
      fixtures: groupFixtures.length,
      schedule_start: scheduleStart,
    },
  })

  return Response.json({
    success: true,
    tournament_id: tId,
    fixtures: groupFixtures.length,
    schedule_start: scheduleStart,
  })
}
