'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Props {
  tournamentId: string
  tournamentName: string
}

export default function GenerateFixturesButton({ tournamentId, tournamentName }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const router = useRouter()

  async function handleGenerate() {
    setDialogOpen(false)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/generate-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setTimeout(() => router.refresh(), 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ConfirmDialog
        open={dialogOpen}
        title="Generate Fixtures"
        message={`Create a full fixture list for "${tournamentName}"? This cannot be undone.`}
        confirmLabel={loading ? 'Generating...' : 'Generate'}
        onConfirm={handleGenerate}
        onCancel={() => setDialogOpen(false)}
      />

      {error && <span className="text-red-400 text-[10px]">{error}</span>}
      <button
        onClick={() => setDialogOpen(true)}
        disabled={loading}
        className="btn-gold text-[10px] py-1 px-2"
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
            ...ing
          </span>
        ) : (
          'Generate Fixtures'
        )}
      </button>
    </>
  )
}
