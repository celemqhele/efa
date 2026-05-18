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

  let body: { endpoint: string; p256dh: string; auth: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { endpoint, p256dh, auth } = body

  if (!endpoint || !p256dh || !auth) {
    return Response.json(
      { error: 'endpoint, p256dh and auth are required' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ subscribed: true })
}
