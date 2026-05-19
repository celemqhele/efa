'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  applicationId: string
}

export default function ManagerApplicationButtons({ applicationId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'deny' | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handle(action: 'approve' | 'deny') {
    setLoading(action)
    setError('')
    try {
      const res = await fetch(`/api/admin/manager-applications/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Failed to ${action}`)
      setDone(true)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  if (done) return <span className="text-xs text-slate-400 italic">Done</span>

  return (
    <div className="space-y-1">
      {error && <p className="text-red-500 text-xs">{error}</p>}
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
    </div>
  )
}
