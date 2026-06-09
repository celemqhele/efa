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
      <div className="flex items-center gap-space-2 px-space-4 py-space-3 rounded-lg bg-feedback-warning/10 border border-feedback-warning/30 text-feedback-warning">
        <span className="text-sm font-medium">Application pending — awaiting admin review</span>
      </div>
    )
  }

  return (
    <div className="space-y-space-2">
      {error && (
        <p className="text-feedback-error text-sm bg-feedback-error/10 border border-feedback-error/30 rounded-md px-space-3 py-space-2">
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

