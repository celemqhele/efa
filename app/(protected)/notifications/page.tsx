import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarkAllReadButton, NotificationRow, TeamChangeRequestRow } from './NotificationActions'

export const revalidate = 0

// ─── Notification type → emoji icon ─────────────────────────────────────────

const NOTIFICATION_ICON: Record<string, string> = {
  match_reminder: '⏰',
  result_confirmed: '✅',
  fixture_postponed: '📅',
  fixtures_released: '📋',
  sacking: '🚫',
  team_request: '🔄',
  team_request_approved: '✅',
  team_request_denied: '❌',
  team_request_reviewed: '✅',
  deadline_warning: '⚠️',
  super_cup: '🏆',
  qualification: '⭐',
}

function getIcon(type: string): string {
  return NOTIFICATION_ICON[type] ?? '🔔'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile (to check admin role)
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as any

  const isAdmin = profile?.role === 'admin'

  // All notifications for the current user, newest first
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allNotifications = (notifications ?? []) as Array<{
    id: string
    type: string
    title: string
    body: string
    read: boolean
    created_at: string
    data: any
  }>

  const unread = allNotifications.filter((n) => !n.read)
  const read = allNotifications.filter((n) => n.read)
  const hasUnread = unread.length > 0

  // Admin: fetch pending team change requests
  const { data: pendingRequests } = isAdmin
    ? await supabase
        .from('team_change_requests')
        .select(`
          id, created_at,
          requesting_user:profiles!requesting_user_id(username),
          current_team:teams!current_team_id(name),
          requested_team:teams!requested_team_id(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
    : { data: null }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {hasUnread && (
            <p className="text-sm text-[#c9a84c] mt-0.5">
              {unread.length} unread
            </p>
          )}
        </div>
        <MarkAllReadButton disabled={!hasUnread} />
      </div>

      {/* ── Admin: Pending Team Change Requests ──────────────────────────── */}
      {isAdmin && pendingRequests && pendingRequests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[#1e2d5a]">
            <h2 className="section-header mb-0">
              <span>🔄</span> Pending Team Requests
              <span className="ml-auto text-xs font-normal text-slate-500 bg-[#1e2d5a] px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </h2>
          </div>
          <div className="p-3 space-y-2">
            {(pendingRequests as any[]).map((req) => (
              <TeamChangeRequestRow key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      {/* ── No notifications at all ───────────────────────────────────────── */}
      {allNotifications.length === 0 && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-slate-400 font-medium">No notifications yet</p>
          <p className="text-slate-600 text-sm mt-1">
            You&apos;ll see match reminders, result updates, and more here.
          </p>
        </div>
      )}

      {/* ── Unread notifications ──────────────────────────────────────────── */}
      {unread.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[#1e2d5a] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Unread ({unread.length})
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d5a]/60">
            {unread.map((n) => (
              <NotificationRow key={n.id} notification={n} icon={getIcon(n.type)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Read notifications ────────────────────────────────────────────── */}
      {read.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[#1e2d5a]">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Earlier ({read.length})
            </h2>
          </div>
          <div className="divide-y divide-[#1e2d5a]/60 opacity-80">
            {read.map((n) => (
              <NotificationRow key={n.id} notification={n} icon={getIcon(n.type)} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
