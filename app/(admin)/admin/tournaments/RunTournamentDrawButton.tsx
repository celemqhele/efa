'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notifications'

interface Props {
  tournamentId: string
  tournamentName: string
  type: string
}

export default function RunTournamentDrawButton({ tournamentId, tournamentName, type }: Props) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ groups?: any[]; pairings?: any[]; iterations?: number } | null>(null)
  const router = useRouter()

  // Draw settings
  const [numGroups, setNumGroups] = useState(4)
  const [teamsPerGroup, setTeamsPerGroup] = useState(3)
  const [numRounds, setNumRounds] = useState(2)
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2)

  // Only show for tournament types that need group/KO draws
  if (!['tournament_club', 'tournament_international'].includes(type)) return null

  async function handleRunDraw() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/tournament-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          num_groups: numGroups,
          teams_per_group: teamsPerGroup,
          num_rounds: numRounds,
          qualifiers_per_group: qualifiersPerGroup,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Draw failed')

      setResult(data)
      router.refresh()
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
        className="btn-outline text-[10px] py-1 px-2 flex-1"
        disabled={loading}
      >
        Run Draw
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="bg-bg-surface rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-foreground-primary mb-2">Tournament Draw</h3>
            <p className="text-xs text-text-muted mb-4">
              {result
                ? 'Draw completed. Groups and standings have been created.'
                : `Configure groups and run the draw for ${tournamentName}.`}
            </p>

            {!result && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="form-label">Number of Groups</label>
                    <input
                      type="number"
                      min="1"
                      value={numGroups}
                      onChange={(e) => setNumGroups(parseInt(e.target.value) || 1)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Teams per Group</label>
                    <input
                      type="number"
                      min="2"
                      value={teamsPerGroup}
                      onChange={(e) => setTeamsPerGroup(parseInt(e.target.value) || 2)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Rounds (1=Single, 2=H&A)</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={numRounds}
                      onChange={(e) => setNumRounds(parseInt(e.target.value) || 1)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="form-label">Qualifiers per Group</label>
                    <input
                      type="number"
                      min="1"
                      value={qualifiersPerGroup}
                      onChange={(e) => setQualifiersPerGroup(parseInt(e.target.value) || 1)}
                      className="input-field"
                    />
                  </div>
                </div>
                <p className="text-xs text-text-muted mb-4">
                  Total teams required: <strong className="text-gold">{numGroups * teamsPerGroup}</strong>
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-foreground-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRunDraw}
                    disabled={loading}
                    className="px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Drawing...' : 'Run Draw'}
                  </button>
                </div>
              </>
            )}

            {result?.groups && (
              <div className="space-y-3 mb-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Groups</p>
                {result.groups.map((g: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg bg-navy-light border border-navy-border">
                    <span className="text-xs font-bold text-gold">Group {g.name}</span>
                    <span className="text-xs text-text-muted ml-2">({g.teamCount} teams)</span>
                  </div>
                ))}
                <p className="text-[10px] text-text-muted">Iterations: {result.iterations}</p>
              </div>
            )}

            {result?.pairings && (
              <div className="space-y-2 mb-4">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Knockout Pairings</p>
                {result.pairings.map((p: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-navy-light border border-navy-border text-xs text-foreground-primary">
                    {p.seeded} vs {p.unseeded}
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowConfirm(false); setResult(null) }}
                  className="px-4 py-2 bg-gold text-navy text-sm font-bold rounded-lg hover:bg-gold-light transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
