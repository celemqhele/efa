'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ModalPortal from '@/components/ui/ModalPortal'

export default function DeleteTournamentButton({ tournamentId, tournamentName }: {
  tournamentId: string
  tournamentName: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/delete-tournament', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to delete')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] py-1 px-2 rounded-md bg-feedback-error/20 text-feedback-error border border-feedback-error/30 hover:bg-feedback-error/30 transition-colors"
      >
        Delete
      </button>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative z-10 w-full max-w-sm bg-bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4 animate-scale-in">
              <h3 className="text-lg font-bold text-foreground-primary">Delete Tournament?</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Are you sure you want to delete &ldquo;{tournamentName}&rdquo;? This action cannot be undone.
              </p>
              {error && (
                <p className="text-xs text-feedback-error bg-feedback-error/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-text-muted hover:text-foreground-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-feedback-error/80 hover:bg-feedback-error rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}
