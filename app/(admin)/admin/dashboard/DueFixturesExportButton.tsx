'use client'

import { toPng } from 'html-to-image'
import { useState } from 'react'

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
  const accent = '#c9a84c'

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || fixtures.length === 0}
        className="px-3 py-1 bg-[#c9a84c] text-[#0a1128] font-bold rounded-md hover:bg-[#e0c06a] transition-colors text-xs disabled:opacity-40"
        aria-label="Export fixtures due as PNG"
      >
        {loading ? '...' : '📸 Export'}
      </button>

      {/* Off-screen printable card (still in DOM so html-to-image can capture it) */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }} aria-hidden>
        <div
          id={cardId}
          style={{
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            width: '600px',
            background: '#ffffff',
            padding: '32px',
            borderRadius: '12px',
            color: '#0f172a',
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: `3px solid ${accent}`,
              paddingBottom: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 900, fontSize: '13px',
                color: '#0a1128', letterSpacing: '0.02em', flexShrink: 0,
              }}
            >
              EFA
            </div>
            <div>
              <div style={{ color: accent, fontWeight: 700, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>
                {today}
              </div>
              <div style={{ fontWeight: 900, fontSize: '20px', lineHeight: 1, letterSpacing: '-0.01em' }}>
                FIXTURES DUE ({fixtures.length})
              </div>
            </div>
          </div>

          {/* Rows */}
          {fixtures.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
              No fixtures due.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {fixtures.map((f, i) => {
                const time = timeLabel(f.scheduled_date)
                const status = STATUS_COLOURS[f.status] ?? STATUS_COLOURS.scheduled
                const statusText = STATUS_LABELS[f.status] ?? f.status.replace(/_/g, ' ')
                return (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      background: i % 2 === 0 ? '#f8fafc' : 'transparent',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      gap: '10px',
                    }}
                  >
                    {/* Time / MD */}
                    <div style={{ width: '60px', textAlign: 'center', flexShrink: 0 }}>
                      {time ? (
                        <>
                          <div style={{ fontWeight: 800, fontSize: '13px', fontFamily: 'monospace' }}>{time}</div>
                          <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.04em', marginTop: '1px' }}>
                            MD{f.matchday ?? '?'}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 700, fontSize: '10px', color: '#94a3b8' }}>MD{f.matchday ?? '?'}</div>
                      )}
                    </div>

                    {/* Home */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <div style={{ color: accent, fontWeight: 900, fontSize: '10px', minWidth: '24px', textAlign: 'center', letterSpacing: '0.05em' }}>
                      VS
                    </div>

                    {/* Away */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '6px' }}>
                      {f.away_team_folder && f.away_team_slug && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/logos/${f.away_team_folder}/128x128/${f.away_team_slug}.png`}
                          alt=""
                          width={28} height={28}
                          style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.away_team_name ?? 'TBC'}
                      </span>
                    </div>

                    {/* Status */}
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '2px 6px',
                        borderRadius: '4px',
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
              borderTop: '1px solid #e2e8f0',
              marginTop: '20px',
              paddingTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#475569',
              fontSize: '10px',
              letterSpacing: '0.06em',
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
