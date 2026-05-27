'use client'

import { useState } from 'react'

interface Props {
  fixtureId: string
  currentDate: string | null
  status: string
  homeTeamId: string
  homeTeamName: string
  awayTeamId: string
  awayTeamName: string
}

export default function FixtureActions({
  fixtureId,
  currentDate,
  status,
  homeTeamId,
  homeTeamName,
  awayTeamId,
  awayTeamName,
}: Props) {
  // ── Single postpone state ──────────────────────────────────────────────────
  const [showPostpone, setShowPostpone] = useState(false)
  const [newDate, setNewDate] = useState(currentDate ? currentDate.slice(0, 16) : '')
  const [postponeLoading, setPostponeLoading] = useState(false)
  const [postponeError, setPostponeError] = useState('')
  const [postponeSuccess, setPostponeSuccess] = useState(false)

  // ── Batch postpone state ───────────────────────────────────────────────────
  const [showBatch, setShowBatch] = useState(false)
  const [batchTeamId, setBatchTeamId] = useState(homeTeamId)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [batchResult, setBatchResult] = useState<{ postponed: number; message?: string } | null>(null)

  const isFinished = ['completed', 'confirmed', 'abandoned'].includes(status)

  // ── Single postpone handler ────────────────────────────────────────────────
  async function handlePostpone(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate) return
    setPostponeLoading(true)
    setPostponeError('')
    try {
      const res = await fetch('/api/admin/postpone-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, newDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to postpone')
      setPostponeSuccess(true)
      setShowPostpone(false)
    } catch (e: any) {
      setPostponeError(e.message)
    } finally {
      setPostponeLoading(false)
    }
  }

  // ── Batch postpone handler ─────────────────────────────────────────────────
  async function handleBatchPostpone(e: React.FormEvent) {
    e.preventDefault()
    setBatchError('')
    setBatchResult(null)

    if (!fromDate || !toDate || !reason.trim()) {
      setBatchError('All fields are required.')
      return
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setBatchError('From date must be before To date.')
      return
    }

    setBatchLoading(true)
    try {
      const res = await fetch('/api/admin/batch-postpone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: batchTeamId,
          from_date: fromDate,
          to_date: toDate,
          reason: reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      setBatchResult({ postponed: data.postponed, message: data.message })
      setFromDate('')
      setToDate('')
      setReason('')
    } catch (err: any) {
      setBatchError(err.message)
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isFinished && (
          <button
            onClick={() => {
              setShowPostpone(!showPostpone)
              setShowBatch(false)
            }}
            className="btn-outline text-xs py-1 px-2.5"
          >
            Postpone
          </button>
        )}
        {!isFinished && (
          <button
            onClick={() => {
              setShowBatch(!showBatch)
              setShowPostpone(false)
            }}
            className="btn-outline text-xs py-1 px-2.5"
          >
            Batch Postpone
          </button>
        )}
        {/* FIX: Shows the button for both 'scheduled' and 'awaiting_confirmation' and sets the text to 'Submit' */}
        {['scheduled', 'awaiting_confirmation'].includes(status) && (
          <a href={`/admin/results/submit?fixture=${fixtureId}`} className="btn-gold text-xs py-1 px-2.5">
            Submit
          </a>
        )}
      </div>

      {/* ── Single postpone form ───────────────────────────────────────────── */}
      {showPostpone && (
        <form
          onSubmit={handlePostpone}
          className="space-y-2 bg-navy-light p-3 rounded-lg border border-navy-border w-52"
        >
          <label className="form-label">New Date &amp; Time</label>
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field text-xs py-1.5"
            required
          />
          {postponeError && <p className="text-red-400 text-xs">{postponeError}</p>}
          {postponeSuccess && <p className="text-green-400 text-xs">Postponed!</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={postponeLoading} className="btn-gold text-xs py-1 flex-1">
              {postponeLoading ? '...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowPostpone(false)}
              className="btn-outline text-xs py-1 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Batch postpone form ────────────────────────────────────────────── */}
      {showBatch && (
        <form
          onSubmit={handleBatchPostpone}
          className="space-y-2 bg-navy-light p-3 rounded-lg border border-navy-border w-64"
        >
          <p className="form-label">Batch Postpone</p>

          {/* Team selector — only the two teams in this fixture */}
          <div className="space-y-1">
            <label className="form-label text-xs">Team</label>
            <select
              value={batchTeamId}
              onChange={(e) => setBatchTeamId(e.target.value)}
              className="input-field text-xs py-1.5"
              required
            >
              <option value={homeTeamId}>{homeTeamName}</option>
              <option value={awayTeamId}>{awayTeamName}</option>
            </select>
          </div>

          {/* Date range */}
          <div className="space-y-1">
            <label className="form-label text-xs">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-field text-xs py-1.5"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="form-label text-xs">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-field text-xs py-1.5"
              required
            />
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="form-label text-xs">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field text-xs py-1.5 resize-none"
              rows={2}
              placeholder="e.g. Team unavailable"
              required
            />
          </div>

          {batchError && <p className="text-red-400 text-xs">{batchError}</p>}
          {batchResult && (
            <p className="text-green-400 text-xs">
              {batchResult.postponed === 0
                ? batchResult.message ?? 'No scheduled fixtures found in that range.'
                : `${batchResult.postponed} fixture${batchResult.postponed === 1 ? '' : 's'} postponed.`}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={batchLoading} className="btn-gold text-xs py-1 flex-1">
              {batchLoading ? '...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBatch(false)
                setBatchError('')
                setBatchResult(null)
              }}
              className="btn-outline text-xs py-1 flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
