'use client'

import { useState, useRef, useEffect } from 'react'

export interface ForfeitBalanceItem {
  id: string
  forfeiting_team_id: string
  half_time_note: string
  remaining: number
}

interface Props {
  teamId: string
  teamName: string
  balances: ForfeitBalanceItem[]
  onUse: (balanceId: string) => void
}

export default function ForfeitBalanceBadge({ teamId, balances, onUse }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const teamBalances = balances.filter((b) => b.forfeiting_team_id === teamId)
  const total = teamBalances.reduce((s, b) => s + b.remaining, 0)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (teamBalances.length === 0) return null

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-500/20 border-orange-500/40 text-orange-400 hover:bg-orange-500/30 transition-colors"
      >
        <span>⚖</span>
        <span>{total} forfeit{total !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-72 p-3 rounded-lg bg-bg-elevated border border-border shadow-lg z-50 space-y-2">
          {teamBalances.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-orange-500/5 border border-orange-500/10"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-foreground-primary leading-tight">{b.half_time_note}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{b.remaining} use{b.remaining !== 1 ? 's' : ''} remaining</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUse(b.id) }}
                disabled={b.remaining <= 0}
                className="shrink-0 px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-semibold hover:bg-orange-500/30 transition-colors disabled:opacity-40"
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
