import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { application_id } = await request.json()
  if (!application_id) return Response.json({ error: 'application_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: app } = await adminSupabase
    .from('manager_applications' as any)
    .select(`
      id, applicant_id, team_id, status,
      applicant:profiles!manager_applications_applicant_id_fkey(id, username),
      team:teams!manager_applications_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager_id)
    `)
    .eq('id', application_id)
    .single()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })
  if ((app as any).status !== 'pending') return Response.json({ error: 'Application is not pending' }, { status: 409 })

  const team = Array.isArray((app as any).team) ? (app as any).team[0] : (app as any).team
  const applicant = Array.isArray((app as any).applicant) ? (app as any).applicant[0] : (app as any).applicant

  const newManagerId: string = (app as any).applicant_id
  const teamId: string = (app as any).team_id
  const previousManagerId: string | null = team.manager_id ?? null

  // Find all sibling rows for the target club (same club across phases)
  let allClubIds: string[] = [teamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await adminSupabase
      .from('teams').select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', teamId)
    allClubIds = [teamId, ...(siblings ?? []).map((s: any) => s.id)]
  }

  const now = new Date().toISOString()

  // Close existing tenures for the target club
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  // Assign new manager on all sibling rows
  await adminSupabase.from('teams').update({ manager_id: newManagerId }).in('id', allClubIds)

  // Open new tenures for all sibling rows
  await adminSupabase.from('manager_tenures' as any).insert(
    allClubIds.map((id) => ({
      team_id: id,
      manager_id: newManagerId,
      manager_username: applicant.username,
      started_at: now,
    }))
  )

  // Mark this application approved
  await adminSupabase.from('manager_applications' as any)
    .update({ status: 'approved', reviewed_at: now, reviewed_by: user.id })
    .eq('id', application_id)

  // Deny all other pending applications for the same team
  await adminSupabase.from('manager_applications' as any)
    .update({ status: 'denied', reviewed_at: now, reviewed_by: user.id })
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .neq('id', application_id)

  // Notifications
  const notifications: any[] = [
    {
      user_id: newManagerId,
      type: 'application_approved',
      title: 'Application Approved!',
      body: `You are now the manager of ${team.name}. Good luck!`,
      data: { team_id: teamId, team_name: team.name },
    },
  ]

  if (previousManagerId && previousManagerId !== newManagerId) {
    notifications.push({
      user_id: previousManagerId,
      type: 'manager_sacked',
      title: 'Removed as Manager',
      body: `You have been replaced as manager of ${team.name}.`,
      data: { team_id: teamId, team_name: team.name },
    })
  }

  await adminSupabase.from('notifications').insert(notifications)

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'approve_manager_application',
    target_type: 'team',
    target_id: teamId,
    details: {
      team_name: team.name,
      new_manager_id: newManagerId,
      new_manager_username: applicant.username,
      previous_manager_id: previousManagerId,
    },
  })

  // Mark the requesting admin's own notification as read
  await adminSupabase.from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'manager_application')
    .eq('read', false)

  return Response.json({ success: true })
}
