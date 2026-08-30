import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  listOpenSeasons,
  userInSeason,
  getSeasonPickableTeams,
} from '@/lib/season-applications'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { season_id, team_id } = await request.json()
  if (!season_id || !team_id) {
    return Response.json({ error: 'season_id and team_id are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Season must be open (active with at least one vacant seat)
  const openSeasons = await listOpenSeasons(adminSupabase)
  const open = openSeasons.find((s: any) => s.season_id === season_id)
  if (!open) {
    return Response.json({ error: 'This season is not currently accepting applications.' }, { status: 409 })
  }

  // User must not already hold a seat in this season
  if (await userInSeason(adminSupabase, season_id, user.id)) {
    return Response.json({ error: 'You are already in this season.' }, { status: 409 })
  }

  // No duplicate pending application
  const { data: existing } = await adminSupabase
    .from('tournament_applications')
    .select('id, status')
    .eq('applicant_id', user.id)
    .eq('season_id', season_id)
    .eq('status', 'pending')

  if (existing && existing.length > 0) {
    return Response.json({ error: 'You already have a pending application for this season.' }, { status: 409 })
  }

  // The chosen club must exist and be unmanaged
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', team_id)
    .single()

  if (!team) return Response.json({ error: 'Team not found.' }, { status: 404 })
  if (team.manager_id) {
    return Response.json({ error: 'This team is taken. Pick another team.' }, { status: 409 })
  }

  // The club must be legitimately part of the season's pickable universe
  const pickable = await getSeasonPickableTeams(adminSupabase, season_id)
  if (!pickable.some((t: any) => t.id === team_id)) {
    return Response.json({
      error: 'This club is not part of an open season. Pick any club from the available leagues.',
    }, { status: 409 })
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: inserted, error: insertErr } = await adminSupabase
    .from('tournament_applications')
    .insert({
      season_id,
      applicant_id: user.id,
      team_id,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  return Response.json({ success: true, application_id: inserted.id, expires_at: expiresAt })
}