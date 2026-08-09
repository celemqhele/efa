import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToUsers, type PushPayload } from '@/lib/push'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { title?: string; body?: string; url?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[push-broadcast] POST', { admin: user.id, body })

  const title = body.title?.trim()
  const message = body.body?.trim()
  if (!title || !message) {
    return Response.json({ error: 'title and body are required' }, { status: 400 })
  }

  try {
    const { data: subRows, error: subError } = await adminSupabase
      .from('push_subscriptions')
      .select('user_id')

    console.log('[push-broadcast] loaded subscriptions', {
      rows: subRows?.length ?? 0,
      dbError: subError?.message ?? null,
    })

    const userIds = Array.from(new Set((subRows ?? []).map((r: any) => r.user_id)))

    if (!userIds.length) {
      console.log('[push-broadcast] zero subscribed users')
      return Response.json({ subscribed: 0, sent: 0, failed: 0 })
    }

    const payload: PushPayload = {
      title,
      body: message,
      url: body.url?.trim() || '/',
      tag: `broadcast-${Date.now()}`,
    }

    console.log('[push-broadcast] sending', { userIds, payload })

    const results = await sendPushToUsers(adminSupabase, userIds, payload)

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .slice(0, 3)
      .map((r) => {
        const err: any = r.reason
        return {
          statusCode: err?.statusCode ?? null,
          message: err?.message ?? String(err),
        }
      })

    console.log('[push-broadcast] done', { subscribed: userIds.length, sent, failed, errors })

    return Response.json({ subscribed: userIds.length, sent, failed, errors })
  } catch (e: any) {
    console.error('[push-broadcast] ERROR', e)
    return Response.json(
      { error: e?.message ?? String(e) },
      { status: 500 }
    )
  }
}
