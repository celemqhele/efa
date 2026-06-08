'use client'

import { useState } from 'react'
import { Button } from './Button'

interface Props {
  teamId: string
  teamName: string
  hasPending: boolean
}

export default function ApplyManagerButton({ teamId, teamName, hasPending }: Props) {
  const [pending, setPending] = useState(hasPending)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleApply() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/teams/apply-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit application')
      setPending(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-600">
        <span className="text-sm font-medium">Application pending — awaiting admin review</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Button
        onClick={handleApply}
        isLoading={loading}
        variant="secondary"
        className="w-full"
      >
        Apply to Manage {teamName}
      </Button>
    </div>
  )
}
