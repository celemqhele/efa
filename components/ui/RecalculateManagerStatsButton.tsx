'use client'

import { useState } from 'react'
import { Button } from './Button'

export default function RecalculateManagerStatsButton({ tournamentId, tournamentName }: { tournamentId: string, tournamentName: string }) {
  const [status, setStatus] = useState<'idle' | 'confirm' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRecalculate() {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/admin/recalculate-manager-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setMessage('✓ Stats updated')
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  if (status === 'confirm') {
    return (
      <div className="flex items-center gap-space-2 flex-wrap">
        <span className="text-[10px] text-text-muted">Rebuild manager stats?</span>
        <Button
          onClick={handleRecalculate}
          variant="destructive"
          className="text-[10px] py-1 px-2"
        >
          Confirm
        </Button>
        <Button
          onClick={() => setStatus('idle')}
          variant="secondary"
          className="text-[10px] py-1 px-2"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-space-2 flex-wrap">
      <Button
        onClick={() => { setStatus('confirm'); setMessage('') }}
        isLoading={status === 'loading'}
        variant="secondary"
        className="w-full text-xs"
      >
        Recalculate Manager Stats
      </Button>
      {message && (
        <span className={`text-[10px] ${status === 'error' ? 'text-feedback-error' : 'text-feedback-success'}`}>
          {message}
        </span>
      )}
    </div>
  )
}

