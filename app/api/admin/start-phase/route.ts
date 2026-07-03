import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures, generateGroupFixtures } from '@/lib/fixture-generator'
import { drawGroups } from '@/lib/tournament-draw'
import { addDays, format, differenceInDays } from 'date-fns'

interface TeamInput {
  id: string | null
  name: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

async function resolveTeams(adminSupabase: any, teams: TeamInput[]): Promise<string[]> {
  const db = (table: string) => adminSupabase.from(table) as any
  const resolved: string[] = []

  for (const team of teams) {
    if (team.id) {
      resolved.push(team.id)
      if (team.manager_id) {
        await db('teams').update({ manager_id: team.manager_id }).eq('id', team.id).is('manager_id', null)
      }
    } else {
      const { data: existing } = await db('teams')
        .select('id')
        .eq('logo_team_slug', team.logo_team_slug)
        .eq('logo_league_folder', team.logo_league_folder)
        .maybeSingle()

      if (existing) {
        resolved.push(existing.id)
        if (team.manager_id) {
          await db('teams').update({ manager_id: team.manager_id }).eq('id', existing.id).is('manager_id', null)
        }
      } else {
        const { data: newTeam } = await db('teams')
          .insert({
            name: team.name,
            logo_league_folder: team.logo_league_folder,
            logo_team_slug: team.logo_team_slug,
            manager_id: team.manager_id,
            abandon_count: 0,
          })
          .select('id')
          .single()

        if (newTeam) resolved.push(newTeam.id)
      }
    }
  }

  return resolved
}

function computeEndDate(startDate: string, totalFixtures: number, dailyCap: number = 15): string {
  const days = Math.max(7, Math.ceil(totalFixtures / dailyCap))
  return format(addDays(new Date(startDate), days), 'yyyy-MM-dd')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    season_name: string
    start_date: string
    league_teams: TeamInput[]
    ucl_teams: TeamInput[]
    europa_teams: TeamInput[]
    ucl_num_groups?: number
    ucl_num_rounds?: number
    ucl_qualifiers_per_group?: number
    europa_num_groups?: number
    europa_num_rounds?: number
    europa_qualifiers_per_group?: number
  }

  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    season_name, start_date,
    league_teams, ucl_teams, europa_teams,
    ucl_num_groups = 2,
    ucl_num_rounds = 2,
    ucl_qualifiers_per_group = 2,
    europa_num_groups = 2,
    europa_num_rounds = 2,
    europa_qualifiers_per_group = 2,
  } = body

  if (!season_name?.trim() || !start_date) {
    return Response.json({ error: 'season_name and start_date are required' }, { status: 400 })
  }
  if (!league_teams || league_teams.length < 2) {
    return Response.json({ error: 'At least 2 league teams required' }, { status: 400 })
  }
  if (league_teams.length % 2 !== 0) {
    return Response.json({ error: 'League must have an even number of teams' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  const leagueIds = await resolveTeams(adminSupabase, league_teams)

  const uclIds = ucl_teams.length > 0 ? await resolveTeams(adminSupabase, ucl_teams) : []
  const europaIds = europa_teams.length > 0 ? await resolveTeams(adminSupabase, europa_teams) : []

  if (!uclIds.every((id) => leagueIds.includes(id))) {
    return Response.json({ error: 'All UCL teams must be in the league' }, { status: 400 })
  }
  if (!europaIds.every((id) => leagueIds.includes(id))) {
    return Response.json({ error: 'All Europa teams must be in the league' }, { status: 400 })
  }

  const numRounds = 2
  const leagueFixtureCount = leagueIds.length * (leagueIds.length - 1) * numRounds / 2

  let uclFixtureCount = 0
  let europaFixtureCount = 0
  if (uclIds.length > 0) {
    const teamsPerGroup = Math.floor(uclIds.length / ucl_num_groups)
    uclFixtureCount = ucl_num_groups * teamsPerGroup * (teamsPerGroup - 1) * ucl_num_rounds / 2
  }
  if (europaIds.length > 0) {
    const teamsPerGroup = Math.floor(europaIds.length / europa_num_groups)
    europaFixtureCount = europa_num_groups * teamsPerGroup * (teamsPerGroup - 1) * europa_num_rounds / 2
  }

  const totalFixtures = leagueFixtureCount + uclFixtureCount + europaFixtureCount
  const end_date = computeEndDate(start_date, totalFixtures)

  const seasonRes = await db('seasons')
    .insert({
      name: season_name,
      base_league: 'EFA Premier League',
      status: 'active',
      start_date,
      end_date,
    })
    .select('id')
    .single()

  if (!seasonRes) {
    return Response.json({ error: 'Failed to create season' }, { status: 500 })
  }

  const season_id = seasonRes.id

  // League tournament
  const { data: leagueTournament } = await db('tournaments')
    .insert({
      season_id,
      name: 'EFA Premier League',
      type: 'league',
      status: 'active',
      settings: { start_date, end_date, fixture_mode: 'round_robin', num_rounds: numRounds },
    })
    .select('id')
    .single()

  if (!leagueTournament) return Response.json({ error: 'Failed to create league tournament' }, { status: 500 })

  const leagueTId = leagueTournament.id

  await db('tournament_participants').insert(
    leagueIds.map((team_id) => ({ tournament_id: leagueTId, team_id }))
  )

  await db('standings').insert(
    leagueIds.map((team_id) => ({
      tournament_id: leagueTId, team_id,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, points: 0,
      form: '', unbeaten_run: 0, clean_sheets: 0,
    }))
  )

  const leagueFixtures = await generateLeagueFixtures(adminSupabase, leagueIds, leagueTId, numRounds, start_date)

  if (leagueFixtures.length > 0) {
    await db('fixtures').insert(
      leagueFixtures.map((f) => ({
        tournament_id: leagueTId, home_team_id: f.home_team_id, away_team_id: f.away_team_id,
        matchday: f.matchday, scheduled_date: f.scheduled_date, deadline: f.deadline,
        round_type: f.round_type, leg: f.leg, status: 'scheduled', is_postponed: false,
      }))
    )
  }

  // UCL tournament
  async function createGroupTournament(
    name: string, type: string, teamIds: string[], numGroups: number, numRounds: number, qualifiersPerGroup: number,
  ) {
    if (teamIds.length === 0) return { id: null, fixtureCount: 0 }

    const { data: tournament } = await db('tournaments')
      .insert({
        season_id, name, type, status: 'active',
        settings: { start_date, end_date, fixture_mode: 'groups', num_groups: numGroups, num_rounds: numRounds, qualifiers_per_group: qualifiersPerGroup },
      })
      .select('id')
      .single()

    if (!tournament) return { id: null, fixtureCount: 0 }

    const tId = tournament.id

    await db('tournament_participants').insert(
      teamIds.map((team_id) => ({ tournament_id: tId, team_id }))
    )

    const teamsPayload = teamIds.map((team_id, i) => ({
      id: team_id, rank: 0, label: '',
    }))

    const drawResult = drawGroups({ teams: teamsPayload, groupCount: numGroups })

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
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, points: 0,
        }, { onConflict: 'tournament_id,group_name,team_id' })
      }
    }

    const groupFixtures = await generateGroupFixtures(adminSupabase, allGroupTeams, numRounds, start_date)

    if (groupFixtures.length > 0) {
      await db('fixtures').insert(
        groupFixtures.map((f) => ({
          tournament_id: tId, home_team_id: f.home_team_id, away_team_id: f.away_team_id,
          matchday: f.matchday, scheduled_date: f.scheduled_date, deadline: f.deadline,
          round_type: f.round_type, leg: f.leg, status: 'scheduled', is_postponed: false,
        }))
      )
    }

    return { id: tId, fixtureCount: groupFixtures.length }
  }

  const { id: uclTId, fixtureCount: uclFxtCount } = await createGroupTournament(
    'EFA Tournament (Clubs)', 'tournament_club', uclIds, ucl_num_groups, ucl_num_rounds, ucl_qualifiers_per_group,
  )
  const { id: europaTId, fixtureCount: europaFxtCount } = await createGroupTournament(
    'EFA Tournament (International)', 'tournament_international', europaIds, europa_num_groups, europa_num_rounds, europa_qualifiers_per_group,
  )

  const { data: allTeamRows } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .in('id', leagueIds)

  const managedTeams = (allTeamRows ?? []).filter((t) => t.manager_id)
  if (managedTeams.length > 0) {
    await db('notifications').insert(
      managedTeams.map((t: any) => ({
        user_id: t.manager_id as string,
        type: 'fixtures_released',
        title: 'Phase Started!',
        body: `${season_name} has kicked off — your fixtures are live!`,
        data: { season_id },
      }))
    )
  }

  await db('audit_log').insert({
    admin_id: user.id,
    action: 'start_phase',
    target_type: 'season',
    target_id: season_id,
    details: {
      season_name, start_date, end_date,
      league_teams: leagueIds.length,
      ucl_teams: uclIds.length,
      europa_teams: europaIds.length,
      league_fixtures: leagueFixtures.length,
      ucl_fixtures: uclFxtCount,
      europa_fixtures: europaFxtCount,
    },
  })

  return Response.json({
    success: true,
    season_id,
    end_date,
    fixtures: {
      league: leagueFixtures.length,
      ucl: uclFxtCount,
      europa: europaFxtCount,
      total: leagueFixtures.length + uclFxtCount + europaFxtCount,
    },
  })
}
