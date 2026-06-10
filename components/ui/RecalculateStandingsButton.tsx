'use client'

import { useState } from 'react'
import { Button } from './Button'

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

      const { standingsRowsWritten: s, groupRowsWritten: g, fixturesProcessed: f } = data
      const rows = (s ?? 0) + (g ?? 0)
      setMessage(rows > 0
        ? `✓ Done — ${rows} teams, ${f} fixtures`
        : `✓ Done — ${f} fixtures processed`)
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  if (status === 'confirm') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted">Rebuild from scratch?</span>
        <Button
          onClick={handleConfirm}
          variant="destructive"
          className="text-xs"
        >
          Yes, recalculate
        </Button>
        <Button
          onClick={() => setStatus('idle')}
          variant="secondary"
          className="text-xs"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        onClick={() => { setStatus('confirm'); setMessage('') }}
        isLoading={status === 'loading'}
        variant="secondary"
        className="text-xs"
      >
        ⟳ Recalculate Standings
      </Button>
      {message && (
        <span className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </span>
      )}
    </div>
  )
}

