'use client'

import { useState } from 'react'
import { notify } from '@/lib/notifications'

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

  // ── Reset state ────────────────────────────────────────────────────────────
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

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

  // ── Reset handler ──────────────────────────────────────────────────────────
  async function handleReset() {
    setResetLoading(true)
    try {
      const res = await fetch('/api/admin/reset-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture_id: fixtureId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset')
      
      // Refresh page to show updated status
      window.location.reload()
    } catch (err: any) {
      notify('Error', err.message, 'admin')
    } finally {
      setResetLoading(false)
      setShowResetConfirm(false)
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
        {isFinished && (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="btn-outline text-xs py-1 px-2.5 text-red-400 border-red-500/20 hover:bg-red-500/10"
          >
            Reset Result
          </button>
        )}
      </div>

      {/* ── Reset Confirmation Modal ────────────────────────────────────────── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reset Fixture?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will delete the current result and all submissions. 
              The fixture status will return to <span className="font-bold">Scheduled</span> and standings will be recalculated.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {resetLoading ? 'Resetting...' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

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

