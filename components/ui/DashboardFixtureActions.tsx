'use client'

import { useState } from 'react'
import Link from 'next/link'
import WhatsAppButton from './WhatsAppButton'
import { Button } from './Button'

interface Props {
  fixtureId: string
  status: string
  homeTeamName?: string
  awayTeamName?: string
  homeManagerName?: string | null
  homeManagerPhone?: string | null
  awayManagerName?: string | null
  awayManagerPhone?: string | null
}

export default function DashboardFixtureActions({
  fixtureId,
  status,
  homeTeamName = '',
  awayTeamName = '',
  homeManagerName,
  homeManagerPhone,
  awayManagerName,
  awayManagerPhone,
}: Props) {
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

  const homeMsg = isAwaiting
    ? `Hi ${homeManagerName ?? 'there'}! Please confirm the result for your match vs ${awayTeamName} on the EFA platform. 🏆`
    : `Hi ${homeManagerName ?? 'there'}! Just a reminder that your fixture vs ${awayTeamName} is scheduled for today. Please submit your result after playing. 🎮`

  const awayMsg = isAwaiting
    ? `Hi ${awayManagerName ?? 'there'}! Please confirm the result for your match vs ${homeTeamName} on the EFA platform. 🏆`
    : `Hi ${awayManagerName ?? 'there'}! Just a reminder that your fixture vs ${homeTeamName} is scheduled for today. Please submit your result after playing. 🎮`

  if (isFinished) return null
  if (done) return <span className="text-feedback-warning text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-space-1 shrink-0">
      <div className="flex items-center gap-space-2 flex-wrap justify-end">
        {/* WhatsApp buttons */}
        {homeManagerPhone && (
          <WhatsAppButton phone={homeManagerPhone} message={homeMsg} size="sm" label="H" />
        )}
        {awayManagerPhone && (
          <WhatsAppButton phone={awayManagerPhone} message={awayMsg} size="sm" label="A" />
        )}

        <Button
            variant={isAwaiting ? 'primary' : 'secondary'}
            className="text-xs px-space-3 py-space-1"
        >
          <Link href={`/admin/results/submit?fixture=${fixtureId}`}>
            {isAwaiting ? 'Finalise' : 'Submit'}
          </Link>
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowPostpone(!showPostpone)}
          className="text-xs px-space-3 py-space-1"
        >
          Postpone
        </Button>
      </div>
      {showPostpone && (
        <form onSubmit={handlePostpone} className="flex items-center gap-space-2 flex-wrap justify-end">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="bg-bg-surface border border-border rounded-md text-xs px-space-3 py-space-1 w-44"
            required
          />
          <Button type="submit" isLoading={loading} variant="primary" className="text-xs px-space-3 py-space-1">
            {loading ? '…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowPostpone(false)} className="text-xs px-space-3 py-space-1">
            ×
          </Button>
          {error && <p className="text-feedback-error text-xs w-full text-right">{error}</p>}
        </form>
      )}
    </div>
  )
}

