import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { user_id: string; role: 'admin' | 'user' }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id, role } = body

  if (!user_id || !role || !['admin', 'user'].includes(role)) {
    return Response.json(
      { error: 'user_id and role (admin|user) are required' },
      { status: 400 }
    )
  }

  // Prevent self-demotion
  if (user_id === user.id) {
    return Response.json(
      { error: 'You cannot change your own role' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()

  const { error: updateError } = await adminSupabase
    .from('profiles')
    .update({ role })
    .eq('id', user_id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'change_role',
    target_type: 'profile',
    target_id: user_id,
    details: { new_role: role },
  })

  return Response.json({ success: true, user_id, role })
}
