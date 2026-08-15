import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUsers } from '@/lib/push'

export interface NotificationRow {
  user_id: string
  type: string
  title: string
  body: string
  data?: any
  push_url?: string
}

export interface AdminNotificationRow {
  type: string
  title: string
  body: string
  data?: any
  push_url?: string
}

export function pushUrlFromData(data?: any): string {
  if (data?.fixture_id) return `/fixtures/${data.fixture_id}`
  if (data?.team_id) return `/teams/${data.team_id}`
  return '/'
}

export async function insertNotificationsAndPush(
  supabase: SupabaseClient,
  rows: NotificationRow | NotificationRow[]
) {
  const arr = Array.isArray(rows) ? rows : [rows]
  if (arr.length === 0) return

  const insertRows = arr.map(({ push_url: _push_url, ...row }) => row)

  const { error } = await supabase.from('notifications').insert(insertRows)
  if (error) console.error('[notify] insert error:', error.message)

  for (const row of arr) {
    await sendPushToUsers(supabase, [row.user_id], {
      title: row.title,
      body: row.body,
      url: row.push_url ?? pushUrlFromData(row.data),
      tag: `${row.type}-${row.user_id}`,
    }).catch(() => {})
  }
}

// Insert in-app notifications + push to every admin profile.
// Used for admin-facing events (backdoor submissions, postponements, etc.)
export async function notifyAllAdmins(
  supabase: SupabaseClient,
  rows: AdminNotificationRow | AdminNotificationRow[]
) {
  const arr = Array.isArray(rows) ? rows : [rows]
  if (arr.length === 0) return

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (error || !admins?.length) return

  await insertNotificationsAndPush(
    supabase,
    arr.flatMap((row) =>
      admins.map((a) => ({
        ...row,
        user_id: a.id,
      }))
    )
  )
}
