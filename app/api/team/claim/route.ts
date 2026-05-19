import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { team_id } = body

  if (!team_id) {
    return Response.json({ error: 'team_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get or create the profile row (trigger may not have fired yet on fresh signup)
  let { data: profile } = await adminSupabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const username = (user.user_metadata?.username as string | undefined) ?? user.email?.split('@')[0] ?? 'manager'
    const { error: createErr } = await adminSupabase
      .from('profiles')
      .insert({ id: user.id, username, role: 'manager' })
    if (createErr) return Response.json({ error: 'Failed to create profile: ' + createErr.message }, { status: 500 })
    profile = { username }
  }

  // Find the team
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', team_id)
    .single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })

  if (team.manager_id) {
    return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
  }

  // Assign manager
  const { error: updateErr } = await adminSupabase
    .from('teams')
    .update({ manager_id: user.id })
    .eq('id', team_id)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Update profile avatar if team has a logo
  if (team.logo_league_folder && team.logo_team_slug) {
    const avatarUrl = `/logos/${team.logo_league_folder}/128x128/${team.logo_team_slug}.png`
    await adminSupabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
  }

  // Close any existing open tenure for this team (safety guard)
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: new Date().toISOString() })
    .eq('team_id', team_id)
    .is('ended_at', null)

  // Open new tenure
  await adminSupabase
    .from('manager_tenures' as any)
    .insert({
      team_id: team_id,
      manager_id: user.id,
      manager_username: profile.username,
      started_at: new Date().toISOString(),
    })

  return Response.json({ success: true, team_id })
}
