'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Check, ImagePlus, Loader2, X, XCircle } from 'lucide-react'
import { maybeCompressImage } from '@/lib/compress-image-client'

type Panel = 'home' | 'result' | 'backdoor' | 'details' | 'postpone'

interface Done {
  title: string
  message: string
  shareLink?: string
  shareText?: string
}

interface Props {
  initialState: any
  initialAction: string | null
  appBase: string
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  awaiting_confirmation: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  confirmed_pending: 'Pending release',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

// Status of the viewer's own backdoor report / dispute (portal panel 2).
const BD_STATUS: Record<string, { label: string; tone: string }> = {
  pending: {
    label: 'Under review',
    tone: 'bg-feedback-warning/15 text-feedback-warning border-feedback-warning/30',
  },
  approved: {
    label: 'Approved',
    tone: 'bg-feedback-success/15 text-feedback-success border-feedback-success/30',
  },
  declined: {
    label: 'Declined',
    tone: 'bg-feedback-error/15 text-feedback-error border-feedback-error/30',
  },
  // Kept visible (not silently dropped) so a manager can always see what
  // happened to the report they filed.
  void_game_played: {
    label: 'Replaced by result',
    tone: 'bg-bg-elevated text-text-secondary border-border',
  },
  expired: {
    label: 'Expired',
    tone: 'bg-bg-elevated text-text-secondary border-border',
  },
}

function Pill({ status, postponedConfirmed }: { status: string; postponedConfirmed: boolean }) {
  const label = postponedConfirmed ? 'Postponed · confirmed' : STATUS_LABEL[status] ?? status
  const tone = postponedConfirmed
    ? 'bg-feedback-warning/15 text-feedback-warning border-feedback-warning/30'
    : status === 'confirmed' || status === 'completed'
      ? 'bg-feedback-success/15 text-feedback-success border-feedback-success/30'
      : 'bg-bg-elevated text-text-secondary border-border'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-bg-surface border border-border rounded-2xl p-4 sm:p-5 ${className}`}>{children}</div>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-muted">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-border bg-bg-base px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none'

// How many proof screenshots a result may carry (1 required + up to 3 extra for
// a game that had to be replayed). Mirrors MAX_SHOTS / MAX_RESULT_FILES on the
// server (lib/screenshot-verify.ts, app/api/submit-match/route.ts).
const MAX_RESULT_FILES = 4
const MAX_EXTRA_FILES = MAX_RESULT_FILES - 1

// The AI check overlay is held on screen for at least this long so the manager
// always sees the steps run, even when the POST answers immediately (a decline
// from a cached read, or an instant network failure).
const MIN_CHECK_MS = 3000

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Shared look for the file inputs so the main and the optional extras match.
const fileInputClass =
  'block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary'

// ── AI screenshot check overlay ───────────────────────────────────────────────
// Shown while the POST is in flight (the AI OCR + assessment runs inside the
// request). Full screen and non-dismissable on purpose: the manager cannot
// click away mid-check, which is also why the portal has no other spinner.
// Props drive a 3-step progress bar so the overlay visibly advances instead of
// sitting on a frozen spinner while Gemini works.
function AiCheckOverlay({ step }: { step: number }) {
  const steps = [
    'Uploading your screenshots',
    'Reading the score and the stat table',
    'Checking the score against what you entered',
  ]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-bg-surface border border-border p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/25 animate-ping" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-text-primary">Checking your screenshots</p>
            <p className="text-xs text-text-muted">This takes a few seconds. Please do not close this page.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`flex items-start gap-2 text-xs transition-colors ${
                i < step ? 'text-text-primary' : i === step ? 'text-text-secondary' : 'text-text-muted/60'
              }`}
            >
              {i < step ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-feedback-success" />
              ) : (
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    i === step ? 'bg-accent animate-pulse' : 'bg-border'
                  }`}
                />
              )}
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Decline card ──────────────────────────────────────────────────────────────
// Red X verdict from the AI check. Shows exactly what the AI read so a manager
// who uploaded the wrong game (or typed the wrong score) can see why, plus the
// per-screenshot breakdown.
function VerificationDecline({ verdict, onDismiss }: { verdict: any; onDismiss: () => void }) {
  const shots: any[] = Array.isArray(verdict?.screenshots) ? verdict.screenshots : []
  return (
    <div className="rounded-2xl border border-feedback-error/40 bg-feedback-error/10 p-4">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-feedback-error" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide text-feedback-error">Submission declined</p>
          <p className="mt-1 text-sm text-text-primary">
            {verdict?.error ||
              'This screenshot does not include a score, or it is too different from the score you entered.'}
          </p>

          {shots.length > 1 && (
            <ul className="mt-2 space-y-1">
              {shots.map((s) => (
                <li key={s.index} className="flex items-start gap-2 text-xs text-text-secondary">
                  {s.isScoreShot ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-feedback-error" />
                  ) : (
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-feedback-error" />
                  )}
                  <span>
                    Screenshot {s.index}: {s.isScoreShot ? `score seen ${s.score?.home}-${s.score?.away}` : 'no score found'}
                    {s.note ? ` (${s.note})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {verdict?.ocrText && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-text-muted">
                What the AI read
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-bg-base p-2.5 text-[11px] leading-relaxed text-text-secondary">
                {verdict.ocrText}
              </pre>
            </details>
          )}

          <div className="mt-3">
            <Button variant="secondary" onClick={onDismiss} className="!px-3 !py-1.5 !text-xs">
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// WhatsApp reminder preference. Same visual control as the "Mark as forfeit?"
// radio (see .opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md):
// a heading, a Yes/No row of filled-dot circles, and a hint line. Default Yes;
// picking No persists on the manager's profile, so the portal comes back with No
// selected and the admin dashboard greys out their reminder buttons (same
// open_to_reminders flag).
function ReminderPrefCard({
  open,
  busy,
  onPick,
}: {
  open: boolean
  busy: boolean
  onPick: (yes: boolean) => void
}) {
  const current = open ? 'yes' : 'no'
  return (
    <Card>
      <span className="text-sm font-black uppercase tracking-wide text-accent">
        I want to continue getting WhatsApp reminders
      </span>
      <div className="mt-2 flex items-center gap-6">
        {[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex items-center gap-2 select-none ${
              busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
          >
            <input
              type="radio"
              name="portal-whatsapp-reminders"
              value={opt.value}
              checked={current === opt.value}
              onChange={() => onPick(opt.value === 'yes')}
              disabled={busy}
              className="sr-only"
            />
            <span
              className={`relative h-4 w-4 rounded-full border-2 transition-colors ${
                current === opt.value ? 'border-accent' : 'border-border'
              }`}
            >
              {current === opt.value && (
                <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
              )}
            </span>
            <span className="text-sm text-text-primary">{opt.label}</span>
          </label>
        ))}
      </div>
      <span className="mt-1.5 block text-xs text-text-muted">
        {open
          ? 'Pick No if you do not want match reminders on WhatsApp. Your reminder button on the admin dashboard is greyed out once you pick No.'
          : 'Reminders are off. The admin dashboard reminder button for you is greyed out. Pick Yes to switch them back on.'}
      </span>
    </Card>
  )
}

export default function SubmitPortal({ initialState, initialAction, appBase }: Props) {
  const [state, setState] = useState<any>(initialState)
  const [panel, setPanel] = useState<Panel>(initialAction === 'backdoor' ? 'backdoor' : 'home')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkStep, setCheckStep] = useState(0)
  const [error, setError] = useState('')
  const [decline, setDecline] = useState<any>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmAccept, setConfirmAccept] = useState(false)

  const fx = state.fixture
  const homeName = fx.home.name
  const awayName = fx.away.name
  const opponentName =
    state.viewer.side === 'home' ? awayName : state.viewer.side === 'away' ? homeName : 'Opponent'

  async function refresh(): Promise<any | null> {
    try {
      const res = await fetch(`/api/submit-match?code=${encodeURIComponent(state.code)}`)
      const data = await res.json()
      if (res.ok && data.ok) {
        setState(data)
        return data
      }
    } catch {
      /* keep the last known state */
    }
    return null
  }

  async function send(form: FormData, opts: { aiCheck?: boolean } = {}) {
    setBusy(true)
    setError('')
    setDecline(null)
    // Full-screen, non-dismissable overlay while the AI reads the screenshots
    // (the check runs inside this POST, so the request only returns once the
    // score/stats verdict exists).
    if (opts.aiCheck) setChecking(true)
    // What the match looked like before this POST. Used after a lost response
    // to tell "the save landed but the reply never arrived" apart from a
    // submission that genuinely failed.
    const before = state.result
      ? {
          screenshotUrl: state.result.screenshotUrl ?? null,
          home: state.result.homeScore,
          away: state.result.awayScore,
        }
      : null
    // Guarantee the check overlay is visible for a beat even when the POST comes
    // back instantly (or fails instantly): the manager should always see the
    // steps run instead of a card flashing in and out.
    const minOverlay = opts.aiCheck ? wait(MIN_CHECK_MS) : Promise.resolve()
    // Set when the reply is a gateway timeout rather than our JSON: that path
    // needs its own wording (and must not leak "Unexpected end of JSON input").
    let gateError = ''
    try {
      const res = await fetch('/api/submit-match', { method: 'POST', body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || !data.ok) {
        // The AI check declined the screenshots: red X card, not the plain
        // error banner, and the result on file is left untouched.
        if (data?.declined) {
          await minOverlay
          setDecline(data)
          return
        }
        // 502/504 answer with the platform's HTML page, not our JSON, so there
        // is no server message to show.
        if (res.status === 502 || res.status === 504) {
          gateError =
            'The screenshot check took too long to answer and the connection closed. Give it a moment and check this match again — only upload again if no result is showing.'
        }
        throw new Error(gateError || data?.error || 'Something went wrong. Try again.')
      }
      setDone({ title: data.title, message: data.message, shareLink: data.shareLink, shareText: data.shareText })
      setCopied(false)
      setConfirmAccept(false)
      setPanel('home')
      await Promise.all([minOverlay, refresh()])
    } catch (e: any) {
      // A bare "Failed to fetch" is the browser's own TypeError: the request
      // never reached the server, almost always because the body was too large
      // (the platform rejects an oversized upload before Next.js sees it). Say
      // that in plain words instead of leaking the JavaScript message.
      const raw = e?.message ?? ''
      const netFail = e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(raw)
      await minOverlay
      // A gateway timeout / dropped connection can happen AFTER the server has
      // already written the result, so read the portal back before claiming
      // failure. If the match now holds a different result than it did when the
      // manager pressed submit, the submission landed: show the success panel
      // instead of an error that contradicts what is on the match page.
      const fresh = await refresh()
      const after = fresh?.result
      const landed =
        !!after &&
        (!before ||
          after.screenshotUrl !== before.screenshotUrl ||
          after.homeScore !== before.home ||
          after.awayScore !== before.away)
      if (after && landed) {
        setDone({
          title: 'Result saved',
          message: `${homeName} ${after.homeScore}-${after.awayScore} ${awayName}. The reply did not reach your browser, but the result is on file and the match page is up to date.`,
          shareLink: `${appBase}/submit-match/${state.code}`,
          shareText: `My result for ${homeName} vs ${awayName} is in. Confirm it here:`,
        })
        setCopied(false)
        setConfirmAccept(false)
        setPanel('home')
        return
      }
      setError(
        gateError ||
          (netFail
            ? 'Could not send your screenshots. Check your connection and try again. If it keeps failing, upload fewer screenshots at a time.'
            : raw || 'Something went wrong. Try again.'),
      )
    } finally {
      setChecking(false)
      setBusy(false)
    }
  }

  // Walk the overlay's three step lines over MIN_CHECK_MS so the wait reads as
  // progress rather than a frozen spinner, then hold on the last step until the
  // request actually returns. The overlay itself is dismissed by send()'s
  // finally, so it can never outlive the request.
  useEffect(() => {
    if (!checking) {
      setCheckStep(0)
      return
    }
    setCheckStep(0)
    const perStep = MIN_CHECK_MS / 3
    const timers = [
      setTimeout(() => setCheckStep(1), perStep),
      setTimeout(() => setCheckStep(2), perStep * 2),
    ]
    return () => timers.forEach(clearTimeout)
  }, [checking])

  function formFor(action: string, fields: Record<string, string | File | null> = {}) {
    const fd = new FormData()
    fd.set('action', action)
    fd.set('code', state.code)
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null && v !== undefined) fd.set(k, v as any)
    }
    return fd
  }

  async function copyShareLink() {
    if (!done?.shareLink) return
    try {
      await navigator.clipboard.writeText(done.shareLink)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  // ── Pending postponement aimed at me ────────────────────────────────────────
  const respondTo = state.respondTo
  const req = state.postponeRequest as null | {
    status: string
    newDate: string
    reason: string
    requestedByName: string | null
    respondedByName: string | null
    expiresAt: string | null
  }

  // ── Home: match header + four options ───────────────────────────────────────
  const myBd = state.myBackdoor as null | {
    status: string
    isDispute: boolean
  }
  const menu: { key: Panel; num: string; label: string; sub: string; block?: string | null }[] = [
    {
      key: 'result',
      num: '1',
      label: 'Submit the result',
      sub: 'Upload the result screenshot and type the score',
      block: state.rules.resultBlock,
    },
    {
      key: 'backdoor',
      num: '2',
      label: 'Report opponent not responding',
      sub: myBd
        ? `Your ${myBd.isDispute ? 'dispute' : 'report'}: ${BD_STATUS[myBd.status]?.label ?? myBd.status}`
        : state.rules.disputeBlock === null
          ? `${opponentName} reported you — view the proof and dispute it`
          : `Screenshot proof that ${opponentName} did not respond`,
      block: state.rules.backdoorMenuBlock,
    },
    { key: 'details', num: '3', label: 'Match details', sub: 'Teams, date, result and proof already on file' },
    {
      key: 'postpone',
      num: '4',
      label: 'Postpone the game',
      sub: 'Pick a new date up to 7 days away and give a reason (one at a time)',
      block: state.rules.postponeBlock,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-text-primary">
              {homeName} <span className="text-text-muted">vs</span> {awayName}
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              {[fx.tournament, fx.scheduledDate ? formatDate(fx.scheduledDate) : null, fx.roundType]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {fx.postponedFrom && (
              <p className="mt-1 text-xs text-feedback-warning">
                Moved from {formatDate(fx.postponedFrom)}
              </p>
            )}
          </div>
          <Pill status={fx.status} postponedConfirmed={fx.postponedConfirmed} />
        </div>

        {state.rules.graceEnded && (
          <div className="mt-2 rounded-lg border border-feedback-error/40 bg-feedback-error/10 px-3 py-2 text-xs text-feedback-error">
            <p className="font-bold uppercase tracking-wide">
              This match&apos;s grace period has ended
            </p>
            <p className="mt-1">
              Results, reports and postponements were only open on the match day and the day after. It can no longer be
              changed, reported or postponed.
            </p>
          </div>
        )}

        {state.rules.resultNote && (
          <p className="mt-2 inline-flex rounded-md bg-feedback-warning/15 px-2 py-1 text-[11px] font-bold leading-tight text-feedback-warning">
            {state.rules.resultNote}
          </p>
        )}

        {!respondTo && state.postponedConfirmed && (
          <div className="mt-2 rounded-lg border border-feedback-warning/40 bg-feedback-warning/10 px-3 py-2 text-xs text-feedback-warning">
            <p className="font-bold uppercase tracking-wide">
              Postponed · confirmed{req?.requestedByName ? ` — requested by ${req.requestedByName}` : ''}
            </p>
            {req?.newDate && (
              <p className="mt-1 text-text-secondary">
                Moved to <strong className="text-text-primary">{formatDate(req.newDate)}</strong>
                {req.respondedByName ? ` · accepted by ${req.respondedByName}` : ''}.
              </p>
            )}
          </div>
        )}

        {!respondTo && req && req.status === 'pending' && (
          <div
            className={`mt-2 rounded-lg border px-3 py-2 text-xs ${
              req.expiresAt && Date.now() > new Date(req.expiresAt).getTime()
                ? 'border-feedback-error/40 bg-feedback-error/10 text-feedback-error'
                : 'border-feedback-warning/40 bg-feedback-warning/10 text-text-secondary'
            }`}
          >
            Postponement requested by{' '}
            <strong className="text-feedback-warning">{req.requestedByName ?? 'a manager'}</strong> to{' '}
            <strong className="text-text-primary">{formatDate(req.newDate)}</strong>.{' '}
            {req.expiresAt && Date.now() > new Date(req.expiresAt).getTime()
              ? 'Your opponent did not answer within 24 hours, so this request is being declined and the match stays on its original date.'
              : "Waiting on the opponent's answer — they have 24 hours, after which the request is declined."}
            {req.reason ? ` Reason: ${req.reason}` : ''}
          </div>
        )}

        {!respondTo && req && req.status === 'declined' && (
          <div className="mt-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-xs text-text-secondary">
            Postponement to <strong className="text-text-primary">{formatDate(req.newDate)}</strong> was declined
            {req.respondedByName ? ` by ${req.respondedByName}` : ''}.
            {req.reason ? ` Reason given: ${req.reason}` : ''}
          </div>
        )}

        {state.result && (
          <div className="mt-4 rounded-xl bg-bg-base border border-border px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">
                {homeName} <span className="text-lg font-black text-text-primary tabular-nums">{state.result.homeScore}</span>
                {' - '}
                <span className="text-lg font-black text-text-primary tabular-nums">{state.result.awayScore}</span> {awayName}
                {state.postponedConfirmed && (
                  <span className="ml-2 rounded bg-feedback-warning/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-feedback-warning">
                    placeholder
                  </span>
                )}
              </span>
              {state.result.screenshotUrl && (
                <a
                  href={state.result.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-accent hover:underline"
                >
                  View screenshot
                </a>
              )}
            </div>
            <p className="mt-1 text-[11px] font-medium text-text-muted">{resultActorLabel(state.result)}</p>
          </div>
        )}
      </Card>

      {/* Postponement waiting on the opponent's answer */}
      {respondTo && (
        <Card className="border-feedback-warning/40 bg-feedback-warning/5">
          <p className="text-xs font-bold uppercase tracking-wide text-feedback-warning">
            Postponement requested by {respondTo.fromName}
          </p>
          <p className="mt-2 text-sm text-text-primary">
            New date: <strong>{formatDate(respondTo.newDate)}</strong>
          </p>
          <p className="mt-1 text-sm text-text-secondary">Reason: {respondTo.reason}</p>
          <p className="mt-1 text-xs font-semibold text-feedback-warning">
            You have 24 hours to answer — after that the request is declined and the match stays on its original date.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Accepting locks the result 3-0 in your favour and the requester loses 0-3. The match stays on the new
            date so it can still be played and submitted for real.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            If you decline, the match stays on its original date and a not-responding report is filed for you against
            your opponent.
          </p>
          {respondTo.expired ? (
            <p className="mt-3 rounded-lg border border-feedback-error/40 bg-feedback-error/10 px-3 py-2 text-xs font-semibold text-feedback-error">
              This request expired after 24 hours without an answer, so it is being declined. The match stays on its
              original date.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {!confirmAccept ? (
                <Button variant="primary" onClick={() => setConfirmAccept(true)} disabled={busy}>
                  Accept
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => send(formFor('postponeRespond', { accept: '1' }))}
                >
                  Yes, lock the 3-0
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy || confirmAccept}
                onClick={() => send(formFor('postponeRespond', { accept: '0' }))}
              >
                Decline
              </Button>
              {confirmAccept && (
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmAccept(false)}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {decline && <VerificationDecline verdict={decline} onDismiss={() => setDecline(null)} />}

      {error && (
        <div className="rounded-xl border border-feedback-error/40 bg-feedback-error/10 px-3 py-2.5 text-sm font-semibold text-feedback-error">
          {error}
        </div>
      )}

      {panel === 'home' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {menu.map((item) => {
              const disabled = !!item.block
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setPanel(item.key)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed border-border bg-bg-elevated/50 opacity-60'
                      : 'border-border bg-bg-surface hover:border-accent hover:bg-bg-elevated'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-black text-bg-surface">
                    {item.num}
                  </span>
                  <span className="mt-2 block text-sm font-bold text-text-primary">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{disabled ? item.block : item.sub}</span>
                </button>
              )
            })}
          </div>
          <ReminderPrefCard
            open={state.viewer.openToReminders !== false}
            busy={busy}
            onPick={(yes) => send(formFor('reminderPref', { openToReminders: yes ? 'yes' : 'no' }))}
          />
        </div>
      )}

      {panel === 'result' && (
        <ResultPanel
          busy={busy}
          onSubmit={send}
          homeName={homeName}
          awayName={awayName}
          side={state.viewer.side}
          block={state.rules.resultBlock}
          note={state.rules.resultNote}
          formFor={formFor}
          declined={!!decline}
        />
      )}

      {panel === 'backdoor' && (
        <BackdoorPanel
          busy={busy}
          onSubmit={send}
          opponentName={opponentName}
          viewer={state.viewer}
          fixture={fx}
          block={state.rules.backdoorBlock}
          disputeBlock={state.rules.disputeBlock}
          myBackdoor={state.myBackdoor}
          reportsAgainstMe={state.reportsAgainstMe ?? []}
          formFor={formFor}
        />
      )}

      {panel === 'postpone' && (
        <PostponePanel busy={busy} onSubmit={send} request={state.postponeRequest} formFor={formFor} />
      )}

      {panel === 'details' && <DetailsPanel state={state} />}

      {panel !== 'home' && (
        <div>
          <Button variant="ghost" onClick={() => setPanel('home')} disabled={busy}>
            &larr; Back to options
          </Button>
        </div>
      )}

      {/* Success modal */}
      {done && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-bg-surface border border-border p-5 shadow-2xl">
            <h2 className="text-lg font-black text-text-primary">{done.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{done.message}</p>

            {done.shareLink && (
              <div className="mt-4 rounded-xl border border-border bg-bg-base p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                  Send this link to your opponent
                </p>
                <p className="mt-1 break-all text-xs text-text-secondary">{done.shareLink}</p>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" onClick={copyShareLink} className="!px-3 !py-1.5 !text-xs">
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                        Copied
                      </>
                    ) : (
                      'Copy link'
                    )}
                  </Button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${done.shareText ?? ''} ${done.shareLink}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-xl bg-feedback-success/15 px-3 py-1.5 text-xs font-bold text-feedback-success"
                  >
                    Share on WhatsApp
                  </a>
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={() => {
                  setDone(null)
                  setPanel('home')
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-text-muted">{appBase.replace('https://', '')}</p>

      {checking && <AiCheckOverlay step={checkStep} />}
    </div>
  )
}

// ─── 1. Result ────────────────────────────────────────────────────────────────

function ResultPanel({
  busy,
  onSubmit,
  homeName,
  awayName,
  side,
  block,
  note,
  formFor,
  declined,
}: {
  busy: boolean
  onSubmit: (fd: FormData, opts?: { aiCheck?: boolean }) => void
  homeName: string
  awayName: string
  side: 'home' | 'away' | null
  block: string | null
  note: string | null
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
  declined: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  // Optional extras: the same fixture played more than once because the
  // connection dropped. Their stats are combined with the main screenshot's.
  // Gated behind an explicit Yes/No toggle (default No) so the extra upload
  // widget only appears when the manager says they replayed the game.
  const [playedMany, setPlayedMany] = useState('no')
  const [extras, setExtras] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [forfeit, setForfeit] = useState('no')
  const [givenWin, setGivenWin] = useState('no')
  const [noFileError, setNoFileError] = useState(false)

  // "Did this player give you the win?" locks the score to a 3-0 walkover for the
  // submitter: the score inputs show it read-only and the forfeit question is
  // disabled (a walkover is never also a forfeit, so no +3 bonus). A pending
  // carry-over balance is still applied on top BY THE SERVER (it can turn the
  // 3-0 into e.g. 5-3), so the shown score is the base score only.
  const walkover = givenWin === 'yes'
  const walkHome = side === 'away' ? '0' : '3'
  const walkAway = side === 'away' ? '3' : '0'
  const shownHome = walkover ? walkHome : home
  const shownAway = walkover ? walkAway : away

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">1. Submit the result</h2>
      {block && <p className="mt-2 text-sm text-feedback-warning">{block}</p>}
      {note && <p className="mt-2 text-sm text-feedback-warning">{note}</p>}
      {declined && (
        <p className="mt-2 rounded-xl border border-feedback-error/40 bg-feedback-error/10 px-3 py-2 text-xs font-semibold text-feedback-error">
          Your previous upload was declined. Upload the score screenshot again, or enter the score that is on the
          screenshot.
        </p>
      )}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (uploading) return
          if (!file) {
            setNoFileError(true)
            return
          }
          setNoFileError(false)
          // Repeat the SAME key for every extra: the server reads them with
          // form.getAll('extraScreenshot'). A suffixed key (extraScreenshot0)
          // or a set() would be invisible to getAll and silently drop the
          // replay screenshots.
          const fd = formFor('result', {
            homeScore: shownHome,
            awayScore: shownAway,
            screenshot: file,
            forfeit: walkover ? 'no' : forfeit,
            givenWin,
          })
          for (const extra of extras) fd.append('extraScreenshot', extra)
          onSubmit(fd, { aiCheck: true })
        }}
      >
        <Field label="Result screenshot" hint="Upload the final score screen — it is kept as proof on this match.">
          <input
            type="file"
            accept="image/*"
            disabled={!!block || busy || uploading}
            onChange={async (e) => {
              const picked = e.target.files?.[0] ?? null
              setNoFileError(false)
              if (!picked) {
                setFile(null)
                return
              }
              // Shrink big phone screenshots before the POST: up to 4 files go
              // in one request and the serverless body limit is small.
              setUploading(true)
              try {
                setFile(await maybeCompressImage(picked))
              } finally {
                setUploading(false)
              }
            }}
            className={fileInputClass}
          />
          {file && <span className="block truncate text-xs text-accent">{file.name}</span>}
          {uploading && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing your screenshot…
            </span>
          )}
        </Field>
        {noFileError && (
          <p className="text-sm text-feedback-warning">Upload the result screenshot above first — it is kept as proof.</p>
        )}

        {/* Replay screenshots are opt-in: the Yes/No toggle keeps the extra
            upload widget hidden unless the manager says the fixture had to be
            played more than once. Same radio control as the forfeit/walkover
            questions (see
            .opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md). */}
        <div className="space-y-1.5">
          <span className="text-sm font-black uppercase tracking-wide text-accent">
            Did you play many times due to network or disconnections?
          </span>
          <div className="flex items-center gap-6">
            {[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex items-center gap-2 select-none ${block || busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="result-played-many"
                  value={opt.value}
                  checked={playedMany === opt.value}
                  onChange={() => {
                    setPlayedMany(opt.value)
                    // Dropping back to No also drops any picked replays, so the
                    // POST never carries screenshots the manager just said do
                    // not exist.
                    if (opt.value === 'no') setExtras([])
                  }}
                  disabled={!!block || busy}
                  className="sr-only"
                />
                <span
                  className={`relative h-4 w-4 rounded-full border-2 transition-colors ${
                    playedMany === opt.value ? 'border-accent' : 'border-border'
                  }`}
                >
                  {playedMany === opt.value && (
                    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
                  )}
                </span>
                <span className="text-sm text-text-primary">{opt.label}</span>
              </label>
            ))}
          </div>
          <span className="block text-xs text-text-muted">
            Select <span className="font-semibold">Yes</span> if you had to replay this game — you can then add up to{' '}
            {MAX_EXTRA_FILES} more screenshots and their stats are combined into one full stat table.
          </span>
        </div>

        {playedMany === 'yes' && (
          <div className="rounded-xl border border-border bg-bg-base p-3">
            <div className="flex items-start gap-2">
              <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <div className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-text-muted">
                  Add your other game screenshots
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  Up to {MAX_EXTRA_FILES} more. The stats of all your screenshots are combined into one full stat table.
                </span>
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!!block || busy || uploading}
              onChange={async (e) => {
                const picked = Array.from(e.target.files ?? []).slice(0, MAX_EXTRA_FILES)
                e.target.value = ''
                if (!picked.length) return
                setUploading(true)
                try {
                  const squashed = await Promise.all(picked.map((f) => maybeCompressImage(f)))
                  setExtras((prev) => [...prev, ...squashed].slice(0, MAX_EXTRA_FILES))
                } finally {
                  setUploading(false)
                }
              }}
              className={`mt-2 ${fileInputClass}`}
            />

            {uploading && (
              <span className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing your screenshots…
              </span>
            )}

            {extras.length > 0 && (
              <ul className="mt-2 space-y-1">
                {extras.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-text-secondary">
                      {i + 1}. {f.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setExtras((prev) => prev.filter((_, idx) => idx !== i))}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-bold text-feedback-error hover:bg-feedback-error/10 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <span className="text-sm font-black uppercase tracking-wide text-accent">Did this player give you the win?</span>
          <div className="flex items-center gap-6">
            {[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex items-center gap-2 select-none ${block || busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="result-given-win"
                  value={opt.value}
                  checked={givenWin === opt.value}
                  onChange={() => setGivenWin(opt.value)}
                  disabled={!!block || busy}
                  className="sr-only"
                />
                <span
                  className={`relative h-4 w-4 rounded-full border-2 transition-colors ${
                    givenWin === opt.value ? 'border-accent' : 'border-border'
                  }`}
                >
                  {givenWin === opt.value && (
                    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
                  )}
                </span>
                <span className="text-sm text-text-primary">{opt.label}</span>
              </label>
            ))}
          </div>
          <span className="block text-xs text-text-muted">
            Select <span className="font-semibold">Yes</span> if the opponent handed you the win — the score is recorded as a
            3-0 win to you.
          </span>
        </div>

        <div className={`space-y-1.5 ${walkover ? 'opacity-50' : ''}`}>
          <span className="text-sm font-black uppercase tracking-wide text-accent">Mark as forfeit?</span>
          <div className="flex items-center gap-6">
            {[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex items-center gap-2 select-none ${block || busy || walkover ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="result-forfeit"
                  value={opt.value}
                  checked={forfeit === opt.value}
                  onChange={() => setForfeit(opt.value)}
                  disabled={!!block || busy || walkover}
                  className="sr-only"
                />
                <span
                  className={`relative h-4 w-4 rounded-full border-2 transition-colors ${
                    forfeit === opt.value ? 'border-accent' : 'border-border'
                  }`}
                >
                  {forfeit === opt.value && (
                    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
                  )}
                </span>
                <span className="text-sm text-text-primary">{opt.label}</span>
              </label>
            ))}
          </div>
          <span className="block text-xs text-text-muted">
            {walkover
              ? 'Not needed — a walkover is recorded as a flat 3-0.'
              : 'Select Yes if the opponent forfeited (+3 goals added to winner).'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={homeName}>
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={shownHome}
              onChange={(e) => setHome(e.target.value)}
              disabled={!!block || busy || walkover}
              className={`${inputClass} text-center text-lg font-black tabular-nums ${walkover ? 'opacity-60' : ''}`}
              placeholder="0"
            />
          </Field>
          <Field label={awayName}>
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={shownAway}
              onChange={(e) => setAway(e.target.value)}
              disabled={!!block || busy || walkover}
              className={`${inputClass} text-center text-lg font-black tabular-nums ${walkover ? 'opacity-60' : ''}`}
              placeholder="0"
            />
          </Field>
        </div>

        {walkover && (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-text-primary">
            Recorded as {walkHome}-{walkAway} walkover win to you. The score and forfeit controls stay locked.
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={busy}
          disabled={busy || uploading || !!block || (!walkover && (home === '' || away === ''))}
          className="w-full"
        >
          Submit result
        </Button>
      </form>
    </Card>
  )
}

// ─── 2. Backdoor ──────────────────────────────────────────────────────────────

function BackdoorPanel({
  busy,
  onSubmit,
  opponentName,
  viewer,
  fixture,
  block,
  disputeBlock,
  myBackdoor,
  reportsAgainstMe,
  formFor,
}: {
  busy: boolean
  onSubmit: (fd: FormData) => void
  opponentName: string
  viewer: any
  fixture: any
  block: string | null
  disputeBlock: string | null
  myBackdoor: any
  reportsAgainstMe: any[]
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
}) {
  const [file, setFile] = useState<File | null>(null)
  // Managers always report the opposite side; admins pick one.
  const [side, setSide] = useState<'home' | 'away'>(viewer.side === 'home' ? 'away' : viewer.side === 'away' ? 'home' : 'away')
  const [noFileError, setNoFileError] = useState(false)
  const [disputeMode, setDisputeMode] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [disputeFile, setDisputeFile] = useState<File | null>(null)
  const [explanation, setExplanation] = useState('')
  const [disputeFileError, setDisputeFileError] = useState(false)

  const reports = reportsAgainstMe ?? []

  // ── Dispute (appeal) form — only reachable once a backdoor has been applied ─
  if (disputeMode) {
    return (
      <Card>
        <h2 className="text-base font-black text-text-primary">Dispute the applied backdoor</h2>
        <p className="mt-1 text-xs text-text-muted">
          The admin applied a backdoor result against you. Send your own screenshot and explain why the report is
          wrong — e.g. that the screenshot is fake. The admin reviews both screenshots side by side. If your dispute
          is upheld you get the 3-0 win; if not, the result stays as it is.
        </p>

        <ReportedNote
          reports={reports}
          opponentName={opponentName}
          canDispute={false}
          disputeBlock={disputeBlock}
          onDispute={() => {}}
          busy={busy}
        />

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!disputeFile) {
              setDisputeFileError(true)
              return
            }
            setDisputeFileError(false)
            onSubmit(formFor('backdoorDispute', { screenshot: disputeFile, explanation }))
          }}
        >
          <Field label="Your screenshot" hint="Proof that the report against you is wrong.">
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                setDisputeFile(e.target.files?.[0] ?? null)
                setDisputeFileError(false)
              }}
              className={fileInputClass}
            />
            {disputeFile && <span className="block truncate text-xs text-accent">{disputeFile.name}</span>}
          </Field>
          {disputeFileError && (
            <p className="text-sm text-feedback-warning">Upload your screenshot above first.</p>
          )}

          <Field label="Explanation" hint="Why is the report against you wrong? Max 500 characters.">
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={4}
              maxLength={500}
              disabled={busy}
              placeholder="e.g. That screenshot is fake — the chat was doctored, I did respond."
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={busy}
              disabled={busy || !disputeFile || explanation.trim().length < 5}
            >
              Submit dispute
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDisputeMode(false)}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    )
  }

  // ── Status card: one of my own claims is already on file ────────────────────
  if (myBackdoor) {
    const st = BD_STATUS[myBackdoor.status] ?? {
      label: myBackdoor.status,
      tone: 'bg-bg-elevated text-text-secondary border-border',
    }
    const kind = myBackdoor.isDispute ? 'dispute' : 'report'
    const outcomeLine = myBackdoor.isDispute
      ? myBackdoor.status === 'pending'
        ? 'Your dispute is with the admin. They will review both screenshots and get back to you.'
        : myBackdoor.status === 'approved'
          ? 'Your dispute was upheld — the 3-0 has been awarded to you instead.'
          : myBackdoor.status === 'declined'
            ? 'Your dispute was declined — the backdoor result stands.'
            : 'This dispute is closed — a result was submitted for the match, so it no longer applies.'
      : myBackdoor.status === 'pending'
        ? 'Your report is with the admin. They will review the screenshots and get back to you.'
        : myBackdoor.status === 'approved'
          ? 'Your report was approved. A 3-0 has been applied.'
          : myBackdoor.status === 'declined'
            ? 'Your report was declined.'
            : myBackdoor.status === 'expired'
              ? 'Your report expired before the admin reviewed it. You can file a new one while the match is still open.'
              : 'Your report was closed because a result was submitted for this match.'

    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-black text-text-primary">2. Report opponent not responding</h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${st.tone}`}
          >
            {st.label}
          </span>
        </div>

        <p className="mt-2 text-sm text-text-secondary">{outcomeLine}</p>
        <p className="mt-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-text-primary">
          Submitted{myBackdoor.submitterName ? ` by ${myBackdoor.submitterName}` : ''} {formatDateTime(myBackdoor.createdAt)}
          {myBackdoor.reviewedByName &&
            ` · ${myBackdoor.status === 'declined' ? 'declined' : 'approved'} by ${myBackdoor.reviewedByName}`}
          .
        </p>

        {myBackdoor.isDispute && myBackdoor.disputeNote && (
          <p className="mt-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-text-primary">
            Your explanation: {myBackdoor.disputeNote}
          </p>
        )}

        {myBackdoor.screenshotUrl && (
          <a
            href={myBackdoor.screenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-bold text-accent hover:underline"
          >
            View your screenshot
          </a>
        )}

        {myBackdoor.status === 'pending' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!confirmCancel ? (
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmCancel(true)}>
                Cancel {kind}
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => onSubmit(formFor('backdoorCancel', { submissionId: myBackdoor.id }))}
                >
                  Yes, cancel the {kind}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmCancel(false)}>
                  Keep it
                </Button>
              </>
            )}
          </div>
        )}

        <ReportedNote
          reports={reports}
          opponentName={opponentName}
          canDispute={disputeBlock === null}
          disputeBlock={disputeBlock}
          onDispute={() => setDisputeMode(true)}
          busy={busy}
        />
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">2. Report opponent not responding</h2>
      {block && <p className="mt-2 text-sm text-feedback-warning">{block}</p>}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!file) {
            setNoFileError(true)
            return
          }
          setNoFileError(false)
          onSubmit(formFor('backdoor', { side, screenshot: file }))
        }}
      >
        {viewer.side ? (
          <div className="rounded-xl border border-border bg-bg-base px-3 py-2.5 text-sm text-text-secondary">
            Not responding: <strong className="text-text-primary">{opponentName}</strong>
          </div>
        ) : (
          <Field label="Which team is not responding?">
            <select value={side} onChange={(e) => setSide(e.target.value as 'home' | 'away')} className={inputClass}>
              <option value="home">{fixture.home.name}</option>
              <option value="away">{fixture.away.name}</option>
            </select>
          </Field>
        )}

        <Field label="Proof screenshot" hint="A screenshot showing they did not respond.">
          <input
            type="file"
            accept="image/*"
            disabled={!!block || busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setNoFileError(false)
            }}
            className={fileInputClass}
          />
          {file && <span className="block truncate text-xs text-accent">{file.name}</span>}
        </Field>
        {noFileError && (
          <p className="text-sm text-feedback-warning">Upload the proof screenshot above first.</p>
        )}

        <Button type="submit" variant="primary" isLoading={busy} disabled={busy || !!block} className="w-full">
          Submit report
        </Button>
      </form>

      <ReportedNote
        reports={reports}
        opponentName={opponentName}
        canDispute={disputeBlock === null}
        disputeBlock={disputeBlock}
        onDispute={() => setDisputeMode(true)}
        busy={busy}
      />
    </Card>
  )
}

