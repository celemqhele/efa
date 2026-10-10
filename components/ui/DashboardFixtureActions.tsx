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
  postponedConfirmed?: boolean
  homeTeamName?: string
  awayTeamName?: string
  homeManagerName?: string | null
  homeManagerPhone?: string | null
  awayManagerName?: string | null
  awayManagerPhone?: string | null
  // A pending postponement request on this match: which side asked for it and
  // the proposed date, so the reminder can tell each side what is happening.
  postponeRequest?: { requesterSide: 'home' | 'away'; newDateLabel: string | null } | null
  // Live backdoor reports on this match (reportedSide = the side claimed to have
  // not responded). The reminder adds a status line per side.
  backdoorReports?: Array<{ reportedSide: 'home' | 'away'; screenshotUrl: string | null }>
}

const POSTPONE_POPOVER_W = 300

// Fallback reminder target when the fixture has no match code yet: plain "Hi"
// opens the bot's welcome menu. With a code the two links below go straight to
// the web submission portal (https://efa-fxyk.vercel.app/submit-match/<code>),
// option 1 = submit the result, ?action=backdoor = report the opponent.
const AI_BOT_DIGITS = '27818209406'
const FALLBACK_REMINDER_LINK = `https://wa.me/${AI_BOT_DIGITS}?text=Hi`
const PORTAL_BASE = 'https://efa-fxyk.vercel.app/submit-match'

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
// reading past the first sentence of the old four-slot templates. A single link
// (the web submission portal for this exact fixture opening the result form) so
// there is exactly one CTA, in bold; `opponentPhone` is the other manager's
// number, labelled in bold so it reads as the number to message rather than a
// stray digit (managers kept asking for the opponent's number despite it being
// in the reminder).
//
// When the match has a pending postponement or a backdoor report, `postpone` /
// `backdoor` add a status line for THAT side (requester vs reviewer, submitter
// vs reported) so the reminder acknowledges the process instead of reading like
// nothing happened. The opponent number and the single submit CTA are always
// kept, so the recipient still has everything they need to act.
function buildReminder(params: {
  username: string | null | undefined
  homeTeam: string
  awayTeam: string
  opponentPhone: string | null | undefined
  submitLink: string
  postpone?: { role: 'requester' | 'reviewer'; newDateLabel: string | null } | null
  backdoor?: { role: 'submitter' | 'reported'; screenshotUrl: string | null } | null
}): string {
  const { username, homeTeam, awayTeam, opponentPhone, submitLink, postpone, backdoor } = params
  const name = username ?? 'there'
  const theirNumber = formatPhoneDisplay(opponentPhone) || 'not available'
  const lines = [
    `👋 Hi ${name}`,
    `⚽ ${homeTeam} vs ${awayTeam}`,
  ]
  if (postpone?.role === 'requester') {
    lines.push(
      `⏳ *Your postponement request is being processed.* Waiting for your opponent to accept${postpone.newDateLabel ? ` (asked for ${postpone.newDateLabel})` : ''}.`
    )
  } else if (postpone?.role === 'reviewer') {
    lines.push(
      `⚠️ *Your opponent asked to postpone this match${postpone.newDateLabel ? ` to ${postpone.newDateLabel}` : ''}.*`
    )
    lines.push(`👉 *Accept or decline the request before the deadline.*`)
  }
  if (backdoor?.role === 'submitter') {
    lines.push(`⏳ *Your backdoor report is being processed.* The admin will review it.`)
  } else if (backdoor?.role === 'reported') {
    lines.push(`❗ *Your opponent reported you as not responding for this match.*`)
    lines.push(
      backdoor.screenshotUrl
        ? `📸 *View their screenshot: ${backdoor.screenshotUrl}*`
        : `📸 Open the match to view their screenshot: ${submitLink}`
    )
  }
  lines.push(`📞 *MESSAGE YOUR OPPONENT: ${theirNumber}*`)
  lines.push(`✅ *Submit for this match: ${submitLink}*`)
  return lines.join('\n')
}

export default function DashboardFixtureActions({
  fixtureId,
  status,
  postponedConfirmed = false,
  homeTeamName = '',
  awayTeamName = '',
  homeManagerName,
  homeManagerPhone,
  awayManagerName,
  awayManagerPhone,
  postponeRequest = null,
  backdoorReports = [],
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

  // A postponed-confirmed fixture is 'confirmed' in the database but still due on
  // its moved date, so it keeps its reminder buttons — only the postpone action
  // closes (the game already has one agreed move).
  const isFinished =
    ['confirmed', 'confirmed_pending', 'completed', 'abandoned'].includes(status) && !postponedConfirmed
  const isAwaiting = status === 'awaiting_confirmation'

  // Load the fixture's match code so both reminder links resolve to this exact
  // game's portal page (the code is the last path segment of the URL).
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

  // Portal URL for this fixture. The bot's MC-code match centre is gone, so the
  // reminder now hands over a normal link: no preloaded WhatsApp text, nothing to
  // send untouched, it just opens the match page (and logs the login, so admin
  // can see who submitted).
  const reminderLink = matchCode ? `${PORTAL_BASE}/${matchCode}` : FALLBACK_REMINDER_LINK

  // Resolve the postponement / backdoor status for a given side so each message
  // only tells that manager what is relevant to them.
  function postponeForSide(side: 'home' | 'away') {
    if (!postponeRequest) return null
    return postponeRequest.requesterSide === side
      ? { role: 'requester' as const, newDateLabel: postponeRequest.newDateLabel }
      : { role: 'reviewer' as const, newDateLabel: postponeRequest.newDateLabel }
  }
  function backdoorForSide(side: 'home' | 'away') {
    const againstMe = backdoorReports.find((r) => r.reportedSide === side)
    if (againstMe) return { role: 'reported' as const, screenshotUrl: againstMe.screenshotUrl }
    const mine = backdoorReports.find((r) => r.reportedSide !== side)
    if (mine) return { role: 'submitter' as const, screenshotUrl: null }
    return null
  }

  const homeMsg = buildReminder({
    username: homeManagerName,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    opponentPhone: awayManagerPhone,
    submitLink: reminderLink,
    postpone: postponeForSide('home'),
    backdoor: backdoorForSide('home'),
  })
  const awayMsg = buildReminder({
    username: awayManagerName,
    homeTeam: homeTeamName,
    awayTeam: awayTeamName,
    opponentPhone: homeManagerPhone,
    submitLink: reminderLink,
    postpone: postponeForSide('away'),
    backdoor: backdoorForSide('away'),
  })

  if (isFinished) return null
  if (done) return <span className="text-feedback-warning text-xs font-semibold">Postponed</span>

  return (
    <div className="flex flex-col items-end gap-space-1 shrink-0" ref={actionsRef}>
      <div className="flex items-center gap-space-2 flex-wrap justify-end">
        {/* WhatsApp buttons — the reminder text carries both portal links */}
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
          disabled={postponedConfirmed}
          title={postponedConfirmed ? 'Already postponed to a confirmed date' : undefined}
          className={`text-xs px-space-3 py-space-1 ${postponedConfirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
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
