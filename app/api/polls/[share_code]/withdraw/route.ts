import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params: _params }: { params: Promise<{ share_code: string }> }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { application_id } = body

  if (!application_id) {
    return Response.json({ error: 'application_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  const { data: app } = await adminSupabase
    .from('poll_applications' as any)
    .select('id, applicant_id, status')
    .eq('id', application_id)
    .single()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })
  if (app.applicant_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })
  if (app.status === 'withdrawn') return Response.json({ error: 'Already withdrawn' }, { status: 400 })

  await adminSupabase
    .from('poll_applications' as any)
    .update({ status: 'withdrawn' })
    .eq('id', application_id)

  return Response.json({ success: true })
}
