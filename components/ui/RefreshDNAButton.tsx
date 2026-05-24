'use client'

import { useState } from 'react'

export default function RefreshDNAButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleRefresh() {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/admin/refresh-dna', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setMessage(`✓ ${data.updated} team${data.updated !== 1 ? 's' : ''} updated`)
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleRefresh}
        disabled={status === 'loading'}
        className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {status === 'loading' ? (
          <>
            <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
            Refreshing…
          </>
        ) : (
          <>🧬 Refresh Team DNA</>
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
