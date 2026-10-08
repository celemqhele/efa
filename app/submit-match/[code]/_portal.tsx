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
  const req = state.postponeRequest as null | {
    status: string
    newDate: string
    reason: string
    requestedByName: string | null
    respondedByName: string | null
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
          <div className="mt-2 rounded-lg border border-feedback-warning/40 bg-feedback-warning/10 px-3 py-2 text-xs text-text-secondary">
            Postponement requested by{' '}
            <strong className="text-feedback-warning">{req.requestedByName ?? 'a manager'}</strong> to{' '}
            <strong className="text-text-primary">{formatDate(req.newDate)}</strong>. Waiting on the opponent's answer.
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

      {panel === 'result' && (
        <ResultPanel
          busy={busy}
          onSubmit={send}
          homeName={homeName}
          awayName={awayName}
          block={state.rules.resultBlock}
          note={state.rules.resultNote}
          formFor={formFor}
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
  note,
  formFor,
}: {
  busy: boolean
  onSubmit: (fd: FormData) => void
  homeName: string
  awayName: string
  block: string | null
  note: string | null
  formFor: (action: string, fields?: Record<string, string | File | null>) => FormData
}) {
  const [file, setFile] = useState<File | null>(null)
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [noFileError, setNoFileError] = useState(false)

  return (
    <Card>
      <h2 className="text-base font-black text-text-primary">1. Submit the result</h2>
      {block && <p className="mt-2 text-sm text-feedback-warning">{block}</p>}
      {note && <p className="mt-2 text-sm text-feedback-warning">{note}</p>}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!file) {
            setNoFileError(true)
            return
          }
          setNoFileError(false)
          onSubmit(formFor('result', { homeScore: home, awayScore: away, screenshot: file }))
        }}
      >
        <Field label="Result screenshot" hint="Upload the final score screen — it is kept as proof on this match.">
          <input
            type="file"
            accept="image/*"
            disabled={!!block || busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setNoFileError(false)
            }}
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary"
          />
          {file && <span className="block truncate text-xs text-accent">{file.name}</span>}
        </Field>
        {noFileError && (
          <p className="text-sm text-feedback-warning">Upload the result screenshot above first — it is kept as proof.</p>
        )}

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

        <Button type="submit" variant="primary" isLoading={busy} disabled={busy || !!block || home === '' || away === ''} className="w-full">
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
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary"
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
          : 'Your dispute was declined — the backdoor result stands.'
      : myBackdoor.status === 'pending'
        ? 'Your report is with the admin. They will review the screenshots and get back to you.'
        : myBackdoor.status === 'approved'
          ? 'Your report was approved. A 3-0 has been applied.'
          : 'Your report was declined.'

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
        <p className="mt-1 text-xs text-text-muted">Submitted {formatDateTime(myBackdoor.createdAt)}.</p>

        {myBackdoor.isDispute && myBackdoor.disputeNote && (
          <p className="mt-2 rounded-xl border border-border bg-bg-base px-3 py-2 text-xs text-text-secondary">
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
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-bg-elevated file:px-4 file:py-2 file:text-xs file:font-bold file:text-text-primary"
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
        const headline = r.isDispute
          ? r.status === 'approved'
            ? `${opponentName}'s dispute was upheld — your report was overturned`
            : `${opponentName} disputed your report · waiting for review`
          : r.status === 'approved'
            ? `${opponentName} has reported you as not responding · applied`
            : `${opponentName} has reported you as not responding · waiting for review`
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

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
