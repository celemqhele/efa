'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import WhatsAppButton from '@/components/ui/WhatsAppButton'

const supabase = createClient()

interface Submission {
  id: string
  fixture_id: string
  submitter_phone: string
  side_claimed: 'home' | 'away'
  screenshot_url: string
  status: 'pending' | 'approved' | 'declined' | 'void_game_played' | 'expired'
  is_dispute: boolean
  dispute_note: string | null
  created_at: string
  expires_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface Fixture {
  id: string
  home_team: { name: string }
  away_team: { name: string }
  scheduled_date: string
  status: string
}

interface GroupedSubmission {
  fixture: Fixture
  submissions: Submission[]
}

interface Props {
  groupedSubmissions: [string, Submission[]][]
}

export default function BackdoorSubmissionsClient({ groupedSubmissions }: Props) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      declined: 'bg-red-500/20 text-red-400 border-red-500/30',
      void_game_played: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }
    const labels: Record<string, string> = {
      pending: '⏳ Pending',
      approved: '✅ Approved',
      declined: '❌ Declined',
      void_game_played: '🕳️ Void - Game Played',
      expired: '⏰ Expired',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    )
  }

  const handleAction = async (busy: string, submissionIds: string[], action: 'approve' | 'decline') => {
    setBusyKey(busy)
    setActionError(null)

    const notifyDecision = async (outcome: 'approved' | 'declined') => {
      try {
        await fetch('/api/admin/backdoor/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionIds, outcome }),
        })
      } catch (e) {}
    }

    try {
      if (action === 'approve') {
        const res = await fetch('/api/admin/backdoor/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionIds }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Approve failed')
        }
      } else {
        // Decline
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Scoped to exactly the ids passed in: declining one manager's claim
        // must leave the other manager's claim reviewable.
        const { error: declineErr } = await supabase
          .from('backdoor_submissions')
          .update({ status: 'declined', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .in('id', submissionIds)
        if (declineErr) throw new Error(declineErr.message)

        await notifyDecision('declined')
      }

      setActionError(null)
      router.refresh()
    } catch (err: any) {
      setActionError(err.message || 'Action failed')
    } finally {
      setBusyKey(null)
    }
  }

  if (groupedSubmissions.length === 0) {
    return (
      <div className="card p-12 text-center text-text-muted">
        <AlertTriangle className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <p>No backdoor submissions found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">All Submissions ({groupedSubmissions.length} fixtures)</h2>
        <button
          onClick={() => router.refresh()}
          disabled={busyKey !== null}
          className="btn-outline text-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${busyKey ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}

      <div className="space-y-4">
        {groupedSubmissions.map(([fixtureId, submissions]) => {
          const fixture = submissions[0] as unknown as { fixtures: Fixture }
          const f = fixture.fixtures
          const teams = `${f.home_team.name} vs ${f.away_team.name}`
          const isPending = submissions.some(s => s.status === 'pending')
          const hasScreenshot = submissions.some(s => s.screenshot_url)
          // Only the still-pending claims count: the page loads every historical
          // submission for the fixture, and approving a stale one would write a
          // wrong score.
          // Only plain reports pair up into the 0-0 "approve both" decision —
          // a dispute is always its own 3-0 / keep-the-result call.
          const pendingIds = submissions.filter(s => s.status === 'pending' && !s.is_dispute).map(s => s.id)
          const bothKey = `both:${fixtureId}`
          const hasDispute = submissions.some(s => s.is_dispute)
          const disputePending = submissions.some(s => s.is_dispute && s.status === 'pending')

          return (
            <div key={fixtureId} className="card p-4 border-l-4 border-l-gold/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-text-primary">{teams}</h3>
                  <p className="text-text-muted text-sm mt-1">
                    {f.scheduled_date} • Fixture: {f.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {hasDispute && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        disputePending
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                          : 'bg-indigo-500/10 text-indigo-300/70 border-indigo-500/30'
                      }`}
                    >
                      ⚖️ Dispute review
                    </span>
                  )}
                  {getStatusBadge(submissions[0]?.status || 'pending')}
                  {pendingIds.length > 1 && (
                    <button
                      onClick={() => handleAction(bothKey, pendingIds, 'approve')}
                      disabled={busyKey !== null}
                      title="Records the match as a 0-0 draw and marks every pending claim approved"
                      className="btn-outline text-xs py-1.5 px-3"
                    >
                      {busyKey === bothKey ? 'Approving...' : 'Approve both (0-0)'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`rounded-lg p-4 border ${
                      sub.is_dispute
                        ? 'bg-navy-light border-indigo-500/40 border-l-4 border-l-indigo-400'
                        : 'bg-navy-light border-navy-border'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {sub.is_dispute && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold border bg-indigo-500/20 text-indigo-300 border-indigo-500/40">
                            ⚖️ Dispute
                          </span>
                        )}
                        <span className="font-medium text-text-primary">
                          {sub.submitter_phone} ({sub.side_claimed === 'home' ? 'Away' : 'Home'} team)
                        </span>
                        {sub.screenshot_url && (
                          <a
                            href={sub.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline text-xs"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Screenshot
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">
                          Submitted: {new Date(sub.created_at).toLocaleString()}
                        </span>
                        {sub.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(sub.id, [sub.id], 'approve')}
                                disabled={busyKey !== null}
                                className="btn-gold text-xs py-1.5 px-3"
                              >
                                {busyKey === sub.id
                                  ? 'Saving...'
                                  : sub.is_dispute
                                    ? 'Uphold dispute (3-0)'
                                    : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleAction(sub.id, [sub.id], 'decline')}
                                disabled={busyKey !== null}
                                className="btn-outline text-xs py-1.5 px-3 text-red-400 border-red-500/30 hover:bg-red-500/10"
                              >
                                {busyKey === sub.id
                                  ? 'Saving...'
                                  : sub.is_dispute
                                    ? 'Reject · keep result'
                                    : 'Decline'}
                              </button>
                            </div>
                        )}
                        {sub.status !== 'pending' && (
                          <span className="text-xs text-text-muted">
                            Reviewed: {sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>

                    {sub.is_dispute && (
                      <div className="mt-2 rounded border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                        <p className="text-xs text-text-primary">
                          <span className="font-bold text-indigo-300">Dispute explanation:</span>{' '}
                          {sub.dispute_note || '—'}
                        </p>
                        {sub.status === 'pending' && (
                          <p className="mt-1 text-xs text-text-muted">
                            Upholding gives the disputer a 3-0 win and overturns the report they are appealing.
                            Rejecting leaves the result exactly as it stands.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}