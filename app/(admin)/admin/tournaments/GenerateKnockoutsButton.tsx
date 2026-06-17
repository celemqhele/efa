'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { notify } from '@/lib/notifications'

interface Qualifier {
  team_id: string
  group_name: string
  team: {
    name: string
    logo_league_folder: string
    logo_team_slug: string
  }
}

interface Props {
  tournamentId: string
  tournamentName: string
  type: string
  className?: string
}

export default function GenerateKnockoutsButton({ tournamentId, tournamentName, type, className = '' }: Props) {
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([])
  const router = useRouter()

  useEffect(() => {
    if (showConfirm) {
      fetchQualifiers()
    }
  }, [showConfirm])

  if (!['tournament_club', 'tournament_international'].includes(type)) return null

  async function fetchQualifiers() {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/admin/preview-knockouts?tournament_id=${tournamentId}`)
      const data = await res.json()
      if (res.ok) {
        setQualifiers(data.qualifiers || [])
      }
    } catch (err) {
      console.error('Failed to fetch qualifiers:', err)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-knockouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tournament_id: tournamentId, 
          shuffle,
          manual_qualifiers: qualifiers.map(q => q.team_id)
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate knockouts')

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
        className={className || "text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors"}
        disabled={loading}
      >
        Generate Knockouts
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-bg-surface rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-foreground-primary mb-2">Generate Knockout Bracket</h3>
            <p className="text-xs text-text-muted mb-4">
              Review the qualifying teams for {tournamentName}. 
              All remaining matches will be created as TBC placeholders.
            </p>

            {previewLoading ? (
              <div className="py-8 text-center">
                <div className="w-8 h-8 border-4 border-gold/20 border-t-gold rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-text-muted">Loading standings...</p>
              </div>
            ) : qualifiers.length > 0 ? (
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Qualifying Teams</p>
                {qualifiers.map((q, idx) => (
                  <div key={q.team_id} className="flex items-center gap-3 p-2 rounded-lg bg-navy-light border border-navy-border">
                    <span className="text-[10px] font-bold text-text-muted w-4">{idx + 1}</span>
                    <Image
                      src={getTeamLogo(q.team.logo_league_folder, q.team.logo_team_slug, 'standings_row')}
                      alt={q.team.name} width={20} height={20} className="object-contain"
                    />
                    <span className="text-xs font-medium text-foreground-primary flex-1 truncate">{q.team.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/20 font-bold">
                      Group {q.group_name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-red-50 text-red-500 rounded-lg text-xs mb-6">
                No qualifiers found. Ensure all group matches are confirmed.
              </div>
            )}

            <div className="flex items-center gap-3 mb-6 p-3 bg-bg-surface rounded-xl border border-border">
              <input
                type="checkbox"
                id="shuffle"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="w-4 h-4 text-gold border-border rounded focus:ring-gold"
              />
              <label htmlFor="shuffle" className="text-sm font-medium text-foreground-secondary">
                Shuffle qualifying teams?
                <span className="block text-[10px] text-text-muted font-normal mt-0.5">
                  If checked, pairings will be randomized instead of Group A1 vs B2, etc.
                </span>
              </label>
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
                disabled={loading || qualifiers.length < 2}
                className="flex-1 px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

