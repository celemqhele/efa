import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { notification_ids?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional — treat as mark-all
  }

  const { notification_ids } = body

  let query = supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)

  if (notification_ids && notification_ids.length > 0) {
    query = query.in('id', notification_ids)
  }

  const { error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