// ─── The opponent has filed against you: warning + their proof + Dispute ──────
// Sits at the bottom of panel 2 so the reported manager sees exactly what the
// admin was shown, and can appeal once the backdoor has been applied.

function ReportedNote({
  reports,
  opponentName,
  canDispute,
  disputeBlock,
  onDispute,
  busy,
}: {
  reports: any[]
  opponentName: string
  canDispute: boolean
  disputeBlock: string | null
  onDispute: () => void
  busy: boolean
}) {
  if (!reports.length) return null
  return (
    <div className="mt-4 space-y-2">
      {reports.map((r) => {
        const applied = r.status === 'approved'
        const reporter = r.submitterName ?? opponentName
        const headline = r.isDispute
          ? r.status === 'approved'
            ? `${reporter}'s dispute was upheld — your report was overturned`
            : `${reporter} disputed your report · waiting for review`
          : r.status === 'approved'
            ? `${reporter} has reported you as not responding · applied`
            : `${reporter} has reported you as not responding · waiting for review`
        const warning = r.isDispute
          ? r.status === 'approved'
            ? 'The result has been changed against you.'
            : 'Your result is under appeal — the admin is comparing both screenshots.'
          : 'Contact your opponent immediately to avoid a loss.'
        return (
          <div key={r.id} className="rounded-xl border border-feedback-error/40 bg-feedback-error/10 px-3 py-2.5 text-xs">
            <p className="font-bold uppercase tracking-wide text-feedback-error">{headline}</p>
            <p className="mt-1.5 font-bold text-feedback-error">{warning}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {r.screenshotUrl && (
                <a
                  href={r.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-bg-base px-2.5 py-1.5 font-bold text-accent hover:underline"
                >
                  View screenshot
                </a>
              )}
              {applied && canDispute ? (
                <Button variant="secondary" disabled={busy} onClick={onDispute} className="!px-3 !py-1.5 !text-xs">
                  Dispute
                </Button>
              ) : disputeBlock ? (
                <span className="text-[11px] font-semibold text-feedback-error/90">{disputeBlock}</span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 3. Details ───────────────────────────────────────────────────────────────

function DetailsPanel({ state }: { state: any }) {
  const fx = state.fixture
  const rows: [string, string][] = [
    ['Tournament', fx.tournament],
    ['Round', fx.roundType ?? '—'],
    ['Match date', fx.scheduledDate ? formatDate(fx.scheduledDate) : '—'],
    ...(fx.postponedFrom ? ([['Postponed from', formatDate(fx.postponedFrom)]] as [string, string][]) : []),
    ['Status', fx.postponedConfirmed ? 'Postponed · confirmed' : STATUS_LABEL[fx.status] ?? fx.status],
  ]

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">3. Match details</h2>

      <dl className="mt-3 divide-y divide-border">
        <div className="flex justify-between gap-4 py-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">Fixture</dt>
          <dd className="text-right text-sm font-semibold text-text-primary">
            {fx.home.name} vs {fx.away.name}
          </dd>
        </div>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2">
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">{k}</dt>
            <dd className="text-right text-sm text-text-primary">{v}</dd>
          </div>
        ))}
        {state.result && (
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
              {state.postponedConfirmed ? 'Placeholder result' : 'Result'}
            </dt>
            <dd className="text-right">
              <span className="flex items-center justify-end gap-3 text-sm font-bold text-text-primary">
                {state.result.homeScore} - {state.result.awayScore}
                {state.result.screenshotUrl && (
                  <a
                    href={state.result.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    View screenshot
                  </a>
                )}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-text-muted">
                {resultActorLabel(state.result)}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {state.backdoor.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Opponent-not-responding reports</p>
          <ul className="mt-2 space-y-1.5">
            {state.backdoor.map((b: any) => (
              <li key={b.id} className="rounded-xl border border-border bg-bg-base px-3 py-2 text-xs">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">
                    {b.isDispute ? 'Dispute · ' : ''}
                    {b.side === 'home' ? fx.home.name : fx.away.name} not responding · {b.status}
                    {b.mine ? ' · yours' : ''}
                  </span>
                  {b.screenshotUrl && (
                    <a href={b.screenshotUrl} target="_blank" rel="noreferrer" className="shrink-0 font-bold text-accent hover:underline">
                      View screenshot
                    </a>
                  )}
                </span>
                <span className="mt-1 block text-text-muted">
                  {b.submitterName ? `Submitted by ${b.submitterName}` : 'Submitted by an unregistered number'}
                  {b.reviewedByName &&
                    ` · ${b.status === 'declined' ? 'declined' : 'approved'} by ${b.reviewedByName}`}
                </span>
                {b.isDispute && b.disputeNote && (
                  <span className="mt-1 block text-text-muted">Explanation: {b.disputeNote}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.postponeRequest && (
        <div className="mt-4 rounded-xl border border-border bg-bg-base px-3 py-2.5 text-xs text-text-secondary">
          Postponement {state.postponeRequest.status} — new date {formatDate(state.postponeRequest.newDate)}.
          {state.postponeRequest.requestedByName ? ` Requested by ${state.postponeRequest.requestedByName}.` : ''}
          {state.postponeRequest.respondedByName ? ` Responded by ${state.postponeRequest.respondedByName}.` : ''}
          {state.postponeRequest.reason ? ` Reason: ${state.postponeRequest.reason}` : ''}
        </div>
      )}
    </Card>
  )
}

// ─── 4. Postpone ──────────────────────────────────────────────────────────────

function PostponePanel({
  busy,
  onSubmit,
  request,
  formFor,
}: {
  busy: boolean
  onSubmit: (fd: FormData) => void
  request: any
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
}) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  // Bounds must be the SERVER's matchday keys (SAST = UTC+2 year-round; see
  // lib/app-time.getSastDateKey). Deriving them from the browser's local date can
  // offer a date the server then rejects ("The new date must be in the future." /
  // "Pick a date within the next 7 days.") when the device timezone has already
  // rolled over (or has not yet) around SAST midnight.
  const min = sastDateKey(1)
  const max = sastDateKey(7)

  // A 'pending' request stops the manager re-asking only while its 24h answer
  // window is still open. Once it lapses it no longer counts — the server treats
  // it the same way and retires it — so show the form again.
  const requestLive =
    !!request &&
    request.status === 'pending' &&
    (!request.expiresAt || Date.now() <= new Date(request.expiresAt).getTime())

  if (requestLive) {
    return (
      <Card>
        <h2 className="text-base font-black text-text-primary">4. Postpone the game</h2>
        <p className="mt-2 text-sm text-text-secondary">
          You already asked to move this game to <strong>{formatDate(request.newDate)}</strong>. Your opponent must
          open this same link to accept or decline.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          They have 24 hours to answer. If they do not, the request is automatically declined and the match stays on
          its original date.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">4. Postpone the game</h2>
      {request && request.status === 'pending' && (
        <p className="mb-2 rounded-lg border border-feedback-warning/40 bg-feedback-warning/10 px-3 py-2 text-xs font-semibold text-feedback-warning">
          Your earlier request to move this game lapsed after 24 hours without an answer, so it no longer counts. You
          can ask again below.
        </p>
      )}
      <p className="mt-1 text-xs text-text-muted">
        Your opponent must open this link to accept. They have 24 hours to answer, after which the request is
        declined. If they accept, the result is locked 3-0 in their favour and the match moves to your new date — you
        can still play it and submit the real score there.
      </p>
      <p className="mt-1 text-xs text-text-muted">
        You can only have one postponement open at a time, and after one is approved you must wait a day before asking
        for another.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(formFor('postpone', { newDate: date, reason }))
        }}
      >
        <Field label="New date" hint={`Between ${formatDate(min)} and ${formatDate(max)}.`}>
          <input
            type="date"
            value={date}
            min={min}
            max={max}
            required
            disabled={busy}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Reason">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            disabled={busy}
            placeholder="Why can the game not be played on the scheduled date?"
            className={inputClass}
          />
        </Field>
        <Button type="submit" variant="primary" isLoading={busy} disabled={busy || !date || reason.trim().length < 3} className="w-full">
          Send postponement request
        </Button>
      </form>
    </Card>
  )
}

// ─── date helpers ─────────────────────────────────────────────────────────────

// SAST date key (UTC+2 year-round, no DST), mirroring lib/app-time.getSastDateKey
// so the postpone picker's min/max are exactly what the server accepts.
function sastDateKey(offsetDays: number, from: Date = new Date()) {
  const shifted = new Date(from.getTime() + 2 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

function formatDate(dateKey: string) {
  const d = new Date(`${String(dateKey).slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return String(dateKey)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Who put the result on file: an admin finalised it, a manager submitted it, or
// the system auto-finalised it (0-0 void / auto-approved backdoor).
function resultActorLabel(r: any): string {
  if (!r) return ''
  if (r.finalisedBy) {
    const name = r.finalisedByName ?? 'admin'
    return r.finalisedByRole === 'admin' ? `Approved by ${name}` : `Submitted by ${name}`
  }
  if (r.isAbandoned) return 'Abandoned'
  const reason = r.overrideReason ? ` · ${r.overrideReason}` : ''
  return `Approved by the system${reason}`
}
