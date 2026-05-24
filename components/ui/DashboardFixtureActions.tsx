'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  fixtureId: string
  status: string
}

export default function DashboardFixtureActions({ fixtureId, status }: Props) {
  const [showPostpone, setShowPostpone] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const isFinished = ['confirmed', 'completed', 'abandoned'].includes(status)
  const isAwaiting = status === 'awaiting_confirmation'

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
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDone(true)
      setShowPostpone(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (isFinished) return null
  if (done) return <span className="text-orange-400 text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex items-center gap-1.5">
        <Link
          href={`/admin/results/submit?fixture=${fixtureId}`}
          className={isAwaiting
            ? 'btn-gold text-xs py-1 px-2.5'
            : 'btn-outline text-xs py-1 px-2.5'}
        >
          {isAwaiting ? 'Finalise' : 'Submit'}
        </Link>
        <button
          onClick={() => setShowPostpone(!showPostpone)}
          className="btn-outline text-xs py-1 px-2.5"
        >
          Postpone
        </button>
      </div>
      {showPostpone && (
        <form onSubmit={handlePostpone} className="flex items-center gap-1.5 flex-wrap justify-end">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field text-xs py-1 px-2 w-44"
            required
          />
          <button type="submit" disabled={loading} className="btn-gold text-xs py-1 px-2">
            {loading ? '…' : 'Save'}
          </button>
          <button type="button" onClick={() => setShowPostpone(false)} className="btn-outline text-xs py-1 px-2">
            ×
          </button>
          {error && <p className="text-red-400 text-xs w-full text-right">{error}</p>}
        </form>
      )}
    </div>
  )
}
