import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type TournamentType = Database['public']['Tables']['tournaments']['Insert']['type']

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
  const { data: _adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any
  const adminProfile = _adminProfile as any

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    season_id?: string
    season_name?: string
    base_league?: string
    name: string
    type: TournamentType
    start_date?: string
    end_date?: string
    teams: {
      id: string | null
      name: string
      logo_league_folder: string
      logo_team_slug: string
      manager_id: string | null
    }[]
    settings?: any
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    season_id,
    season_name,
    base_league,
    name,
    type,
    start_date,
    end_date,
    teams,
    settings: customSettings,
  } = body

  if (!name || !type || !teams || teams.length === 0) {
    return Response.json(
      { error: 'name, type, and teams are required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()

  // 1. Resolve all team IDs (create them if they don't exist)
  const db = (table: string) => adminSupabase.from(table) as any

  const resolvedTeamIds: string[] = []
  for (const team of teams) {
    if (team.id) {
      resolvedTeamIds.push(team.id)
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
        resolvedTeamIds.push(existing.id)
        if (team.manager_id) {
          await db('teams').update({ manager_id: team.manager_id }).eq('id', existing.id).is('manager_id', null)
        }
      } else {
        const { data: newTeam, error: createErr } = await db('teams')
          .insert({
            name: team.name,
            logo_league_folder: team.logo_league_folder,
            logo_team_slug: team.logo_team_slug,
            manager_id: team.manager_id,
            abandon_count: 0
          })
          .select('id')
          .single()

        if (createErr || !newTeam) {
          return Response.json({ error: `Failed to create team ${team.name}: ${createErr?.message}` }, { status: 500 })
        }
        resolvedTeamIds.push(newTeam.id)
      }
    }
  }

  let resolvedSeasonId: string | null = season_id ?? null

  if (!resolvedSeasonId && season_name) {
    const { data: newSeason, error: seasonError } = await db('seasons')
      .insert({
        name: season_name,
        base_league: base_league ?? 'default',
        status: 'active',
      })
      .select('id')
      .single()

    if (seasonError || !newSeason) {
      return Response.json(
        { error: seasonError?.message ?? 'Failed to create season' },
        { status: 500 }
      )
    }

    resolvedSeasonId = newSeason.id
  }

  const settings = {
    ...(start_date ? { start_date } : {}),
    ...(end_date ? { end_date } : {}),
    ...customSettings,
  }

  const { data: tournament, error: tournamentError } = await db('tournaments')
    .insert({
      season_id: resolvedSeasonId,
      name,
      type,
      status: 'active',
      settings,
    })
    .select('id')
    .single()

  if (tournamentError || !tournament) {
    return Response.json(
      { error: tournamentError?.message ?? 'Failed to create tournament' },
      { status: 500 }
    )
  }

  const tournament_id = tournament.id

  const participantRows = resolvedTeamIds.map((team_id) => ({
    tournament_id,
    team_id,
  }))

  const { error: participantsError } = await db('tournament_participants')
    .insert(participantRows)

  if (participantsError) {
    return Response.json({ error: participantsError.message }, { status: 500 })
  }

  if (type === 'league') {
    const standingRows = resolvedTeamIds.map((team_id) => ({
      tournament_id,
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

    const { error: standingsError } = await db('standings')
      .insert(standingRows)

    if (standingsError) {
      console.error('Failed to create standings:', standingsError.message)
    }
  } else if (type === 'friendlies' && resolvedTeamIds.length === 2) {
    // Create a single friendly fixture
    const fixtureDate = start_date ?? new Date().toISOString().slice(0, 10)
    const { error: fixtureErr } = await db('fixtures').insert({
      tournament_id,
      home_team_id: resolvedTeamIds[0],
      away_team_id: resolvedTeamIds[1],
      matchday: 1,
      leg: 1,
      scheduled_date: fixtureDate,
      deadline: fixtureDate,
      round_type: null,
      status: 'scheduled',
      is_postponed: false,
    })
    if (fixtureErr) {
      console.error('Failed to create friendly fixture:', fixtureErr.message)
    }
  }

  await db('audit_log').insert({
    admin_id: user.id,
    action: 'create_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {
      name,
      type,
      season_id: resolvedSeasonId,
      team_count: resolvedTeamIds.length,
    },
  })

  return Response.json({ success: true, tournament_id })
}
