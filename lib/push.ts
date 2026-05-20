import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

export async function sendPushToUser(
  subscriptions: { subscription: object }[],
  payload: PushPayload
) {
  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify(payload)
      )
    )
  )
  return results
}
