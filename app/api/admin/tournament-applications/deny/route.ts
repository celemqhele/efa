import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { application_id, reason } = await request.json()
  if (!application_id) return Response.json({ error: 'application_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: app } = await adminSupabase
    .from('tournament_applications')
    .select('id, applicant_id, season_id, status, applicant:profiles!tournament_applications_applicant_id_fkey(id, username)')
    .eq('id', application_id)
    .single()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })
  if (app.status !== 'pending') return Response.json({ error: 'Application is not pending' }, { status: 409 })

  const applicant = Array.isArray(app.applicant) ? app.applicant[0] : app.applicant
  const now = new Date().toISOString()

  await adminSupabase.from('tournament_applications').update({
    status: 'denied',
    review_note: reason ?? null,
    reviewed_at: now,
    reviewed_by: user.id,
  }).eq('id', application_id)

  try {
    await insertNotificationsAndPush(adminSupabase, {
      user_id: app.applicant_id,
      type: 'tournament_application_denied',
      title: 'Application Declined',
      body: reason?.trim() ? `Your tournament application was declined: ${reason}` : 'Your tournament application was declined.',
      data: { season_id: app.season_id },
    })
  } catch (e) {
    console.error('[tournament-applications/deny] notify failed:', e)
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'deny_tournament_application',
    target_type: 'season',
    target_id: app.season_id,
    details: { applicant_id: app.applicant_id, applicant_username: applicant?.username ?? '', reason: reason ?? null },
  })

  return Response.json({ success: true })
}