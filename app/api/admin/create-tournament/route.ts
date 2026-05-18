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
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    season_id?: string
    season_name?: string
    base_league?: string
    name: string
    type: TournamentType
    start_date: string
    end_date: string
    team_ids: string[]
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
    team_ids,
  } = body

  if (!name || !type || !start_date || !end_date || !team_ids || team_ids.length === 0) {
    return Response.json(
      { error: 'name, type, start_date, end_date and team_ids are required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()

  let resolvedSeasonId: string | null = season_id ?? null

  // Create season if season_name provided but no season_id
  if (!resolvedSeasonId && season_name) {
    const { data: newSeason, error: seasonError } = await adminSupabase
      .from('seasons')
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

  // Create tournament
  const { data: tournament, error: tournamentError } = await adminSupabase
    .from('tournaments')
    .insert({
      season_id: resolvedSeasonId,
      name,
      type,
      status: 'active',
      settings: { start_date, end_date },
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

  // Insert tournament participants
  const participantRows = team_ids.map((team_id) => ({
    tournament_id,
    team_id,
  }))

  const { error: participantsError } = await adminSupabase
    .from('tournament_participants')
    .insert(participantRows)

  if (participantsError) {
    return Response.json({ error: participantsError.message }, { status: 500 })
  }

  // Create standings rows for league type
  if (type === 'league') {
    const standingRows = team_ids.map((team_id) => ({
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

    const { error: standingsError } = await adminSupabase
      .from('standings')
      .insert(standingRows)

    if (standingsError) {
      // Non-fatal but worth logging
      console.error('Failed to create standings:', standingsError.message)
    }
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'create_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {
      name,
      type,
      season_id: resolvedSeasonId,
      team_count: team_ids.length,
    },
  })

  return Response.json({ success: true, tournament_id })
}
