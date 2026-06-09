'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

const APP_TIME_ZONE = 'Africa/Johannesburg'

interface FixtureRow {
  id: string
  matchday: number | null
  scheduled_date: string | null
  status: string
  home_team_name: string | null
  home_team_folder: string | null
  home_team_slug: string | null
  away_team_name: string | null
  away_team_folder: string | null
  away_team_slug: string | null
}

interface Props {
  fixtures: FixtureRow[]
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  awaiting_confirmation: 'Awaiting',
}

const STATUS_COLOURS: Record<string, { fg: string; bg: string; border: string }> = {
  scheduled: { fg: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
  awaiting_confirmation: { fg: '#ca8a04', bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.3)' },
}

function jhbDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: APP_TIME_ZONE,
  })
}

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE,
  })
}

export default function DueFixturesExportButton({ fixtures }: Props) {
  const [loading, setLoading] = useState(false)
  const cardId = 'fixtures-due-export-card'

  async function handleDownload() {
    const card = document.getElementById(cardId)
    if (!card) return
    setLoading(true)
    try {
      const dataUrl = await toPng(card, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = `efa-fixtures-due-${new Date().toISOString().slice(0, 10)}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setLoading(false)
    }
  }

  const today = jhbDateLong(new Date())
  const accent = 'var(--color-accent)'

  return (
    <>
      <Button
        type="button"
        onClick={handleDownload}
        disabled={loading || fixtures.length === 0}
        variant="primary"
        className="px-space-3 py-space-1 text-xs"
        aria-label="Export fixtures due as PNG"
        isLoading={loading}
      >
        📸 Export
      </Button>

      {/* Off-screen printable card (still in DOM so html-to-image can capture it) */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }} aria-hidden>
        <div
          id={cardId}
          style={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            width: '600px',
            background: 'var(--color-bg-surface)',
            padding: 'var(--space-8)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-primary)',
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: `3px solid ${accent}`,
              paddingBottom: 'var(--space-4)',
              marginBottom: 'var(--space-5)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 900, fontSize: '13px',
                color: 'var(--color-bg-surface)', letterSpacing: 'var(--tracking-tight)', flexShrink: 0,
              }}
            >
              EFA
            </div>
            <div>
              <div style={{ color: accent, fontWeight: 700, fontSize: 'var(--text-xs)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', marginBottom: '3px' }}>
                {today}
              </div>
              <div style={{ fontWeight: 900, fontSize: 'var(--text-xl)', lineHeight: 1, letterSpacing: 'var(--tracking-tight)' }}>
                FIXTURES DUE ({fixtures.length})
              </div>
            </div>
          </div>

          {/* Rows */}
          {fixtures.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)', fontSize: 'var(--text-sm)' }}>
              No fixtures due.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {fixtures.map((f, i) => {
                const time = timeLabel(f.scheduled_date)
                const status = STATUS_COLOURS[f.status] ?? STATUS_COLOURS.scheduled
                const statusText = STATUS_LABELS[f.status] ?? f.status.replace(/_/g, ' ')
                return (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      background: i % 2 === 0 ? 'var(--color-bg-base)' : 'transparent',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-2) var(--space-3)',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {/* Time / MD */}
                    <div style={{ width: '60px', textAlign: 'center', flexShrink: 0 }}>
                      {time ? (
                        <>
                          <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}>{time}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', letterSpacing: 'var(--tracking-wide)', marginTop: '1px' }}>
                            MD{f.matchday ?? '?'}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>MD{f.matchday ?? '?'}</div>
                      )}
                    </div>

                    {/* Home */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingRight: 'var(--space-1)' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.home_team_name ?? 'TBC'}
                      </span>
                      {f.home_team_folder && f.home_team_slug && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/logos/${f.home_team_folder}/128x128/${f.home_team_slug}.png`}
                          alt=""
                          width={28} height={28}
                          style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
                        />
                      )}
                    </div>

                    {/* vs */}
                    <div style={{ color: accent, fontWeight: 900, fontSize: 'var(--text-xs)', minWidth: '24px', textAlign: 'center', letterSpacing: 'var(--tracking-wide)' }}>
                      VS
                    </div>

                    {/* Away */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingLeft: 'var(--space-1)' }}>
                      {f.away_team_folder && f.away_team_slug && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/logos/${f.away_team_folder}/128x128/${f.away_team_slug}.png`}
                          alt=""
                          width={28} height={28}
                          style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.away_team_name ?? 'TBC'}
                      </span>
                    </div>

                    {/* Status */}
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 'var(--tracking-wide)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        color: status.fg,
                        background: status.bg,
                        border: `1px solid ${status.border}`,
                      }}
                    >
                      {statusText}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid var(--color-border-subtle)',
              marginTop: 'var(--space-5)',
              paddingTop: 'var(--space-3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wide)',
            }}
          >
            <span>EFA — EFOOTBALL FEDERAL ASSOCIATION</span>
            <span>efa-fxyk.vercel.app</span>
          </div>
        </div>
      </div>
    </>
  )
}
