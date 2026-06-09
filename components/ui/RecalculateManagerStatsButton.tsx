'use client'

import { useState } from 'react'
import { Button } from './Button'

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
    <Button
      onClick={handleRecalculate}
      isLoading={loading}
      variant="secondary"
      className="w-full text-xs"
    >
      Recalculate Manager Stats
    </Button>
  )
}

