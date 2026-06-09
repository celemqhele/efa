'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTeamLogo } from '@/lib/logo-resolver'
import type { Notification } from '@/lib/supabase/types'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface TeamChangeRequest {
  id: string
  status: string
  created_at: string
  requesting_user: { username: string; avatar_url: string | null } | null
  current_team: { name: string; logo_league_folder: string; logo_team_slug: string } | null
  requested_team: { name: string; logo_league_folder: string; logo_team_slug: string } | null
}

interface Props {
  pendingRequests: TeamChangeRequest[]
  notifications: Notification[]
  allUsers: Array<{ id: string; username: string }>
}

export default function AdminNotificationsClient({ pendingRequests, notifications, allUsers }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [broadcastMsg, setBroadcastMsg] = useState({ title: '', body: '' })
  const [sending, setSending] = useState(false)

  async function handleRequest(requestId: string, action: 'approve' | 'deny') {
    setLoading(requestId)
    await fetch('/api/admin/team-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, action }),
    })
    setLoading(null)
    router.refresh()
  }

  async function sendBroadcast() {
    if (!broadcastMsg.title || !broadcastMsg.body) return
    setSending(true)
    const inserts = allUsers.map((u) => ({
      user_id: u.id,
      type: 'fixtures_released',
      title: broadcastMsg.title,
      body: broadcastMsg.body,
    }))

    await supabase.from('notifications').insert(inserts)
    setBroadcastMsg({ title: '', body: '' })
    setSending(false)
    router.refresh()
  }

  return (
    <div className="space-y-space-6">
      <h1 className="text-xl font-bold text-text-primary">Admin Notifications</h1>

      {/* Pending Team Change Requests */}
      <Card className="p-space-4">
        <h2 className="section-header">
          Pending Team Change Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 bg-accent text-bg-surface text-xs font-bold px-space-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </h2>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-text-muted">No pending requests.</p>
        ) : (
          <div className="space-y-space-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-bg-elevated border border-border rounded-xl p-space-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-space-4">
                  {/* User */}
                  <div className="flex items-center gap-space-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-border-subtle flex items-center justify-center text-accent font-bold text-xs">
                      {req.requesting_user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{req.requesting_user?.username}</p>
                      <p className="text-xs text-text-muted">
                        {formatDistanceToNow(parseISO(req.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-space-3 text-sm flex-1">
                    <div className="text-center">
                      {req.current_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(req.current_team.logo_league_folder, req.current_team.logo_team_slug, 'standings_row')}
                          alt={req.current_team.name}
                          width={32} height={32}
                          className="object-contain mx-auto"
                        />
                      )}
                      <p className="text-xs text-text-muted mt-space-1">{req.current_team?.name ?? '-'}</p>
                    </div>
                    <span className="text-accent">→</span>
                    <div className="text-center">
                      {req.requested_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')}
                          alt={req.requested_team.name}
                          width={32} height={32}
                          className="object-contain mx-auto"
                        />
                      )}
                      <p className="text-xs text-text-primary font-medium mt-space-1">{req.requested_team?.name}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-space-2">
                    <Button
                      onClick={() => handleRequest(req.id, 'approve')}
                      isLoading={loading === req.id}
                      variant="primary"
                      className="text-xs px-space-4 py-space-2"
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRequest(req.id, 'deny')}
                      isLoading={loading === req.id}
                      variant="destructive"
                      className="text-xs px-space-4 py-space-2"
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Broadcast message */}
      <Card className="p-space-4">
        <h2 className="section-header">Send Notification to All Users</h2>
        <div className="space-y-space-3">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="EFA Announcement"
              value={broadcastMsg.title}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, title: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea
              className="input-field min-h-[space-10] resize-none"
              placeholder="Your message here"
              value={broadcastMsg.body}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, body: e.target.value })}
            />
          </div>
          <Button
            onClick={sendBroadcast}
            isLoading={sending}
            disabled={!broadcastMsg.title || !broadcastMsg.body}
            variant="primary"
            className="text-sm"
          >
            {sending ? 'Sending...' : `Send to All ${allUsers.length} Users`}
          </Button>
        </div>
      </Card>

      {/* Admin's own notifications */}
      <Card className="p-space-4">
        <h2 className="section-header">Your Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-text-muted">No notifications.</p>
        ) : (
          <div className="space-y-space-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-space-4 py-space-3 rounded-xl border transition-colors ${
                  n.read
                    ? 'border-border bg-transparent'
                    : 'border-accent/30 bg-accent/5 border-l-2 border-l-accent'
                }`}
              >
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-xs text-text-muted mt-space-0.5">{n.body}</p>
                <p className="text-xs text-text-secondary mt-space-1">
                  {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
