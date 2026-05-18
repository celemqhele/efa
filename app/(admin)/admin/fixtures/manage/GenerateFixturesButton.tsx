'use client'

import { useState } from 'react'

interface Props {
  tournamentId: string
  tournamentName: string
}

export default function GenerateFixturesButton({ tournamentId, tournamentName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleGenerate() {
    const confirmed = confirm(
      `Generate fixtures for "${tournamentName}"? This will create a full fixture list.`
    )
    if (!confirmed) return
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/admin/generate-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setSuccess(true)
      setTimeout(() => window.location.reload(), 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-red-400 text-xs">{error}</span>}
      {success && <span className="text-green-400 text-xs">Fixtures generated!</span>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-outline disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
            Generating...
          </span>
        ) : (
          'Generate Fixtures'
        )}
      </button>
    </div>
  )
}
