'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { notify } from '@/lib/notifications'
import { CARD_ACTION_BTN } from './card-action-classes'

interface Props {
  tournamentId: string
  tournamentName: string
  type: string
  className?: string
}

export default function GenerateFriendliesButton({ tournamentId, tournamentName, type, className = CARD_ACTION_BTN }: Props) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [matches, setMatches] = useState(1)
  const router = useRouter()

  if (type !== 'friendlies') return null

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-friendlies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tournament_id: tournamentId, 
          matches_per_team: matches
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate fixtures')

      router.refresh()
      setShowConfirm(false)
    } catch (err: any) {
      notify('Error', err.message, 'admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className={className}
        disabled={loading}
      >
        Generate Fixtures
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-bg-surface rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-foreground-primary mb-2">Generate Fixtures</h3>
            <p className="text-xs text-text-muted mb-4">
              How many matches per team for {tournamentName}?
            </p>

            <div className="mb-6">
              <label className="form-label text-xs">Matches per team</label>
              <input
                type="number"
                min="1"
                max="10"
                value={matches}
                onChange={(e) => setMatches(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-text-muted hover:text-foreground-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
