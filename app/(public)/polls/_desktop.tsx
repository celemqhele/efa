'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Vote } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Poll {
  id: string
  title: string
  description: string | null
  status: string
  share_code: string
  created_at: string
  closed_at: string | null
  created_by: { username: string } | { username: string }[]
}

interface DesktopProps {
  data: {
    polls: Poll[]
  }
}

function getCreatorName(poll: Poll): string {
  const c = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
  return c?.username ?? 'Unknown'
}

export default function Desktop({ data }: DesktopProps) {
  const { polls } = data
  const [showClosed, setShowClosed] = useState(false)

  const now = Date.now()
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

  const { openPolls, recentClosed, oldClosed } = useMemo(() => {
    const open: Poll[] = []
    const recent: Poll[] = []
    const old: Poll[] = []

    for (const poll of polls) {
      if (poll.status === 'open') {
        open.push(poll)
      } else if (poll.closed_at) {
        const closedTime = new Date(poll.closed_at).getTime()
        if (now - closedTime < FORTY_EIGHT_HOURS) {
          recent.push(poll)
        } else {
          old.push(poll)
        }
      } else {
        recent.push(poll)
      }
    }

    return { openPolls: open, recentClosed: recent, oldClosed: old }
  }, [polls, now])

  const visibleClosed = showClosed ? [...recentClosed, ...oldClosed] : recentClosed

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Vote className="w-7 h-7 text-accent" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Polls</h1>
          <p className="text-text-muted text-sm">Browse active and past polls</p>
        </div>
      </div>

      {polls.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-4">∅</p>
          <p className="text-text-muted">No polls available yet.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {openPolls.length > 0 && (
            <section>
              <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
                Open Polls
              </h2>
              <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-base border-b-2 border-accent/20">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Created</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Creator</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {openPolls.map((poll) => (
                      <tr key={poll.id} className="hover:bg-accent/5 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-medium text-text-primary">{poll.title}</span>
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs max-w-xs truncate">
                          {poll.description ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">
                          {new Date(poll.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">
                          {getCreatorName(poll)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/polls/${poll.share_code}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                          >
                            Vote <span>→</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {visibleClosed.length > 0 && (
            <section>
              <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-border shrink-0" />
                Closed Polls
              </h2>
              <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-base border-b-2 border-accent/20">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Closed</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Creator</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleClosed.map((poll) => (
                      <tr key={poll.id} className="hover:bg-accent/5 transition-colors opacity-70">
                        <td className="px-5 py-4">
                          <span className="font-medium text-text-primary">{poll.title}</span>
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs max-w-xs truncate">
                          {poll.description ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">
                          {poll.closed_at ? new Date(poll.closed_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-4 text-text-muted text-xs">
                          {getCreatorName(poll)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/polls/${poll.share_code}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
                          >
                            Results <span>→</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {oldClosed.length > 0 && (
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => setShowClosed(!showClosed)}
              >
                {showClosed
                  ? `Hide older closed polls`
                  : `Show closed polls (${oldClosed.length})`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
