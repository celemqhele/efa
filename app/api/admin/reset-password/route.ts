import { createClient, createAdminClient } from '@/lib/supabase/server'

const DEFAULT_PASSWORD = 'Efootball@2026'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { user_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id } = body

  if (!user_id) {
    return Response.json({ error: 'user_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user_id, {
    password: DEFAULT_PASSWORD,
  })

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'reset_password',
    target_type: 'profile',
    target_id: user_id,
    details: { note: 'Password reset to default' },
  })

  return Response.json({ success: true, user_id })
}
