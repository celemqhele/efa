import { createClient, createAdminClient } from '@/lib/supabase/server'

// Toggle a manager's "open to match reminders" preference. When false, the
// admin dashboard 'Fixtures Due' WhatsApp reminder buttons for this manager
// render greyed out and are not clickable.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, open } = await request.json()
  if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 })
  if (typeof open !== 'boolean') return Response.json({ error: 'open must be a boolean' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: current, error: readError } = await (adminSupabase as any)
    .from('profiles')
    .select('open_to_reminders')
    .eq('id', user_id)
    .maybeSingle()

  if (readError) return Response.json({ error: readError.message }, { status: 500 })

  const { error: updateError } = await (adminSupabase as any)
    .from('profiles')
    .update({ open_to_reminders: open })
    .eq('id', user_id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  await (adminSupabase as any).from('audit_log').insert({
    admin_id: user.id,
    action: 'update_open_to_reminders',
    target_type: 'profile',
    target_id: user_id,
    details: {
      previous_open_to_reminders: current?.open_to_reminders ?? null,
      open_to_reminders: open,
      note: 'Open to match reminders updated via admin managers page',
    },
  })

  return Response.json({ ok: true, open_to_reminders: open })
}
