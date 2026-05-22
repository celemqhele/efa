'use client'

import { useState } from 'react'

interface Props {
  tournamentId: string
  tournamentName: string
}

export default function RecalculateStandingsButton({ tournamentId, tournamentName }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleClick() {
    if (!confirm(`Recalculate standings for "${tournamentName}" from all confirmed results?\n\nThis will clear and rebuild the table from scratch.`)) return

    setStatus('loading')
    setMessage('')

    try {
      const res = await fetch('/api/admin/recalculate-standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')

      const { league_fixtures_processed: l, group_fixtures_processed: g } = data
      const parts = []
      if (l > 0) parts.push(`${l} league result${l !== 1 ? 's' : ''}`)
      if (g > 0) parts.push(`${g} group result${g !== 1 ? 's' : ''}`)
      setMessage(parts.length ? `Done — processed ${parts.join(' + ')}` : 'Done — no confirmed results found')
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {status === 'loading' ? (
          <>
            <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
            Calculating…
          </>
        ) : (
          <>
            <span>⟳</span> Recalculate Standings
          </>
        )}
      </button>
      {message && (
        <span className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
