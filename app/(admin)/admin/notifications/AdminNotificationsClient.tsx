'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTeamLogo } from '@/lib/logo-resolver'
import type { Notification } from '@/lib/supabase/types'
import { formatDistanceToNow, parseISO } from 'date-fns'

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
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Admin Notifications</h1>

      {/* Pending Team Change Requests */}
      <section className="card p-4">
        <h2 className="section-header">
          Pending Team Change Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 bg-[#c9a84c] text-[#0a1128] text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </h2>

        {pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-[#0a1128] border border-[#1e2d5a] rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* User */}
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-[#1e2d5a] flex items-center justify-center text-[#c9a84c] font-bold text-xs">
                      {req.requesting_user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{req.requesting_user?.username}</p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(parseISO(req.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-3 text-sm flex-1">
                    <div className="text-center">
                      {req.current_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(req.current_team.logo_league_folder, req.current_team.logo_team_slug, 'standings_row')}
                          alt={req.current_team.name}
                          width={32} height={32}
                          className="object-contain mx-auto"
                        />
                      )}
                      <p className="text-xs text-slate-400 mt-1">{req.current_team?.name ?? '—'}</p>
                    </div>
                    <span className="text-[#c9a84c]">→</span>
                    <div className="text-center">
                      {req.requested_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')}
                          alt={req.requested_team.name}
                          width={32} height={32}
                          className="object-contain mx-auto"
                        />
                      )}
                      <p className="text-xs text-white font-medium mt-1">{req.requested_team?.name}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRequest(req.id, 'approve')}
                      disabled={loading === req.id}
                      className="btn-gold text-xs px-4 py-2 disabled:opacity-50"
                    >
                      {loading === req.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRequest(req.id, 'deny')}
                      disabled={loading === req.id}
                      className="btn-danger text-xs px-4 py-2 disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Broadcast message */}
      <section className="card p-4">
        <h2 className="section-header">Send Notification to All Users</h2>
        <div className="space-y-3">
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
              className="input-field min-h-[80px] resize-none"
              placeholder="Your message here…"
              value={broadcastMsg.body}
              onChange={(e) => setBroadcastMsg({ ...broadcastMsg, body: e.target.value })}
            />
          </div>
          <button
            onClick={sendBroadcast}
            disabled={sending || !broadcastMsg.title || !broadcastMsg.body}
            className="btn-gold disabled:opacity-40 text-sm"
          >
            {sending ? 'Sending…' : `Send to All ${allUsers.length} Users`}
          </button>
        </div>
      </section>

      {/* Admin's own notifications */}
      <section className="card p-4">
        <h2 className="section-header">Your Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No notifications.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 rounded-xl border transition-colors ${
                  n.read
                    ? 'border-[#1e2d5a] bg-transparent'
                    : 'border-[#c9a84c]/30 bg-[#c9a84c]/5 border-l-2 border-l-[#c9a84c]'
                }`}
              >
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
