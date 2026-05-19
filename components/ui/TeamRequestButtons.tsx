'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  requestId: string
}

export default function TeamRequestButtons({ requestId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [done, setDone] = useState(false)

  async function handle(action: 'approve' | 'deny') {
    setLoading(action)
    try {
      const res = await fetch('/api/admin/team-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action }),
      })
      if (res.ok) {
        setDone(true)
        router.refresh()
      }
    } finally {
      setLoading(null)
    }
  }

  if (done) return <span className="text-xs text-slate-400 italic">Done</span>

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handle('approve')}
        disabled={!!loading}
        className="btn-gold text-xs py-1 px-3 disabled:opacity-50"
      >
        {loading === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => handle('deny')}
        disabled={!!loading}
        className="btn-danger text-xs py-1 px-3 disabled:opacity-50"
      >
        {loading === 'deny' ? '…' : 'Deny'}
      </button>
    </div>
  )
}
