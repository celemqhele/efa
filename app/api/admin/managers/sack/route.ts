import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { team_id } = await request.json()
  if (!team_id) return Response.json({ error: 'team_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: team } = await adminSupabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', team_id)
    .single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })
  if (!team.manager_id) return Response.json({ error: 'Team has no manager to remove' }, { status: 400 })

  const sackUserId = team.manager_id

  // Record sack time for the 1-week reassignment cooldown
  const now = new Date().toISOString()
  await adminSupabase.from('profiles').update({ sacked_at: now }).eq('id', sackUserId)

  // Find all sibling rows for this club
  let allClubIds: string[] = [team_id]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', team_id)
    allClubIds = [team_id, ...(siblings ?? []).map((s) => s.id)]
  }

  // Clear manager_id on all rows for this club
  const { error: updateErr } = await adminSupabase
    .from('teams')
    .update({ manager_id: null })
    .in('id', allClubIds)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Close open tenures
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'sack_manager',
    target_type: 'team',
    target_id: team_id,
    details: { team_name: team.name, sacked_user_id: sackUserId },
  })

  return Response.json({ success: true })
}
