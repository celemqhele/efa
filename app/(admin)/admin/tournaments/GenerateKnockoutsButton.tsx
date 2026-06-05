'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tournamentId: string
  tournamentName: string
  type: string
}

export default function GenerateKnockoutsButton({ tournamentId, tournamentName, type }: Props) {
  const [loading, setLoading] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  if (!['ucl', 'europa'].includes(type)) return null

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-knockouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: tournamentId, shuffle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate knockouts')

      router.refresh()
      setShowConfirm(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-gold text-[10px] py-1 px-2 flex-1"
        disabled={loading}
      >
        Generate Knockouts
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Generate Knockout Bracket</h3>
            <p className="text-sm text-slate-500 mb-4">
              This will create the full knockout bracket (SF and Final) for {tournamentName}. 
              All remaining matches will be created as TBC placeholders.
            </p>

            <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                id="shuffle"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="w-4 h-4 text-gold border-slate-300 rounded focus:ring-gold"
              />
              <label htmlFor="shuffle" className="text-sm font-medium text-slate-700">
                Shuffle qualifying teams?
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  If checked, teams won&apos;t follow seed/group order.
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
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
