'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

type PreviewFixture = {
  id: string
  matchday: number | null
  scheduled_date: string | null
  home_team: { name: string } | null
  away_team: { name: string } | null
}

interface Props {
  teamId: string
  teamName: string
  onClose: () => void
}

export default function BatchPostponeModal({ teamId, teamName, onClose }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [reason, setReason] = useState(POSTPONE_REASONS[0])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // Step 2
  const [previewFixtures, setPreviewFixtures] = useState<PreviewFixture[]>([])
  const [rescheduleFrom, setRescheduleFrom] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Step 3
  const [resultCount, setResultCount] = useState(0)

  async function handlePreview() {
    if (toDate < fromDate) {
      setPreviewError('End date must be on or after start date.')
      return
    }
    setPreviewError('')
    setPreviewLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date,
          home_team:teams!fixtures_home_team_id_fkey(name),
          away_team:teams!fixtures_away_team_id_fkey(name)
        `)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .gte('scheduled_date', fromDate)
        .lte('scheduled_date', toDate + 'T23:59:59')
        .eq('status', 'scheduled')
        .order('scheduled_date', { ascending: true })

      if (error) throw new Error(error.message)

      setPreviewFixtures((data ?? []) as unknown as PreviewFixture[])
      const afterTo = new Date(toDate)
      afterTo.setDate(afterTo.getDate() + 1)
      setRescheduleFrom(afterTo.toISOString().split('T')[0])
      setStep(2)
    } catch (e: any) {
      setPreviewError(e.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirm() {
    setSubmitError('')
    setSubmitLoading(true)
    try {
      const res = await fetch('/api/admin/batch-postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          from_date: fromDate,
          to_date: toDate,
          reason,
          reschedule_from: rescheduleFrom,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setResultCount(data.postponed ?? 0)
      setStep(3)
      router.refresh()
    } catch (e: any) {
      setSubmitError(e.message)
    } finally {
      setSubmitLoading(false)
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

        {/* Step 1 — Range & reason */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-600">
              Pick the unavailability window and reason. You&apos;ll review affected fixtures before confirming.
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
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" required>
                {POSTPONE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {previewError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {previewError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-outline text-sm flex-1">
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                className="btn-gold text-sm flex-1 disabled:opacity-50"
              >
                {previewLoading ? 'Loading…' : 'Preview →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Preview fixtures + reschedule date */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            {previewFixtures.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-slate-500 text-sm">No scheduled fixtures found in that date range.</p>
              </div>
            ) : (
              <>
                <p className="text-slate-700 text-sm font-medium">
                  {previewFixtures.length} fixture{previewFixtures.length !== 1 ? 's' : ''} will be postponed:
                </p>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {previewFixtures.map((fx) => (
                    <div key={fx.id} className="flex items-center gap-2 bg-navy-light rounded-lg px-3 py-2 border border-navy-border text-xs">
                      <span className="text-slate-500 shrink-0">MD{fx.matchday}</span>
                      <span className="text-slate-900 font-medium flex-1 truncate">
                        {(fx.home_team as any)?.name} vs {(fx.away_team as any)?.name}
                      </span>
                      {fx.scheduled_date && (
                        <span className="text-slate-400 shrink-0">{fx.scheduled_date.slice(0, 10)}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="form-label">Reschedule from</label>
                  <input
                    type="date"
                    value={rescheduleFrom}
                    min={toDate}
                    onChange={(e) => setRescheduleFrom(e.target.value)}
                    className="input-field"
                    required
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    Fixtures spread starting this date, max 3 per day.
                  </p>
                </div>
              </>
            )}

            {submitError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)} className="btn-outline text-sm flex-1">
                ← Back
              </button>
              {previewFixtures.length > 0 ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitLoading}
                  className="btn-gold text-sm flex-1 disabled:opacity-50"
                >
                  {submitLoading ? 'Processing…' : 'Confirm & Postpone'}
                </button>
              ) : (
                <button type="button" onClick={onClose} className="btn-gold text-sm flex-1">
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div className="p-8 text-center space-y-3">
            <p className="text-3xl">✅</p>
            <p className="text-slate-900 font-semibold">
              {resultCount} fixture{resultCount !== 1 ? 's' : ''} rescheduled
            </p>
            <p className="text-slate-400 text-sm">
              Spread from {rescheduleFrom}, max 3 per day.
            </p>
            <button onClick={onClose} className="btn-gold text-sm px-6 mt-2">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
