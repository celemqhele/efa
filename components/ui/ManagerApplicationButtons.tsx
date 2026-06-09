'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './Button'

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

  if (done) return <span className="text-xs text-text-muted italic">Done</span>

  return (
    <div className="space-y-space-1">
      {error && <p className="text-feedback-error text-xs">{error}</p>}
      <div className="flex gap-space-2">
        <Button
          onClick={() => handle('approve')}
          isLoading={loading === 'approve'}
          disabled={!!loading && loading !== 'approve'}
          variant="primary"
          className="text-xs py-space-1 px-space-3"
        >
          Approve
        </Button>
        <Button
          onClick={() => handle('deny')}
          isLoading={loading === 'deny'}
          disabled={!!loading && loading !== 'deny'}
          variant="destructive"
          className="text-xs py-space-1 px-space-3"
        >
          Deny
        </Button>
      </div>
    </div>
  )
}

