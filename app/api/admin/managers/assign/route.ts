import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { team_id, user_id, logo_league_folder, logo_team_slug, name } = await request.json()
  if (!user_id || (!team_id && (!logo_league_folder || !logo_team_slug))) {
    return Response.json({ error: 'user_id and (team_id or logo info) are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  let resolvedTeamId = team_id

  // 1. Resolve team (create if needed)
  if (!resolvedTeamId) {
    const { data: existing } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('logo_team_slug', logo_team_slug)
      .eq('logo_league_folder', logo_league_folder)
      .maybeSingle()

    if (existing) {
      resolvedTeamId = existing.id
    } else {
      const { data: newTeam, error: createErr } = await adminSupabase
        .from('teams')
        .insert({
          name: name || logo_team_slug,
          logo_league_folder,
          logo_team_slug,
          abandon_count: 0
        })
        .select('id')
        .single()
      if (createErr || !newTeam) return Response.json({ error: 'Failed to create team: ' + createErr?.message }, { status: 500 })
      resolvedTeamId = newTeam.id
    }
  }

  // Fetch team and target user profile in parallel
  const [{ data: team }, { data: targetProfile }] = await Promise.all([
    adminSupabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .eq('id', resolvedTeamId)
      .single(),
    adminSupabase
      .from('profiles')
      .select('id, username, sacked_at')
      .eq('id', user_id)
      .single(),
  ])

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })
  if (!targetProfile) return Response.json({ error: 'User not found' }, { status: 404 })

  // Enforce the 1-week reassignment cooldown after a sacking
  const SACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
  if (targetProfile.sacked_at) {
    const cooldownEnds = new Date(new Date(targetProfile.sacked_at).getTime() + SACK_COOLDOWN_MS)
    if (cooldownEnds.getTime() > Date.now()) {
      return Response.json({
        error: `This manager was recently sacked. Wait until ${cooldownEnds.toISOString()} before reassigning.`,
        code: 'SACK_COOLDOWN',
        cooldown_ends_at: cooldownEnds.toISOString(),
      }, { status: 409 })
    }
  }

  // Find all sibling rows for this club
  let allClubIds: string[] = [resolvedTeamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', resolvedTeamId)
    allClubIds = [resolvedTeamId, ...(siblings ?? []).map((s) => s.id)]
  }

  // Assign manager on all rows for this club
  const { error: updateErr } = await adminSupabase
    .from('teams')
    .update({ manager_id: user_id })
    .in('id', allClubIds)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  const now = new Date().toISOString()


  // Close any existing open tenures for these rows
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  // Open new tenures for all rows
  await adminSupabase
    .from('manager_tenures' as any)
    .insert(
      allClubIds.map((id) => ({
        team_id: id,
        manager_id: user_id,
        manager_username: targetProfile.username,
        started_at: now,
      }))
    )

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'assign_manager',
    target_type: 'team',
    target_id: resolvedTeamId,
    details: { team_name: team.name, assigned_user_id: user_id, username: targetProfile.username },
  })

  return Response.json({ success: true })
}
