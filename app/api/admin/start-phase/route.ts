import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateLeagueFixtures } from '@/lib/fixture-generator'
import { buildSeasonCalendar, isSeasonPresetId, type SeasonPresetId } from '@/lib/season-calendar'
import { resolveUserClubId, stampFixtureParticipants } from '@/lib/slot-utils'

interface TeamInput {
  id: string | null
  name: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

interface DivisionInput {
  users?: string[]
  teams?: TeamInput[]
}

interface DivisionConfig {
  name: string
  division: number
  zones: Record<string, number>
  input: DivisionInput
}

interface DivisionResult {
  tournamentId: string
  teamIds: string[]
  slots: { user_id: string | null; team_id: string }[]
  fixtures: number
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

// Season dates come from the season calendar (see lib/season-calendar.ts), so
// the old fixture-count end-date estimate is gone.

export async function POST(request: Request) {  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    season_name: string
    start_date: string
    preset?: SeasonPresetId
    league_teams?: TeamInput[]
    league_users?: string[]
    division1_teams?: TeamInput[]
    division2_teams?: TeamInput[]
    division1_users?: string[]
    division2_users?: string[]
  }

  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    season_name, start_date, league_teams, league_users,
    division1_teams, division2_teams, division1_users, division2_users,
  } = body

  const preset: SeasonPresetId = isSeasonPresetId(body.preset) ? body.preset : 'full'

