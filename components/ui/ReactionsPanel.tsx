'use client'

import { useState } from 'react'

const EMOJI_REACTIONS = ['🔥', '😬', '😭', '🐐']

interface Props {
  fixtureId: string
  initialCounts: Record<string, number>
  initialUserReactions: string[]
  userId: string | null
}

export default function ReactionsPanel({ fixtureId, initialCounts, initialUserReactions, userId }: Props) {
  const [counts, setCounts] = useState(initialCounts)
  const [userReactions, setUserReactions] = useState(new Set(initialUserReactions))
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(emoji: string) {
    if (!userId || loading) return

    const wasActive = userReactions.has(emoji)

    // Optimistic update
    setCounts((prev) => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] ?? 0) + (wasActive ? -1 : 1)) }))
    setUserReactions((prev) => {
      const next = new Set(prev)
      if (wasActive) next.delete(emoji)
      else next.add(emoji)
      return next
    })

    setLoading(emoji)
    try {
      await fetch(`/api/fixtures/${fixtureId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
    } catch {
      // Revert on error
      setCounts((prev) => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] ?? 0) + (wasActive ? 1 : -1)) }))
      setUserReactions((prev) => {
        const next = new Set(prev)
        if (wasActive) next.add(emoji)
        else next.delete(emoji)
        return next
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        {EMOJI_REACTIONS.map((emoji) => {
          const isActive = userReactions.has(emoji)
          const isLoading = loading === emoji
          return (
            <button
              key={emoji}
              onClick={() => toggle(emoji)}
              disabled={!userId || isLoading}
              title={!userId ? 'Sign in to react' : undefined}
              className={`flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl border transition-all select-none ${
                isActive
                  ? 'border-[#c9a84c]/60 bg-[#c9a84c]/10 scale-105'
                  : 'border-slate-200 hover:border-[#c9a84c]/30 hover:bg-slate-50'
              } ${!userId ? 'opacity-60 cursor-default' : 'cursor-pointer active:scale-95'}`}
            >
              <span className={`text-2xl transition-transform ${isLoading ? 'opacity-50' : ''}`}>{emoji}</span>
              <span className={`text-sm font-semibold tabular-nums ${isActive ? 'text-[#c9a84c]' : 'text-slate-700'}`}>
                {counts[emoji] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
      {!userId && (
        <p className="text-xs text-slate-400">Sign in to react to this match.</p>
      )}
    </div>
  )
}
