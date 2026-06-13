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

interface Props {
  polls: Poll[]
}

export default function PollListClient({ polls }: Props) {
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

  function getCreatorName(poll: Poll): string {
    const c = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
    return c?.username ?? 'Unknown'
  }

  return (
    <div className="min-h-screen bg-bg-base px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-space-6">
        {/* Header */}
        <div className="flex items-center gap-space-3">
          <Vote className="w-7 h-7 text-accent" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Polls</h1>
            <p className="text-text-muted text-sm">Browse active and past polls</p>
          </div>
        </div>

        {polls.length === 0 ? (
          <Card className="p-space-12 text-center">
            <p className="text-4xl mb-space-4">∅</p>
            <p className="text-text-muted">No polls available yet.</p>
          </Card>
        ) : (
          <>
            {/* Open polls */}
            {openPolls.length > 0 && (
              <section>
                <h2 className="font-semibold text-text-primary mb-space-3">Open Polls</h2>
                <div className="space-y-space-3">
                  {openPolls.map((poll) => (
                    <PollCard key={poll.id} poll={poll} creator={getCreatorName(poll)} />
                  ))}
                </div>
              </section>
            )}

            {/* Closed polls */}
            {visibleClosed.length > 0 && (
              <section>
                <h2 className="font-semibold text-text-primary mb-space-3">Closed Polls</h2>
                <div className="space-y-space-3">
                  {visibleClosed.map((poll) => (
                    <PollCard key={poll.id} poll={poll} creator={getCreatorName(poll)} closed />
                  ))}
                </div>
              </section>
            )}

            {/* Toggle for old closed polls */}
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
          </>
        )}
      </div>
    </div>
  )
}

function PollCard({ poll, creator, closed }: { poll: Poll; creator: string; closed?: boolean }) {
  return (
    <Link href={`/polls/${poll.share_code}`} className="block">
      <Card className={`p-space-4 transition-colors hover:border-accent/40 ${closed ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-space-3">
          <div className="space-y-space-1 min-w-0">
            <h3 className="font-medium text-text-primary text-sm">{poll.title}</h3>
            {poll.description && (
              <p className="text-xs text-text-muted line-clamp-2">{poll.description}</p>
            )}
            <p className="text-[10px] text-text-muted">
              Created {new Date(poll.created_at).toLocaleDateString()} by {creator}
              {poll.closed_at && ` · Closed ${new Date(poll.closed_at).toLocaleDateString()}`}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] px-space-2 py-space-0.5 rounded-full border font-medium ${
            poll.status === 'open'
              ? 'bg-feedback-success/10 border-feedback-success/30 text-feedback-success'
              : 'bg-bg-elevated border-border text-text-muted'
          }`}>
            {poll.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
      </Card>
    </Link>
  )
}
