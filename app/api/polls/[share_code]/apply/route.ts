import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LEAGUE_META } from '@/lib/registry'
import { listOpenSeasons, userInSeason, getSeasonPickableTeams } from '@/lib/season-applications'

export async function POST(request: Request, { params }: { params: Promise<{ share_code: string }> }) {
  const { share_code } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { team_name, team_slug, team_league } = body

  if (!team_name || !team_slug || !team_league) {
    return Response.json({ error: 'team_name, team_slug, and team_league are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get poll
  const { data: poll } = await adminSupabase
    .from('polls' as any)
    .select('id, status, allowed_leagues, allowed_international, season_id')
    .eq('share_code', share_code)
    .single()

  if (!poll) return Response.json({ error: 'Poll not found' }, { status: 404 })
  if (poll.status !== 'open') return Response.json({ error: 'This poll is closed' }, { status: 400 })

  // If poll is linked to a season, create tournament_application instead of poll_application
  if (poll.season_id) {
    // Validate season is open and has vacant seats
    const openSeasons = await listOpenSeasons(adminSupabase)
    const season = openSeasons.find(s => s.season_id === poll.season_id)
    if (!season) {
      return Response.json({ error: 'This season is no longer accepting applications' }, { status: 400 })
    }

    // Validate team exists and is in the season's tournaments (pickable)
    const pickableTeams = await getSeasonPickableTeams(adminSupabase, poll.season_id)
    const team = pickableTeams.find(t => t.logo_team_slug === team_slug && t.logo_league_folder === team_league)
    if (!team) {
      return Response.json({ error: 'This team is not available for the selected season' }, { status: 400 })
    }

    // Check user not already in season
    const inSeason = await userInSeason(adminSupabase, poll.season_id, user.id)
    if (inSeason) {
      return Response.json({ error: 'You already have a team in this season' }, { status: 409 })
    }

    // Check no duplicate pending tournament application for this user and season
    const { data: existingApp } = await adminSupabase
      .from('tournament_applications' as any)
      .select('id')
      .eq('season_id', poll.season_id)
      .eq('applicant_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingApp) {
      return Response.json({ error: 'You already have a pending application for this season' }, { status: 409 })
    }

    // Check if team is already taken in tournament_applications for this season
    const { data: existingTeamApp } = await adminSupabase
      .from('tournament_applications' as any)
      .select('id')
      .eq('season_id', poll.season_id)
      .eq('team_id', team.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingTeamApp) {
      return Response.json({ error: 'This team has already been claimed' }, { status: 409 })
    }

    // Insert tournament application
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: app, error } = await adminSupabase
      .from('tournament_applications' as any)
      .insert({
        season_id: poll.season_id,
        applicant_id: user.id,
        team_id: team.id,
        poll_id: poll.id,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ application: app, tournament_application: true })
  }

  // Legacy poll behavior (no season_id)
  // Check if this team is already taken
  const { data: existing } = await adminSupabase
    .from('poll_applications' as any)
    .select('id')
    .eq('poll_id', poll.id)
    .eq('team_slug', team_slug)
    .eq('team_league', team_league)
    .neq('status', 'withdrawn')
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'This team has already been claimed' }, { status: 409 })
  }

  // Cleanup any lingering withdrawn applications for this team to avoid unique constraint violations
  await adminSupabase
    .from('poll_applications' as any)
    .delete()
    .eq('poll_id', poll.id)
    .eq('team_slug', team_slug)
    .eq('team_league', team_league)
    .eq('status', 'withdrawn')

  // National teams: only allow one application per user
  const meta = LEAGUE_META[team_league]
  if (meta?.isNational) {
    const { data: existingNational } = await adminSupabase
      .from('poll_applications' as any)
      .select('id')
      .eq('poll_id', poll.id)
      .eq('applicant_id', user.id)
      .neq('status', 'withdrawn')
      .maybeSingle()

    if (existingNational) {
      return Response.json({ error: 'You can only apply to one national team. Withdraw from your current application first.' }, { status: 409 })
    }
  }

  // Insert application
  const { data: app, error } = await adminSupabase
    .from('poll_applications' as any)
    .insert({
      poll_id: poll.id,
      applicant_id: user.id,
      team_name,
      team_slug,
      team_league,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ application: app })
}
