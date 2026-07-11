'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'

interface Props {
  tournamentId: string
  tournamentName: string
  fixtureCount: number
  unscheduledCount?: number
}

export default function RescheduleFixturesButton({
  tournamentId,
  tournamentName,
  fixtureCount,
  unscheduledCount,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [result, setResult] = useState<{ count: number; total: number } | null>(null)
  const router = useRouter()

  if (fixtureCount === 0) return null

  async function handleReschedule() {
    setDialogOpen(false)
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/schedule-fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reschedule failed')
      setResult({ count: data.count, total: data.total })
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const hasUnscheduled = unscheduledCount !== undefined ? unscheduledCount > 0 : true

  return (
    <>
      <BottomSheet open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <h3 className="text-text-primary font-bold text-lg mb-1">Reschedule Fixtures</h3>
        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
          This reassigns dates for all unscheduled fixtures in <strong>{tournamentName}</strong>.
          Existing dates and confirmed results are untouched.
        </p>
        {!hasUnscheduled && (
          <p className="text-amber-400 text-sm mb-4 leading-relaxed">
            No unscheduled fixtures found. All fixtures already have dates assigned.
          </p>
        )}
        <div className="flex gap-space-2 justify-end">
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleReschedule} disabled={!hasUnscheduled}>
            Reschedule
          </Button>
        </div>
      </BottomSheet>

      {error && <span className="text-red-400 text-[10px]">{error}</span>}
      {result && !error && (
        <span className="text-green-400 text-[10px]">
          Scheduled {result.count}/{result.total}
        </span>
      )}
      <button
        onClick={() => {
          if (result) {
            setDialogOpen(false)
            setResult(null)
          }
          setDialogOpen(true)
        }}
        disabled={loading}
        className="btn-gold text-[10px] py-1 px-2"
      >
        {loading ? (
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
            Scheduling...
          </span>
        ) : (
          'Reschedule'
        )}
      </button>
    </>
  )
}
