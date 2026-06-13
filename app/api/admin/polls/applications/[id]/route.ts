import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const adminSupabase = await createAdminClient()

  const { error } = await adminSupabase
    .from('poll_applications' as any)
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'delete_poll_application',
    target_type: 'poll_application',
    target_id: id,
  })

  return Response.json({ success: true })
}
