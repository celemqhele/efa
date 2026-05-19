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
      .insert({ id: user.id, username, role: 'user' })
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

  if (team.manager_id && team.manager_id !== user.id) {
    return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
  }

  // Find all rows for the same real-world club (same logo slug = same club across phases).
  // This is needed because admins may have added the same club to multiple phases as separate rows.
  let allClubIds: string[] = [team_id]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams')
      .select('id, manager_id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', team_id)

    const takenBySomeoneElse = (siblings ?? []).find(
      (s) => s.manager_id && s.manager_id !== user.id
    )
    if (takenBySomeoneElse) {
      return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
    }

    allClubIds = [team_id, ...(siblings ?? []).map((s) => s.id)]
  }

  // Assign manager to the claimed row AND all sibling rows for the same club
  const { error: updateErr } = await adminSupabase
    .from('teams')
    .update({ manager_id: user.id })
    .in('id', allClubIds)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Update profile avatar if team has a logo
  if (team.logo_league_folder && team.logo_team_slug) {
    const avatarUrl = `/logos/${team.logo_league_folder}/128x128/${team.logo_team_slug}.png`
    await adminSupabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
  }

  const now = new Date().toISOString()

  // Close any existing open tenures for all club rows (safety guard)
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  // Open new tenures for all club rows
  await adminSupabase
    .from('manager_tenures' as any)
    .insert(
      allClubIds.map((id) => ({
        team_id: id,
        manager_id: user.id,
        manager_username: profile.username,
        started_at: now,
      }))
    )

  return Response.json({ success: true, team_id })
}
