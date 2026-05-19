'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const POSTPONE_REASONS = [
  'Internet / connection outage',
  'Load shedding (power outage)',
  'Device failure or repair',
  'Medical leave / illness',
  'Work or study commitments',
  'International duty (national team)',
  'Pre-arranged vacation / travel',
  'Personal emergency',
  'eFootball server maintenance',
  'Game or system update downtime',
  'Other',
]

interface Props {
  teamId: string
  teamName: string
  onClose: () => void
}

export default function BatchPostponeModal({ teamId, teamName, onClose }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [reason, setReason] = useState(POSTPONE_REASONS[0])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ postponed: number; message?: string } | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (toDate < fromDate) {
      setError('End date must be on or after start date.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/batch-postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, from_date: fromDate, to_date: toDate, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResult(data)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-slate-900 font-bold">Batch Postpone</h2>
            <p className="text-slate-500 text-xs mt-0.5">{teamName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-xl leading-none">×</button>
        </div>

        {result ? (
          <div className="p-8 text-center space-y-3">
            {result.postponed > 0 ? (
              <>
                <p className="text-2xl">✅</p>
                <p className="text-slate-900 font-semibold">
                  {result.postponed} fixture{result.postponed !== 1 ? 's' : ''} rescheduled
                </p>
                <p className="text-slate-400 text-sm">
                  Games have been spread out after {toDate}, max 3 per day.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl">ℹ️</p>
                <p className="text-slate-400 text-sm">{result.message ?? 'No fixtures found in that range.'}</p>
              </>
            )}
            <button onClick={onClose} className="btn-gold text-sm px-6 mt-2">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-300">
              All scheduled fixtures for {teamName} in this date range will be moved to dates after the unavailability period, spread at max 3 per day.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                required
              >
                {POSTPONE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-outline text-sm flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-gold text-sm flex-1 disabled:opacity-50">
                {loading ? 'Processing…' : 'Postpone Fixtures'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
