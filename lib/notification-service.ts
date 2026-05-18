'use server'

import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:efa@efa.local',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export interface NotificationPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

export async function sendPushToUser(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: NotificationPayload
) {
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/efa-icon-192.png',
  })

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        data
      )
    )
  )

  return results
}

export type NotificationType =
  | 'match_reminder'
  | 'result_confirmed'
  | 'fixture_postponed'
  | 'fixtures_released'
  | 'sacking'
  | 'team_request'
  | 'team_request_reviewed'
  | 'deadline_warning'
  | 'super_cup'
  | 'qualification'

export function buildNotification(
  type: NotificationType,
  context: Record<string, string>
): { title: string; body: string } {
  switch (type) {
    case 'match_reminder':
      return {
        title: 'EFA — Match Reminder',
        body: `You have ${context.count} fixture(s) tomorrow, all due by 14:00 SAST.`,
      }
    case 'result_confirmed':
      return {
        title: 'Result Confirmed',
        body: `${context.home} ${context.homeScore}–${context.awayScore} ${context.away}`,
      }
    case 'fixture_postponed':
      return {
        title: 'Fixture Postponed',
        body: `Your fixture vs ${context.opponent} has been rescheduled to ${context.newDate}.`,
      }
    case 'fixtures_released':
      return {
        title: 'Fixtures Released',
        body: `Fixtures for ${context.tournament} are now live!`,
      }
    case 'sacking':
      return {
        title: 'Team Reassigned',
        body: 'Your team has been reassigned. Contact an admin.',
      }
    case 'team_request':
      return {
        title: 'Team Change Request',
        body: `${context.username} has requested to manage ${context.team}. Approve?`,
      }
    case 'team_request_reviewed':
      return {
        title: context.approved === 'true' ? 'Team Change Approved' : 'Team Change Denied',
        body: context.approved === 'true'
          ? `Your team change to ${context.team} has been approved.`
          : 'Your team change request was denied.',
      }
    case 'deadline_warning':
      return {
        title: '⏰ 1 Hour Left',
        body: 'Get your games in. Deadline: 14:00 SAST.',
      }
    case 'super_cup':
      return {
        title: 'EFA Super Cup',
        body: `EFA Super Cup: ${context.home} vs ${context.away} — ${context.date}`,
      }
    case 'qualification':
      return {
        title: `Qualified: ${context.tournament}`,
        body: `You've qualified for the ${context.tournament}!`,
      }
    default:
      return { title: 'EFA Notification', body: '' }
  }
}
