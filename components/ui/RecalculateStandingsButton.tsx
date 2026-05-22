'use client'

import { useState } from 'react'

interface Props {
  tournamentId: string
  tournamentName: string
}

export default function RecalculateStandingsButton({ tournamentId }: Props) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleConfirm() {
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
      if (l > 0) parts.push(`${l} league`)
      if (g > 0) parts.push(`${g} group`)
      setMessage(parts.length ? `✓ Done (${parts.join(' + ')} results)` : '✓ Done — no results found')
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  if (status === 'confirm') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">Rebuild from scratch?</span>
        <button
          onClick={handleConfirm}
          className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
        >
          Yes, recalculate
        </button>
        <button
          onClick={() => setStatus('idle')}
          className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={() => { setStatus('confirm'); setMessage('') }}
        disabled={status === 'loading'}
        className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {status === 'loading' ? (
          <>
            <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
            Calculating…
          </>
        ) : (
          <>⟳ Recalculate Standings</>
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
