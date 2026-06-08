'use client'

import { useState } from 'react'

export default function RecalculateManagerStatsButton({ tournamentId, tournamentName }: { tournamentId: string, tournamentName: string }) {
  const [loading, setLoading] = useState(false)

  async function handleRecalculate() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/recalculate-manager-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      alert(`Successfully recalculated manager stats for ${tournamentName}`)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRecalculate}
      disabled={loading}
      className="w-full text-xs px-3 py-1.5 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 transition-colors disabled:opacity-60"
    >
      {loading ? 'Recalculating...' : 'Recalculate Manager Stats'}
    </button>
  )
}
