import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { from_user_id, to_user_id } = await request.json()
  if (!from_user_id || !to_user_id) {
    return Response.json({ error: 'from_user_id and to_user_id are required' }, { status: 400 })
  }
  if (from_user_id === to_user_id) {
    return Response.json({ error: 'Source and destination must be different' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Validate both users exist
  const [{ data: fromProfile }, { data: toProfile }] = await Promise.all([
    adminSupabase.from('profiles').select('id, username').eq('id', from_user_id).single(),
    adminSupabase.from('profiles').select('id, username').eq('id', to_user_id).single(),
  ])
  if (!fromProfile) return Response.json({ error: 'Source user not found' }, { status: 404 })
  if (!toProfile) return Response.json({ error: 'Destination user not found' }, { status: 404 })

  // Call the DB function
  const { data, error } = await adminSupabase.rpc('transfer_manager_data', {
    p_from_user_id: from_user_id,
    p_to_user_id: to_user_id,
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'transfer_manager_data',
    target_type: 'profile',
    target_id: from_user_id,
    details: {
      from_username: fromProfile.username,
      to_username: toProfile.username,
      to_user_id,
      result: data,
    },
  })

  return Response.json(data)
}
