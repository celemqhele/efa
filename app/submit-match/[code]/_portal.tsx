'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

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

export default function SubmitPortal({ initialState, initialAction, appBase }: Props) {
  const [state, setState] = useState<any>(initialState)
  const [panel, setPanel] = useState<Panel>(initialAction === 'backdoor' ? 'backdoor' : 'home')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmAccept, setConfirmAccept] = useState(false)

  const fx = state.fixture
  const homeName = fx.home.name
  const awayName = fx.away.name
  const opponentName =
    state.viewer.side === 'home' ? awayName : state.viewer.side === 'away' ? homeName : 'Opponent'

  async function refresh() {
    try {
      const res = await fetch(`/api/submit-match?code=${encodeURIComponent(state.code)}`)
      const data = await res.json()
      if (res.ok && data.ok) setState(data)
    } catch {
      /* keep the last known state */
    }
  }

  async function send(form: FormData) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/submit-match', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Try again.')
      setDone({ title: data.title, message: data.message, shareLink: data.shareLink, shareText: data.shareText })
      setCopied(false)
      setConfirmAccept(false)
      setPanel('home')
      await refresh()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

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

  // ── Home: match header + four options ───────────────────────────────────────
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
      sub: `Screenshot proof that ${opponentName} did not respond`,
      block: state.rules.backdoorBlock,
    },
    { key: 'details', num: '3', label: 'Match details', sub: 'Teams, date, result and proof already on file' },
    {
      key: 'postpone',
      num: '4',
      label: 'Postpone the game',
      sub: 'Pick a new date up to 7 days away and give a reason',
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

        {state.result && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-bg-base border border-border px-3 py-2.5">
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
          <p className="mt-2 text-xs text-text-muted">
            Accepting locks the result 3-0 in your favour and the requester loses 0-3. The match stays on the new
            date so it can still be played and submitted for real.
          </p>
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
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-feedback-error/40 bg-feedback-error/10 px-3 py-2.5 text-sm font-semibold text-feedback-error">
          {error}
        </div>
      )}

      {panel === 'home' && (
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
      )}

      {panel === 'result' && <ResultPanel busy={busy} onSubmit={send} homeName={homeName} awayName={awayName} block={state.rules.resultBlock} formFor={formFor} />}

      {panel === 'backdoor' && (
        <BackdoorPanel
          busy={busy}
          onSubmit={send}
          opponentName={opponentName}
          viewer={state.viewer}
          fixture={fx}
          block={state.rules.backdoorBlock}
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
                    {copied ? 'Copied ✓' : 'Copy link'}
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
    </div>
  )
}

// ─── 1. Result ────────────────────────────────────────────────────────────────

function ResultPanel({
  busy,
  onSubmit,
  homeName,
  awayName,
  block,
  formFor,
}: {
  busy: boolean
  onSubmit: (fd: FormData) => void
  homeName: string
  awayName: string
  block: string | null
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
}) {
  const [file, setFile] = useState<File | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">1. Submit the result</h2>
      {block && <p className="mt-2 text-sm text-feedback-warning">{block}</p>}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(formFor('result', { homeScore: home, awayScore: away, screenshot: file }))
        }}
      >
        <Field label="Result screenshot" hint="Upload the final score screen — it is kept as proof on this match.">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={!!block || busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary"
          />
          {file && <span className="block truncate text-xs text-accent">{file.name}</span>}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={homeName}>
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              disabled={!!block || busy}
              className={`${inputClass} text-center text-lg font-black tabular-nums`}
              placeholder="0"
            />
          </Field>
          <Field label={awayName}>
            <input
              type="number"
              min={0}
              max={99}
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              disabled={!!block || busy}
              className={`${inputClass} text-center text-lg font-black tabular-nums`}
              placeholder="0"
            />
          </Field>
        </div>

        <Button type="submit" variant="primary" isLoading={busy} disabled={busy || !!block || !file || home === '' || away === ''} className="w-full">
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
  formFor,
}: {
  busy: boolean
  onSubmit: (fd: FormData) => void
  opponentName: string
  viewer: any
  fixture: any
  block: string | null
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
}) {
  const [file, setFile] = useState<File | null>(null)
  // Managers always report the opposite side; admins pick one.
  const [side, setSide] = useState<'home' | 'away'>(viewer.side === 'home' ? 'away' : viewer.side === 'away' ? 'home' : 'away')

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">2. Report opponent not responding</h2>
      {block && <p className="mt-2 text-sm text-feedback-warning">{block}</p>}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
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
            capture="environment"
            disabled={!!block || busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary"
          />
          {file && <span className="block truncate text-xs text-accent">{file.name}</span>}
        </Field>

        <Button type="submit" variant="primary" isLoading={busy} disabled={busy || !!block || !file} className="w-full">
          Submit report
        </Button>
      </form>
    </Card>
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
            <dd className="flex items-center gap-3 text-right text-sm font-bold text-text-primary">
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
            </dd>
          </div>
        )}
      </dl>

      {state.backdoor.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Opponent-not-responding reports</p>
          <ul className="mt-2 space-y-1.5">
            {state.backdoor.map((b: any) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-base px-3 py-2 text-xs">
                <span className="text-text-secondary">
                  {b.side === 'home' ? fx.home.name : fx.away.name} not responding · {b.status}
                  {b.mine ? ' · yours' : ''}
                </span>
                {b.screenshotUrl && (
                  <a href={b.screenshotUrl} target="_blank" rel="noreferrer" className="font-bold text-accent hover:underline">
                    View screenshot
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.postponeRequest && (
        <div className="mt-4 rounded-xl border border-border bg-bg-base px-3 py-2.5 text-xs text-text-secondary">
          Postponement {state.postponeRequest.status} — new date {formatDate(state.postponeRequest.newDate)}.
          Reason: {state.postponeRequest.reason}
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
  const today = new Date()
  const min = isoDate(addDays(today, 1))
  const max = isoDate(addDays(today, 7))

  if (request && request.status === 'pending') {
    return (
      <Card>
        <h2 className="text-base font-black text-text-primary">4. Postpone the game</h2>
        <p className="mt-2 text-sm text-text-secondary">
          You already asked to move this game to <strong>{formatDate(request.newDate)}</strong>. Your opponent must
          open this same link to accept or decline.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">4. Postpone the game</h2>
      <p className="mt-1 text-xs text-text-muted">
        Your opponent must open this link to accept. If they accept, the result is locked 3-0 in their favour and the
        match moves to your new date — you can still play it and submit the real score there.
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

function addDays(d: Date, days: number) {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDate(dateKey: string) {
  const d = new Date(`${String(dateKey).slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return String(dateKey)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
