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

interface MobileProps {
  data: {
    polls: Poll[]
  }
}

function getCreatorName(poll: Poll): string {
  const c = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
  return c?.username ?? 'Unknown'
}

export default function Mobile({ data }: MobileProps) {
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
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl p-4">
        <Vote className="w-6 h-6 text-accent shrink-0" />
        <div>
          <h1 className="text-lg font-bold text-text-primary">Polls</h1>
          <p className="text-text-muted text-xs">Browse active and past polls</p>
        </div>
      </div>

      {polls.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-3xl mb-3">∅</p>
          <p className="text-text-muted text-sm">No polls available yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {openPolls.length > 0 && (
            <section>
              <h2 className="font-semibold text-text-primary mb-2 flex items-center gap-2 text-sm">
                <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
                Open Polls ({openPolls.length})
              </h2>
              <div className="space-y-3">
                {openPolls.map((poll) => (
                  <div key={poll.id} className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-text-primary text-sm">{poll.title}</h3>
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-feedback-success/10 border-feedback-success/30 text-feedback-success">
                          Open
                        </span>
                      </div>
                      {poll.description && (
                        <p className="text-xs text-text-muted line-clamp-2">{poll.description}</p>
                      )}
                      <p className="text-[10px] text-text-muted">
                        Created {new Date(poll.created_at).toLocaleDateString()} by {getCreatorName(poll)}
                      </p>
                    </div>
                    <Link href={`/polls/${poll.share_code}`} className="block min-h-[48px] flex items-center justify-center border-t border-border text-sm font-medium text-accent hover:bg-accent/5 transition-colors">
                      Vote Now →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {visibleClosed.length > 0 && (
            <section>
              <h2 className="font-semibold text-text-primary mb-2 flex items-center gap-2 text-sm">
                <span className="w-1 h-4 rounded-full bg-border shrink-0" />
                Closed Polls
              </h2>
              <div className="space-y-3">
                {visibleClosed.map((poll) => (
                  <div key={poll.id} className="bg-bg-elevated border border-border rounded-xl overflow-hidden opacity-70">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-text-primary text-sm">{poll.title}</h3>
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-bg-elevated border-border text-text-muted">
                          Closed
                        </span>
                      </div>
                      {poll.description && (
                        <p className="text-xs text-text-muted line-clamp-2">{poll.description}</p>
                      )}
                      <p className="text-[10px] text-text-muted">
                        Created {new Date(poll.created_at).toLocaleDateString()} by {getCreatorName(poll)}
                        {poll.closed_at && ` · Closed ${new Date(poll.closed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Link href={`/polls/${poll.share_code}`} className="block min-h-[48px] flex items-center justify-center border-t border-border text-sm font-medium text-text-muted hover:text-accent transition-colors">
                      View Results →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {oldClosed.length > 0 && (
            <div className="text-center">
              <Button
                variant="ghost"
                className="min-h-[48px]"
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
