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
      team:teams!manager_applications_team_id_fkey(id, name)
    `)
    .eq('id', application_id)
    .single()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })
  if ((app as any).status !== 'pending') return Response.json({ error: 'Application is not pending' }, { status: 409 })

  const team = Array.isArray((app as any).team) ? (app as any).team[0] : (app as any).team
  const applicantId: string = (app as any).applicant_id
  const now = new Date().toISOString()

  await adminSupabase.from('manager_applications' as any)
    .update({ status: 'denied', reviewed_at: now, reviewed_by: user.id })
    .eq('id', application_id)

  await adminSupabase.from('notifications').insert({
    user_id: applicantId,
    type: 'application_denied',
    title: 'Application Denied',
    body: `Your application to manage ${team.name} was not approved.`,
    data: { team_id: (app as any).team_id, team_name: team.name },
  })

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'deny_manager_application',
    target_type: 'team',
    target_id: (app as any).team_id,
    details: { team_name: team.name, applicant_id: applicantId },
  })

  // Mark the requesting admin's own notification as read
  await adminSupabase.from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'manager_application')
    .eq('read', false)

  return Response.json({ success: true })
}
