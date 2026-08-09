import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT!
  const publicKey = process.env.VAPID_PUBLIC_KEY!
  const privateKey = process.env.VAPID_PRIVATE_KEY!
  console.log('[push] configureVapid', {
    subject,
    publicKeyLen: publicKey?.length,
    privateKeyLen: privateKey?.length,
    publicKeyPreview: publicKey?.slice(0, 24),
  })
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

function shortEndpoint(endpoint: string) {
  return endpoint?.slice(0, 60)
}

function describeError(err: any) {
  return {
    statusCode: err?.statusCode ?? null,
    message: err?.message ?? String(err),
    body: typeof err?.body === 'string' ? err.body.slice(0, 200) : null,
  }
}

export async function sendPushToUser(
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  configureVapid()
  console.log('[push] sendPushToUser', {
    count: subscriptions.length,
    title: payload.title,
  })
  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload)
      )
    )
  )
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log('[push] sendPushToUser ok', { endpoint: shortEndpoint(subscriptions[i].endpoint) })
    } else {
      console.log('[push] sendPushToUser FAIL', {
        endpoint: shortEndpoint(subscriptions[i].endpoint),
        ...describeError(r.reason),
      })
    }
  })
  return results
}

export async function sendPushToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  payload: PushPayload
) {
  if (!userIds.length) {
    console.log('[push] sendPushToUsers no userIds')
    return []
  }
  configureVapid()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds)

  console.log('[push] sendPushToUsers loaded subs', {
    userIdCount: userIds.length,
    subCount: subs?.length ?? 0,
    dbError: error?.message ?? null,
  })

  if (!subs?.length) {
    console.log('[push] sendPushToUsers zero subs')
    return []
  }

  const results = await Promise.allSettled(
    subs.map((row) =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload)
      )
    )
  )

  results.forEach((r, i) => {
    const row = subs[i]
    if (r.status === 'fulfilled') {
      console.log('[push] send OK', { user_id: row.user_id, endpoint: shortEndpoint(row.endpoint) })
    } else {
      console.log('[push] send FAIL', {
        user_id: row.user_id,
        endpoint: shortEndpoint(row.endpoint),
        ...describeError(r.reason),
      })
    }
  })

  const deadEndpoints = results
    .map((r, i): { rejected: boolean; reason: any; endpoint: string } => ({
      rejected: r.status === 'rejected',
      reason: r.status === 'rejected' ? r.reason : null,
      endpoint: subs[i].endpoint,
    }))
    .filter((r) => r.rejected && (r.reason?.statusCode === 410 || r.reason?.statusCode === 404))
    .map((r) => r.endpoint)

  if (deadEndpoints.length) {
    console.log('[push] pruning dead endpoints', deadEndpoints.map(shortEndpoint))
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', deadEndpoints)
  }

  return results
}

export async function sendAdminPush(
  supabase: SupabaseClient,
  payload: PushPayload
) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (!admins?.length) return []

  return sendPushToUsers(
    supabase,
    admins.map((a) => a.id),
    payload
  )
}