  if (!season_name?.trim() || !start_date) {
    return Response.json({ error: 'season_name and start_date are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // Resolve each division's slots: user-driven (each user's current club) or
  // legacy bare teams. When no division payloads are sent the old single-league
  // shape (league_teams / league_users) is honoured as Division 1 only.
  async function resolveDivisionSlots(input: DivisionInput): Promise<{ user_id: string | null; team_id: string }[]> {
    if (input.users && input.users.length > 0) {
      const slots: { user_id: string | null; team_id: string }[] = []
      for (const uid of input.users) {
        const team_id = await resolveUserClubId(adminSupabase, uid)
        if (!team_id) return []
        slots.push({ user_id: uid, team_id })
      }
      return slots
    }
    const ids = await resolveTeams(adminSupabase, input.teams ?? [])
    return ids.map((team_id) => ({ user_id: null, team_id }))
  }

  const d1Teams = (division1_teams ?? [])
  const d2Teams = (division2_teams ?? [])
  const d1Users = (division1_users ?? [])
  const d2Users = (division2_users ?? [])
  const hasDivisionPayload = d1Teams.length > 0 || d2Teams.length > 0 || d1Users.length > 0 || d2Users.length > 0

  const divisions: DivisionConfig[] = hasDivisionPayload
    ? [
        { name: 'EFA Premier League', division: 1, zones: { bottom_yellow: 2, bottom_red: 3 }, input: { users: d1Users, teams: d1Teams } },
        { name: 'EFA Championship', division: 2, zones: { top_green: 3, top_yellow: 2 }, input: { users: d2Users, teams: d2Teams } },
      ]
    : [
        { name: 'EFA Premier League', division: 1, zones: { bottom_yellow: 2, bottom_red: 3 }, input: { users: league_users, teams: league_teams } },
      ]

  const numRounds = 2

  // Resolve every division BEFORE the season row is written, so an invalid
  // payload cannot leave an orphan season behind and so the calendar can be
  // sized off the longest division.
  const resolvedDivisions: Array<{ config: DivisionConfig; slots: { user_id: string | null; team_id: string }[] }> = []
  for (const config of divisions) {
    const slots = await resolveDivisionSlots(config.input)
    if (slots.length < 2) continue
    if (slots.length % 2 !== 0) {
      return Response.json({ error: `${config.name} must have an even number of participants` }, { status: 400 })
    }
    resolvedDivisions.push({ config, slots })
  }

  if (resolvedDivisions.length === 0) {
    return Response.json({ error: 'At least one division needs 2+ participants' }, { status: 400 })
  }

  const seasonStart = start_date
  // One league round = one calendar day, so the longest division decides how
  // many league days the season needs. Cups are woven in as break windows.
  const leagueRounds = Math.max(...resolvedDivisions.map((d) => d.slots.length - 1))
  const calendar = buildSeasonCalendar(seasonStart, leagueRounds, preset)
  const end_date = calendar.endDate

  const seasonRes = await db('seasons')
    .insert({
      name: season_name,
      base_league: 'EFA Premier League',
      status: 'active',
      start_date: seasonStart,
      end_date,
      settings: { preset, calendar },
    })
    .select('id')
    .single()

  if (!seasonRes) {
    return Response.json({ error: 'Failed to create season' }, { status: 500 })
  }

  const season_id = seasonRes.id

  const results: DivisionResult[] = []
  for (const { config, slots } of resolvedDivisions) {
    const teamIds = slots.map((s) => s.team_id)
    // A division plays the first `n - 1` league days of the shared calendar, so
    // both divisions kick off on the same date and their cup breaks line up.
    const roundDates = calendar.leagueDays.slice(0, teamIds.length - 1)

    const { data: leagueTournament } = await db('tournaments')
      .insert({
        season_id,
        name: config.name,
        type: 'league',
        division: config.division,
        status: 'active',
        settings: {
          start_date: seasonStart,
          end_date,
          fixture_mode: 'round_robin',
          num_rounds: numRounds,
          division: config.division,
          standings_zones: config.zones,
          season_preset: preset,
          round_dates: roundDates,
        },
      })
      .select('id')
      .single()

    if (!leagueTournament) return Response.json({ error: `Failed to create ${config.name} tournament` }, { status: 500 })

    const leagueTId = leagueTournament.id

    const { data: insertedParticipants } = await db('tournament_participants').insert(
      slots.map((s) => ({ tournament_id: leagueTId, team_id: s.team_id, user_id: s.user_id }))
    ).select('id, team_id')

    const participantByTeamId = new Map<string, string>()
    for (const row of insertedParticipants ?? []) {
      if (row.team_id) participantByTeamId.set(row.team_id, row.id)
    }

    await db('standings').insert(
      teamIds.map((team_id) => ({
        tournament_id: leagueTId, team_id,
        participant_id: participantByTeamId.get(team_id) ?? null,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, points: 0,
        form: '', unbeaten_run: 0, clean_sheets: 0,
      }))
    )

    const leagueFixtures = await generateLeagueFixtures(adminSupabase, teamIds, leagueTId, numRounds, seasonStart, {
      roundDates,
    })

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

    results.push({ tournamentId: leagueTId, teamIds, slots, fixtures: leagueFixtures.length })
  }

  const allTeamIds = results.flatMap((r) => r.teamIds)
  const totalFixtures = results.reduce((sum, r) => sum + r.teamIds.length * (r.teamIds.length - 1), 0)

  await db('seasons').update({ end_date }).eq('id', season_id)

  const { data: allTeamRows } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .in('id', allTeamIds)

  const managedTeams = (allTeamRows ?? []).filter((t: any) => t.manager_id)
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
      preset,
      league_rounds: leagueRounds,
      calendar_windows: calendar.windows.map((w) => ({ key: w.key, days: w.days.length, start: w.start, end: w.end })),
      divisions: results.map((r) => ({
        team_ids: r.teamIds,
        league_fixtures: r.fixtures,
      })),
      total_fixtures: totalFixtures,
    },
  })

  return Response.json({
    success: true,
    season_id,
    end_date,
    preset,
    calendar: {
      total_days: calendar.totalDays,
      league_days: calendar.leagueDays.length,
      windows: calendar.windows.map((w) => ({ key: w.key, start: w.start, end: w.end, days: w.days.length })),
    },
    fixtures: {
      divisions: results.map((r) => r.fixtures),
      total: totalFixtures,
    },
  })
}