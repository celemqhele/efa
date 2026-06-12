'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Dna, Check } from 'lucide-react'

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
      setMessage(`${data.updated} team${data.updated !== 1 ? 's' : ''} updated`)
      setStatus('done')
    } catch (err: any) {
      setMessage(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        onClick={handleRefresh}
        isLoading={status === 'loading'}
        variant="secondary"
        className="text-xs"
      >
        <Dna className="w-4 h-4" /> Refresh Team DNA
      </Button>
      {message && (
        <span className={`text-xs ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {status === 'done' && <Check className="w-3.5 h-3.5 inline" />} {message}
        </span>
      )}
    </div>
  )
}

