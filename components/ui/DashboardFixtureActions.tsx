'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import WhatsAppButton from './WhatsAppButton'
import { Button } from './Button'
import ModalPortal from './ModalPortal'
import { formatPhoneDisplay } from '@/lib/phone'

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

// The AI WhatsApp bot number (E.164 digits, no spacing) that the reminder links
  // open. Preloaded text carries the per-fixture match code ("MC-XXXXXXXX") so
  // the bot can open the match centre for that specific game; the backdoor link adds
  // a BQH token ("BQH MC-XXXXXXXX") so the bot jumps straight into the backdoor
  // flow with the opponent already pinned. Without a code yet both fall back to
  // plain "Hi" (welcome menu).
const AI_BOT_DIGITS = '27818209406'
const FALLBACK_REMINDER_LINK = `https://wa.me/${AI_BOT_DIGITS}?text=Hi`

// Same-process cache so admin fixtures pages don't refetch codes per render.
const matchCodeCache = new Map<string, Promise<string | null>>()
function fetchMatchCode(fixtureId: string): Promise<string | null> {
  let p = matchCodeCache.get(fixtureId)
  if (!p) {
    p = fetch(`/api/admin/fixtures/${fixtureId}/match-code`)
      .then((r) => r.json())
      .then((d) => (typeof d?.code === 'string' ? d.code : null))
      .catch(() => null)
    matchCodeCache.set(fixtureId, p)
  }
  return p
}

// One item per line, emoji-led so each line scans on its own: managers were not
// reading past the first sentence of the old four-slot templates, and the plain
// label list still looked like a wall of text. Two links into the AI bot, both
// carrying the fixture's match code — the plain one opens the match centre
// (submit the result), the BQH one opens the backdoor flow with the opponent
// already pinned as the non-responding side (no "who is not responding?"
// question). `opponentPhone` is the other manager's number, shown so the
// reminder doubles as a "call your opponent" nudge.
function buildReminder(params: {
  username: string | null | undefined
  homeTeam: string
  awayTeam: string
  opponentPhone: string | null | undefined
  submitLink: string
  reportLink: string
}): string {
  const { username, homeTeam, awayTeam, opponentPhone, submitLink, reportLink } = params
  const name = username ?? 'there'
  const theirNumber = formatPhoneDisplay(opponentPhone) || 'not available'
  return [
    `👋 Hi ${name}`,
    `⚽ ${homeTeam} vs ${awayTeam}`,
    `📞 ${theirNumber}`,
    `✅ Submit: ${submitLink}`,
    `🚨 Report them: ${reportLink}`,
    `⚠️ *WHEN CLICKING LINK JUST HIT SEND, DON'T EDIT TEXT*`,
  ].join('\n')
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
  const [matchCode, setMatchCode] = useState<string | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isFinished = ['confirmed', 'confirmed_pending', 'completed', 'abandoned'].includes(status)
  const isAwaiting = status === 'awaiting_confirmation'

  // Load the fixture's match code so both embedded bot links resolve to this
  // exact game ("Hi MC-XXXXXXXX" for the result, "Hi BQH MC-XXXXXXXX" for the
  // backdoor report).
  useEffect(() => {
    let cancelled = false
    fetchMatchCode(fixtureId).then((code) => {
      if (!cancelled) setMatchCode(code)
    })
    return () => {
      cancelled = true
    }
  }, [fixtureId])

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

  // The prefill carries only the codes: the bot's deep-link handler matches them
  // anywhere in the message (and runs before the session is read), so "Hi " is
  // dead weight that widens the URL by 6 characters in every message.
  const reminderLink = matchCode
    ? `https://wa.me/${AI_BOT_DIGITS}?text=${encodeURIComponent(`MC-${matchCode}`)}`
    : FALLBACK_REMINDER_LINK
  const backdoorLink = matchCode
    ? `https://wa.me/${AI_BOT_DIGITS}?text=${encodeURIComponent(`BQH MC-${matchCode}`)}`
    : FALLBACK_REMINDER_LINK
  const homeMsg = buildReminder({
    username: homeManagerName,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    opponentPhone: awayManagerPhone,
    submitLink: reminderLink,
    reportLink: backdoorLink,
  })
  const awayMsg = buildReminder({
    username: awayManagerName,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    opponentPhone: homeManagerPhone,
    submitLink: reminderLink,
    reportLink: backdoorLink,
  })

  if (isFinished) return null
  if (done) return <span className="text-feedback-warning text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-space-1 shrink-0" ref={actionsRef}>
      <div className="flex items-center gap-space-2 flex-wrap justify-end">
        {/* WhatsApp buttons — reminder goes to the player; the links inside it open the AI bot */}
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
