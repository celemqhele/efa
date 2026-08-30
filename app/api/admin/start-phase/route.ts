import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures } from '@/lib/fixture-generator'
import { resolveUserClubId, stampFixtureParticipants } from '@/lib/slot-utils'
import { addDays, format } from 'date-fns'

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
    league_teams?: TeamInput[]
    league_users?: string[]
  }

  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { season_name, start_date, league_teams, league_users } = body

  if (!season_name?.trim() || !start_date) {
    return Response.json({ error: 'season_name and start_date are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // Resolve slots: user-driven (each user's current club) or legacy bare teams
  let slotEntries: { user_id: string | null; team_id: string }[] = []
  if (league_users && league_users.length > 0) {
    for (const uid of league_users) {
      const team_id = await resolveUserClubId(adminSupabase, uid)
      if (!team_id) return Response.json({ error: 'Every user must currently manage a team' }, { status: 400 })
      slotEntries.push({ user_id: uid, team_id })
    }
  } else {
    const leagueIds = await resolveTeams(adminSupabase, league_teams ?? [])
    slotEntries = leagueIds.map((team_id) => ({ user_id: null, team_id }))
  }

  if (slotEntries.length < 2) {
    return Response.json({ error: 'At least 2 league participants required' }, { status: 400 })
  }
  if (slotEntries.length % 2 !== 0) {
    return Response.json({ error: 'League must have an even number of participants' }, { status: 400 })
  }

  const leagueIds = slotEntries.map((s) => s.team_id)

  const numRounds = 2
  const leagueFixtureCount = leagueIds.length * (leagueIds.length - 1) * numRounds / 2

  const end_date = computeEndDate(start_date, leagueFixtureCount)

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

  // League tournament — UCL/UEL are started separately once the league finishes
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

  const { data: insertedParticipants } = await db('tournament_participants').insert(
    slotEntries.map((s) => ({ tournament_id: leagueTId, team_id: s.team_id, user_id: s.user_id }))
  ).select('id, team_id')

  const participantByTeamId = new Map<string, string>()
  for (const row of insertedParticipants ?? []) {
    if (row.team_id) participantByTeamId.set(row.team_id, row.id)
  }

  await db('standings').insert(
    leagueIds.map((team_id) => ({
      tournament_id: leagueTId, team_id,
      participant_id: participantByTeamId.get(team_id) ?? null,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, points: 0,
      form: '', unbeaten_run: 0, clean_sheets: 0,
    }))
  )

  const leagueFixtures = await generateLeagueFixtures(adminSupabase, leagueIds, leagueTId, numRounds, start_date)

  if (leagueFixtures.length > 0) {
    const stamped = await stampFixtureParticipants(adminSupabase, leagueTId, leagueFixtures)
    await db('fixtures').insert(
      stamped.map((f) => ({
        tournament_id: leagueTId, home_team_id: f.home_team_id, away_team_id: f.away_team_id,
        home_participant_id: f.home_participant_id, away_participant_id: f.away_participant_id,
        matchday: f.matchday, scheduled_date: f.scheduled_date, deadline: f.deadline,
        round_type: f.round_type, leg: f.leg, status: 'scheduled', is_postponed: false,
      }))
    )
  }

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
      league_fixtures: leagueFixtures.length,
    },
  })

  return Response.json({
    success: true,
    season_id,
    end_date,
    fixtures: {
      league: leagueFixtures.length,
      total: leagueFixtures.length,
    },
  })
}
