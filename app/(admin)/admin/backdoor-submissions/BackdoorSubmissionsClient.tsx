'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import WhatsAppButton from '@/components/ui/WhatsAppButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Submission {
  id: string
  fixture_id: string
  submitter_phone: string
  side_claimed: 'home' | 'away'
  screenshot_url: string
  status: 'pending' | 'approved' | 'declined' | 'void_game_played' | 'expired'
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadingFixtureId, setLoadingFixtureId] = useState<string | null>(null)
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

  const handleAction = async (fixtureId: string, submissionIds: string[], action: 'approve' | 'decline') => {
    setLoadingFixtureId(fixtureId)
    setActionError(null)

    try {
      if (action === 'approve') {
        // Determine outcome based on number of submissions
        const { data: submissionsData } = await supabase
          .from('backdoor_submissions')
          .select('id, side_claimed')
          .in('id', submissionIds)

        let homeScore = 0, awayScore = 0
        if (submissionsData?.length === 2) {
          homeScore = 0; awayScore = 0
        } else if (submissionsData?.length === 1) {
          if (submissionsData[0].side_claimed === 'home') {
            homeScore = 3; awayScore = 0
          } else {
            homeScore = 0; awayScore = 3
          }
        }

        // Get admin user ID
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        // Insert result confirmation
        await supabase.from('result_confirmations').insert({
          fixture_id: fixtureId,
          home_score: homeScore,
          away_score: awayScore,
          submitted_by: user.id,
        })

        // Upsert result
        await supabase.from('results').upsert({
          fixture_id: fixtureId,
          home_score: homeScore,
          away_score: awayScore,
          finalised_by: user.id,
        }, { onConflict: 'fixture_id' })

        // Update fixture status
        await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fixtureId)

        // Update backdoor submissions
        await supabase
          .from('backdoor_submissions')
          .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .in('id', submissionIds)

        // Recalculate standings
        const { data: fixData } = await supabase.from('fixtures').select('tournament_id').eq('id', fixtureId).single()
        if (fixData?.tournament_id) {
          try { await fetch('/api/admin/recalculate-standings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tournament_id: fixData.tournament_id })
          }) } catch (e) {}
        }
      } else {
        // Decline
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        await supabase
          .from('backdoor_submissions')
          .update({ status: 'declined', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .in('id', submissionIds)
      }

      setRefreshKey(k => k + 1)
    } catch (err: any) {
      setActionError(err.message || 'Action failed')
    } finally {
      setLoadingFixtureId(null)
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
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={!!loadingFixtureId}
          className="btn-outline text-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loadingFixtureId ? 'animate-spin' : ''}`} />
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
                  {getStatusBadge(submissions[0]?.status || 'pending')}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {submissions.map((sub) => (
                  <div key={sub.id} className="bg-navy-light rounded-lg p-4 border border-navy-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-text-primary">
                          {sub.submitter_phone} ({sub.side_claimed === 'home' ? 'Home' : 'Away'} team)
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
                              onClick={() => handleAction(fixtureId, submissions.map(s => s.id), 'approve')}
                              disabled={loadingFixtureId === fixtureId}
                              className="btn-gold text-xs py-1.5 px-3"
                            >
                              {loadingFixtureId === fixtureId ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(fixtureId, submissions.map(s => s.id), 'decline')}
                              disabled={loadingFixtureId === fixtureId}
                              className="btn-outline text-xs py-1.5 px-3 text-red-400 border-red-500/30 hover:bg-red-500/10"
                            >
                              {loadingFixtureId === fixtureId ? 'Declining...' : 'Decline'}
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