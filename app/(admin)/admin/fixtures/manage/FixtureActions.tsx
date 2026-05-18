'use client'

import { useState } from 'react'

interface Props {
  fixtureId: string
  currentDate: string | null
  status: string
}

export default function FixtureActions({ fixtureId, currentDate, status }: Props) {
  const [showPostpone, setShowPostpone] = useState(false)
  const [newDate, setNewDate] = useState(currentDate ? currentDate.slice(0, 16) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handlePostpone(e: React.FormEvent) {
    e.preventDefault()
    if (!newDate) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/postpone-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId, newDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to postpone')
      setSuccess(true)
      setShowPostpone(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isFinished = ['completed', 'confirmed', 'abandoned'].includes(status)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {!isFinished && (
          <button
            onClick={() => setShowPostpone(!showPostpone)}
            className="btn-outline text-xs py-1 px-2.5"
          >
            Postpone
          </button>
        )}
        {status === 'awaiting_confirmation' && (
          <a href={`/admin/results/submit?fixture=${fixtureId}`} className="btn-gold text-xs py-1 px-2.5">
            Result
          </a>
        )}
      </div>

      {showPostpone && (
        <form onSubmit={handlePostpone} className="space-y-2 bg-navy-light p-3 rounded-lg border border-navy-border w-52">
          <label className="form-label">New Date &amp; Time</label>
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field text-xs py-1.5"
            required
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          {success && <p className="text-green-400 text-xs">Postponed!</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-gold text-xs py-1 flex-1">
              {loading ? '...' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowPostpone(false)} className="btn-outline text-xs py-1 flex-1">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
