'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

// --- Mark All As Read --------------------------------------------------------

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkAll = async () => {
    setLoading(true)
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleMarkAll}
      disabled={disabled || loading}
      variant="ghost"
      className="text-xs"
    >
      {loading ? 'Marking…' : '✓ Mark all read'}
    </Button>
  )
}

// --- Single notification click (mark read + navigate) ------------------------

export function NotificationRow({
  notification,
  icon,
}: {
  notification: {
    id: string
    title: string
    body: string
    read: boolean
    created_at: string
    type: string
    data: any
  }
  icon: string
}) {
  const router = useRouter()

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  const handleClick = async () => {
    if (!notification.read) {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id }),
      }).catch(() => {})
    }
    const data = notification.data ?? {}
    if (data.fixture_id) {
      router.push(`/fixtures/${data.fixture_id}`)
    } else if (data.team_id) {
      router.push(`/teams/${data.team_id}`)
    }
    router.refresh()
  }

  const hasLink = notification.data?.fixture_id || notification.data?.team_id

  return (
    <div
      onClick={hasLink ? handleClick : undefined}
      className={`relative flex gap-4 px-4 py-4 transition-all ${
        !notification.read
          ? 'border-l-[3px] border-l-accent bg-accent/5'
          : 'border-l-[3px] border-l-transparent'
      } ${hasLink ? 'cursor-pointer hover:bg-bg-base' : ''}`}
    >
      {/* Icon */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-base mt-0.5">
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${notification.read ? 'text-text-muted' : 'text-text-primary font-semibold'}`}>
            {notification.title}
          </p>
          <span className="text-[10px] text-text-muted shrink-0 mt-0.5 whitespace-nowrap">
            {timeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{notification.body}</p>
        {hasLink && (
          <span className="inline-block mt-1.5 text-[10px] text-accent font-medium">
            View details
          </span>
        )}
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
      )}
    </div>
  )
}

// --- Admin: Team Change Request Row ------------------------------------------

export function TeamChangeRequestRow({
  request,
}: {
  request: {
    id: string
    requesting_user: { username: string } | null
    current_team: { name: string } | null
    requested_team: { name: string } | null
    created_at: string
  }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<'approved' | 'denied' | null>(null)

  const act = async (action: 'approve' | 'deny') => {
    setLoading(action)
    try {
      const res = await fetch('/api/admin/team-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: request.id, action }),
      })
      if (!res.ok) throw new Error('Failed')
      setResult(action === 'approve' ? 'approved' : 'denied')
      setDone(true)
      setTimeout(() => router.refresh(), 800)
    } finally {
      setLoading(null)
    }
  }

  const dateStr = new Date(request.created_at).toLocaleDateString()

  if (done) {
    return (
      <div className="flex items-center gap-space-3 px-space-4 py-space-3 rounded-xl border border-border bg-bg-base">
        <span className="text-lg">{result === 'approved' ? '✅' : '❌'}</span>
        <p className="text-sm text-text-muted">
          Request {result} for{' '}
          <span className="text-text-primary font-medium">@{request.requesting_user?.username}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-space-4 px-space-4 py-space-4 rounded-xl border border-border hover:border-accent/30 transition-colors bg-bg-surface">
      <div className="text-xl shrink-0">🔄</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">
          @{request.requesting_user?.username ?? 'Unknown'} wants to manage{' '}
          <span className="text-accent">{request.requested_team?.name ?? '?'}</span>
        </p>
        <p className="text-xs text-text-secondary mt-space-0.5">
          {request.current_team ? `Currently: ${request.current_team.name}` : 'No current team'} · {dateStr}
        </p>
      </div>
      <div className="flex gap-space-2 shrink-0">
        <Button
          onClick={() => act('approve')}
          isLoading={loading === 'approve'}
          variant="primary"
          className="text-xs px-space-3 py-space-1.5"
        >
          Approve
        </Button>
        <Button
          onClick={() => act('deny')}
          isLoading={loading === 'deny'}
          variant="destructive"
          className="text-xs px-space-3 py-space-1.5"
        >
          Deny
        </Button>
      </div>
    </div>
  )
}
