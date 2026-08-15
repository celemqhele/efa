'use client'
import { MarkAllReadButton, NotificationRow, TeamChangeRequestRow } from './NotificationActions'
import {
  Bell, Trophy, CalendarClock, Swords, AlertTriangle,
  UserPlus, CheckCircle, X, Info, Star, Ban, RefreshCw,
} from 'lucide-react'
import type { ReactNode } from 'react'

const NOTIFICATION_ICON: Record<string, ReactNode> = {
  match_reminder: <Bell className="w-4 h-4" />,
  result_confirmed: <Trophy className="w-4 h-4" />,
  fixture_postponed: <CalendarClock className="w-4 h-4" />,
  fixtures_released: <Swords className="w-4 h-4" />,
  sacking: <AlertTriangle className="w-4 h-4" />,
  manager_sacked: <Ban className="w-4 h-4" />,
  team_request: <UserPlus className="w-4 h-4" />,
  team_request_approved: <CheckCircle className="w-4 h-4" />,
  team_request_denied: <X className="w-4 h-4" />,
  team_request_reviewed: <Info className="w-4 h-4" />,
  deadline_warning: <AlertTriangle className="w-4 h-4" />,
  super_cup: <Star className="w-4 h-4" />,
  qualification: <Star className="w-4 h-4" />,
  backdoor_submitted: <UserPlus className="w-4 h-4" />,
  backdoor_approved: <CheckCircle className="w-4 h-4" />,
  backdoor_declined: <X className="w-4 h-4" />,
}

function getIcon(type: string): ReactNode {
  return NOTIFICATION_ICON[type] ?? <Bell className="w-4 h-4" />
}

export default function Desktop({ data }: { data: any }) {
  const { allNotifications, pendingRequests, isAdmin } = data
  const unread = allNotifications.filter((n: any) => !n.read)
  const read = allNotifications.filter((n: any) => n.read)
  const hasUnread = unread.length > 0

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-primary">Notifications</h1>
          {hasUnread && (
            <p className="text-sm text-accent mt-0.5">
              {unread.length} unread
            </p>
          )}
        </div>
        <MarkAllReadButton disabled={!hasUnread} />
      </div>

      {isAdmin && pendingRequests && pendingRequests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border">
              <h2 className="section-header mb-0 gap-2">
                <RefreshCw className="w-5 h-5 shrink-0" /> Pending Team Requests
              <span className="ml-auto text-xs font-normal text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </h2>
          </div>
          <div className="p-3 space-y-2">
            {(pendingRequests as any[]).map((req: any) => (
              <TeamChangeRequestRow key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      {allNotifications.length === 0 && (
        <div className="card p-16 text-center">
          <Bell className="w-12 h-12 mx-auto text-text-muted" />
          <p className="text-text-muted font-medium">No notifications yet</p>
          <p className="text-foreground-muted text-sm mt-1">
            You&apos;ll see match reminders, result updates, and more here.
          </p>
        </div>
      )}

      {unread.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <h2 className="text-sm font-bold text-foreground-primary uppercase tracking-wider">
              Unread ({unread.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200/60">
            {unread.map((n: any) => (
              <NotificationRow key={n.id} notification={n} icon={getIcon(n.type)} />
            ))}
          </div>
        </div>
      )}

      {read.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-border">
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
              Earlier ({read.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-200/60 opacity-80">
            {read.map((n: any) => (
              <NotificationRow key={n.id} notification={n} icon={getIcon(n.type)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
