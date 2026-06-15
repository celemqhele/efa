'use client'

import React from 'react'
import ExportButton from './ExportButton'
import ExportControls from './ExportControls'
import { Card } from '@/components/ui/Card'
import { goalDifference } from '@/lib/standings-core'

const ACCENT: Record<string, string> = {
  league: 'var(--color-accent)',
  tournament_club: '#3b82f6',
  tournament_international: '#f97316',
  friendlies: '#a855f7',
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[obj.getDay()]} ${d} ${months[m - 1]} ${y}`
}

function TeamLogoInline({
  folder,
  slug,
  size = 38,
}: {
  folder?: string | null
  slug?: string | null
  size?: number
}) {
  if (!folder || !slug) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${folder}/128x128/${slug}.png`}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  )
}

function StandingsTable({
  rows,
  mode,
  accent,
  qualifiersPerGroup = 2,
}: {
  rows: any[]
  mode: 'league' | 'group'
  accent: string
  qualifiersPerGroup?: number
}) {
  const rowEven: React.CSSProperties = { background: 'var(--export-row-bg)', borderRadius: '8px' }
  const rowOdd: React.CSSProperties = { background: 'transparent' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px 8px',
          color: 'var(--export-muted)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
        }}
      >
        <div style={{ width: '24px', textAlign: 'center' }}>#</div>
        <div style={{ flex: 1, marginLeft: '10px' }}>TEAM</div>
        <div style={{ width: '28px', textAlign: 'center' }}>P</div>
        <div style={{ width: '28px', textAlign: 'center' }}>W</div>
        <div style={{ width: '28px', textAlign: 'center' }}>D</div>
        <div style={{ width: '28px', textAlign: 'center' }}>L</div>
        <div style={{ width: '36px', textAlign: 'center' }}>GD</div>
        <div style={{ width: '36px', textAlign: 'center', color: accent }}>PTS</div>
        {mode === 'group' && <div style={{ width: '20px' }} />}
      </div>
      {rows.map((s: any, i: number) => {
        const gd = goalDifference(s)
        const borderColor =
          mode === 'league'
            ? i < 12
              ? 'var(--color-accent)'
              : '#3b82f6'
            : i < qualifiersPerGroup
            ? 'var(--color-accent)'
            : 'transparent'
        return (
          <div
            key={s.id ?? i}
            style={{
              display: 'flex',
              alignItems: 'center',
              ...(i % 2 === 0 ? rowEven : rowOdd),
              padding: '10px 8px',
              borderLeft: `3px solid ${borderColor}`,
            }}
          >
            <div
              style={{
                width: '24px',
                textAlign: 'center',
                color: 'var(--export-muted)',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <TeamLogoInline
              folder={s.team?.logo_league_folder}
              slug={s.team?.logo_team_slug}
              size={28}
            />
            <div
              style={{
                flex: 1,
                color: 'var(--export-text)',
                fontWeight: 600,
                fontSize: '13px',
                marginLeft: '6px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.team?.name ?? '—'}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.played}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.wins}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.draws}
            </div>
            <div
              style={{
                width: '28px',
                textAlign: 'center',
                color: 'var(--export-soft-text)',
                fontSize: '12px',
              }}
            >
              {s.losses}
            </div>
            <div
              style={{
                width: '36px',
                textAlign: 'center',
                color: gd >= 0 ? 'var(--export-green)' : 'var(--export-red)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {gd > 0 ? `+${gd}` : gd}
            </div>
            <div
              style={{
                width: '36px',
                textAlign: 'center',
                color: accent,
                fontSize: '15px',
                fontWeight: 900,
              }}
            >
              {s.points}
            </div>
            {mode === 'group' && (
              <div style={{ width: '20px', textAlign: 'center' }}>
                {i < qualifiersPerGroup && (
                  <span style={{ fontSize: '10px', color: 'var(--color-accent)', fontWeight: 700 }}>Q</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  width: '600px',
  background: 'var(--export-card-bg)',
  padding: '32px',
  borderRadius: '12px',
}

export default function Desktop({ data }: { data: any }) {
  const { cards, tournaments, selectedDate, defaultTournamentIds, defaultTypes, formattedDate } = data

  return (
    <div className="space-y-space-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Export</h1>
        <p className="text-text-muted text-sm mt-space-1">Generate shareable PNG cards for WhatsApp</p>
      </div>

      <ExportControls
        tournaments={tournaments ?? []}
        defaultDate={selectedDate}
        defaultTournamentIds={defaultTournamentIds}
        defaultTypes={defaultTypes}
      />

      {/* Generated cards */}
      {cards.map((card: any, i: number) => {
        const accent = ACCENT[card.tournament.type] ?? 'var(--color-accent)'
        const rowEven: React.CSSProperties = { background: 'var(--export-row-bg)', borderRadius: '8px' }
        const rowOdd: React.CSSProperties = { background: 'transparent' }

        const allData = card.type === 'fixtures' ? card.fixtures : card.results
        const matchdays = Array.from(new Set(allData.map((f: any) => f.matchday).filter(Boolean))).sort((a: any, b: any) => a - b)
        const mdPrefix = matchdays.length === 1 ? `MATCHDAY ${matchdays[0]} ` : ''

        const typeLabel =
          card.type === 'fixtures'
            ? `${mdPrefix}FIXTURES`
            : card.type === 'results'
            ? `${mdPrefix}RESULTS`
            : card.tournament.type === 'league'
            ? 'LEAGUE TABLE'
            : 'GROUP STANDINGS'

        const cardId = `export-card-${i}`
        const filename = `efa-${card.type}-${card.tournament.type}-${selectedDate}.png`

        return <div key={card.key}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text-secondary">
                {card.tournament.name}
                <span className="font-normal text-text-muted"> — </span>
                <span className="capitalize">{card.type}</span>
                {card.type !== 'standings' && (
                  <span className="font-normal text-text-muted ml-1 text-xs">({formattedDate})</span>
                )}
              </p>
              <ExportButton filename={filename} cardId={cardId} />
            </div>

            <div className="overflow-x-auto pb-space-4">
              <Card id={cardId} style={cardStyle} className="p-space-8">
                {/* Card header */}
                <div
                  style={{
                    borderBottom: `3px solid ${accent}`,
                    paddingBottom: '16px',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                      <div
                        style={{
                          color: accent, fontWeight: 700, fontSize: '10px',
                          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px',
                        }}
                      >
                        {card.tournament.name}
                      </div>
                      <div
                        style={{
                          color: 'var(--export-text)', fontWeight: 900, fontSize: '20px',
                          lineHeight: 1, letterSpacing: '-0.01em',
                        }}
                      >
                        {typeLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* FIXTURES */}
                {card.type === 'fixtures' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {card.fixtures.length === 0 ? (
                      <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                        No fixtures found for {formattedDate}
                      </div>
                    ) : (
                      card.fixtures.map((f: any, fi: number) => (
                        <div
                          key={f.id}
                          style={{
                            display: 'flex', alignItems: 'center',
                            ...(fi % 2 === 0 ? rowEven : rowOdd),
                            padding: '10px 16px',
                          }}
                        >
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                            <span style={{ color: 'var(--export-text)', fontWeight: 600, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(f.home_team as any)?.name ?? '—'}
                            </span>
                            <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                          </div>
                          <div style={{ color: accent, fontWeight: 900, fontSize: '11px', minWidth: '32px', textAlign: 'center', letterSpacing: '0.05em' }}>
                            VS
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                            <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                            <span style={{ color: 'var(--export-text)', fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(f.away_team as any)?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                    <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                      {formattedDate}
                    </div>
                  </div>
                )}

                {/* RESULTS */}
                {card.type === 'results' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {card.results.length === 0 ? (
                      <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                        No results found for {formattedDate}
                      </div>
                    ) : (
                      card.results.map((f: any, fi: number) => {
                        const r = f.result
                        const homeWon = r && r.home_score > r.away_score
                        const awayWon = r && r.away_score > r.home_score
                        return (
                          <div
                            key={f.id}
                            style={{
                              display: 'flex', alignItems: 'center',
                              ...(fi % 2 === 0 ? rowEven : rowOdd),
                              padding: '10px 16px',
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingRight: '10px' }}>
                              <span style={{ color: homeWon ? 'var(--export-text)' : 'var(--export-muted)', fontWeight: homeWon ? 700 : 400, fontSize: '13px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(f.home_team as any)?.name ?? '—'}
                              </span>
                              <TeamLogoInline folder={(f.home_team as any)?.logo_league_folder} slug={(f.home_team as any)?.logo_team_slug} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '72px', justifyContent: 'center' }}>
                              <span style={{ color: homeWon ? accent : 'var(--export-text)', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.home_score ?? '?'}</span>
                              <span style={{ color: 'var(--export-score-divider)', fontWeight: 700, fontSize: '13px' }}>–</span>
                              <span style={{ color: awayWon ? accent : 'var(--export-text)', fontWeight: 900, fontSize: '20px', lineHeight: 1 }}>{r?.away_score ?? '?'}</span>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px' }}>
                              <TeamLogoInline folder={(f.away_team as any)?.logo_league_folder} slug={(f.away_team as any)?.logo_team_slug} />
                              <span style={{ color: awayWon ? 'var(--export-text)' : 'var(--export-muted)', fontWeight: awayWon ? 700 : 400, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(f.away_team as any)?.name ?? '—'}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                    {card.results.length > 0 && (
                      <div style={{ color: 'var(--export-muted)', fontSize: '11px', textAlign: 'center', marginTop: '10px', letterSpacing: '0.04em' }}>
                        {formattedDate}
                      </div>
                    )}
                  </div>
                )}

                {/* STANDINGS (league) */}
                {card.type === 'standings' && card.tournament.type === 'league' && (
                  <>
                    <StandingsTable rows={card.standings} mode="league" accent={accent} />
                    <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                        <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>UCL (1–12)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3b82f6' }} />
                        <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Europa (13–20)</span>
                      </div>
                    </div>
                  </>
                )}

                {/* STANDINGS (group) */}
                {card.type === 'standings' && card.tournament.type !== 'league' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {Object.keys(card.groupStandings).length === 0 ? (
                      <div style={{ color: 'var(--export-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                        No standings data available
                      </div>
                    ) : (
                      <>
                        {Object.entries(card.groupStandings)
                          .sort()
                          .map(([group, rows]) => (
                            <div key={group}>
                              <div
                                style={{
                                  color: accent, fontWeight: 700, fontSize: '11px',
                                  letterSpacing: '0.1em', marginBottom: '10px',
                                }}
                              >
                                GROUP {group}
                              </div>
                              <StandingsTable rows={rows as any[]} mode="group" accent={accent} qualifiersPerGroup={card.tournament?.settings?.qualifiers_per_group ?? 2} />
                            </div>
                          ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-accent)' }} />
                          <span style={{ color: 'var(--export-muted)', fontSize: '10px' }}>Top {card.tournament?.settings?.qualifiers_per_group ?? 2} from each group qualify</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    borderTop: '1px solid var(--export-divider)',
                    marginTop: '24px', paddingTop: '14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div style={{ color: 'var(--export-muted-strong)', fontSize: '10px', letterSpacing: '0.06em' }}>
                    EFA — EFOOTBALL FEDERAL ASSOCIATION
                  </div>
                  <div style={{ color: 'var(--export-muted-strong)', fontSize: '10px' }}>
                    efa-fxyk.vercel.app
                  </div>
                </div>
              </Card>
            </div>
          </div>
        })}
    </div>
  )
}
