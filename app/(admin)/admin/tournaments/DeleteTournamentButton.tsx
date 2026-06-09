'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteTournamentButton({ tournamentId, tournamentName }: {
  tournamentId: string
  tournamentName: string
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delete-tournament', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const { error } = await res.json()
        alert(`Failed to delete: ${error}`)
      }
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 text-xs px-2 py-1.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1.5 rounded border border-slate-200 text-slate-400 hover:border-accent/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="btn-outline text-xs flex-1 text-center text-red-400 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5"
    >
      Delete
    </button>
  )
}

