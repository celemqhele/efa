import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { team_id, logo_folder, logo_team_slug: logo_slug, team_name } = body

  if (!team_id && (!logo_folder || !logo_slug)) {
    return Response.json({ error: 'team_id or logo info required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get or create profile
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

  // Resolve the team_id — either from body or by finding/creating a row for this club slug
  let resolvedTeamId: string = team_id

  if (!team_id) {
    // Find existing team rows for this slug
    const { data: existingTeams } = await adminSupabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .eq('logo_team_slug', logo_slug)

    // If all existing rows are managed by someone else — taken
    if ((existingTeams ?? []).length > 0 && (existingTeams ?? []).every((t) => t.manager_id && t.manager_id !== user.id)) {
      return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
    }

    // Use an existing unmanaged row if available
    const availableRow = (existingTeams ?? []).find((t) => !t.manager_id)
    if (availableRow) {
      resolvedTeamId = availableRow.id
    } else {
      // Create a new team row for this club
      const name = team_name || logo_slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const { data: newTeam, error: createErr } = await adminSupabase
        .from('teams')
        .insert({ name, logo_league_folder: logo_folder, logo_team_slug: logo_slug, abandon_count: 0 })
        .select('id')
        .single()

      if (createErr || !newTeam) return Response.json({ error: 'Failed to create team: ' + (createErr?.message ?? '') }, { status: 500 })
      resolvedTeamId = newTeam.id
    }
  }

  // Find the team
  const { data: team } = await adminSupabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', resolvedTeamId)
    .single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })

  if (team.manager_id && team.manager_id !== user.id) {
    return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
  }

  // Find all sibling rows for the same real-world club
  let allClubIds: string[] = [resolvedTeamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams')
      .select('id, manager_id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', resolvedTeamId)

    const takenBySomeoneElse = (siblings ?? []).find(
      (s) => s.manager_id && s.manager_id !== user.id
    )
    if (takenBySomeoneElse) {
      return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
    }

    allClubIds = [resolvedTeamId, ...(siblings ?? []).map((s) => s.id)]
  }

  // Assign manager to all club rows
  const { error: updateErr } = await adminSupabase
    .from('teams')
    .update({ manager_id: user.id })
    .in('id', allClubIds)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Update profile avatar
  if (team.logo_league_folder && team.logo_team_slug) {
    const avatarUrl = `/logos/${team.logo_league_folder}/128x128/${team.logo_team_slug}.png`
    await adminSupabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
  }

  const now = new Date().toISOString()

  // Close any existing open tenures
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  // Open new tenures
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

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'claim_team',
    target_type: 'team',
    target_id: resolvedTeamId,
    details: { team_name: team?.name, user_id: user.id, username: profile.username },
  })

  return Response.json({ success: true, team_id: resolvedTeamId })
}
