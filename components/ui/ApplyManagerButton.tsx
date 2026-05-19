'use client'

import { useState } from 'react'

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
      <button
        onClick={handleApply}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#c9a84c]/40 bg-[#c9a84c]/5 text-[#c9a84c] font-semibold text-sm hover:bg-[#c9a84c]/10 hover:border-[#c9a84c]/60 transition-all disabled:opacity-50"
      >
        {loading ? 'Submitting…' : `Apply to Manage ${teamName}`}
      </button>
    </div>
  )
}
