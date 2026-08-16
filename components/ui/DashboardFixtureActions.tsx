'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import WhatsAppButton from './WhatsAppButton'
import { Button } from './Button'
import ModalPortal from './ModalPortal'

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

const POSTPONE_POPOVER_W = 300

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
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isFinished = ['confirmed', 'completed', 'abandoned'].includes(status)
  const isAwaiting = status === 'awaiting_confirmation'

  useEffect(() => {
    if (!showPostpone) return
    const close = () => setShowPostpone(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (actionsRef.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [showPostpone])

  function togglePostpone() {
    if (!showPostpone && actionsRef.current) {
      const rect = actionsRef.current.getBoundingClientRect()
      const left = Math.min(
        Math.max(8, rect.right - POSTPONE_POPOVER_W),
        Math.max(8, window.innerWidth - POSTPONE_POPOVER_W - 8),
      )
      setPopoverPos({ top: rect.bottom + 8, left })
    }
    setShowPostpone(!showPostpone)
  }

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
    ? `Hi ${homeManagerName ?? 'there'}! Please confirm the result for your match vs ${awayTeamName} on the EFA platform.`
    : `Hi ${homeManagerName ?? 'there'}! Just a reminder that your fixture vs ${awayTeamName} is scheduled for today. Please submit your result after playing.`

  const awayMsg = isAwaiting
    ? `Hi ${awayManagerName ?? 'there'}! Please confirm the result for your match vs ${homeTeamName} on the EFA platform.`
    : `Hi ${awayManagerName ?? 'there'}! Just a reminder that your fixture vs ${homeTeamName} is scheduled for today. Please submit your result after playing.`

  if (isFinished) return null
  if (done) return <span className="text-feedback-warning text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-space-1 shrink-0" ref={actionsRef}>
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
          onClick={togglePostpone}
          className="text-xs px-space-3 py-space-1"
        >
          Postpone
        </Button>
      </div>

      {showPostpone && popoverPos && (
        <ModalPortal>
          <div
            ref={popoverRef}
            className="fixed bg-bg-elevated border border-border rounded-lg shadow-md p-2 z-[60] animate-fade-in"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              width: POSTPONE_POPOVER_W,
              maxWidth: 'calc(100vw - 1rem)',
            }}
          >
            <form onSubmit={handlePostpone} className="flex items-center gap-space-2 flex-wrap justify-end">
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="bg-bg-surface border border-border rounded-md text-xs px-space-3 py-space-1 w-40"
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
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
