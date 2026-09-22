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

// The AI WhatsApp bot number (E.164 digits, no spacing) that the reminder link
// opens. Preloaded text is "Hi" so the bot lands on the welcome menu.
const AI_BOT_DIGITS = '27818209406'
const REMINDER_LINK = `https://wa.me/${AI_BOT_DIGITS}?text=Hi`

type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

function getTimeSlot(): TimeSlot {
  const sastHour = new Date().getUTCHours() + 2
  const h = ((sastHour % 24) + 24) % 24
  if (h >= 0 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 21) return 'evening'
  return 'night'
}

function buildReminder(name: string | null | undefined, opponent: string, slot: TimeSlot): string {
  const n = name ?? 'there'
  switch (slot) {
    case 'morning':
      return `Hi ${n}! Just a reminder that your fixture vs ${opponent} is scheduled for today. If you already played, submit the score here: ${REMINDER_LINK}`
    case 'afternoon':
      return `Hi ${n}! Friendly reminder that your fixture vs ${opponent} is today. If you already played, submit the score here: ${REMINDER_LINK}. If your opponent is not responding, report a backdoor win: ${REMINDER_LINK}`
    case 'evening':
      return `Hi ${n}! Your fixture vs ${opponent} is still pending. If your opponent is not responding, report them to the AI here: ${REMINDER_LINK}`
    case 'night':
      return `Hi ${n}! Your result for the fixture vs ${opponent} is still not submitted. Please play or risk a backdoor loss. If your opponent is not responding, submit a backdoor here: ${REMINDER_LINK}`
  }
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
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isFinished = ['confirmed', 'confirmed_pending', 'completed', 'abandoned'].includes(status)
  const isAwaiting = status === 'awaiting_confirmation'
  const timeSlot = getTimeSlot()

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

  const homeMsg = buildReminder(homeManagerName, awayTeamName, timeSlot)
  const awayMsg = buildReminder(awayManagerName, homeTeamName, timeSlot)

  if (isFinished) return null
  if (done) return <span className="text-feedback-warning text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-space-1 shrink-0" ref={actionsRef}>
      <div className="flex items-center gap-space-2 flex-wrap justify-end">
        {/* Time slot indicator */}
        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
          {TIME_SLOT_LABELS[timeSlot]}
        </span>

        {/* WhatsApp buttons — reminder goes to the player; the link inside it opens the AI bot */}
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
