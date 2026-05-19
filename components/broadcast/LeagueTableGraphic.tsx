'use client'

import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { exportElementAsPng } from '@/lib/broadcast-export'

interface StandingRow {
  position: number
  team: { name: string; logo_league_folder: string; logo_team_slug: string }
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
  form: string
}

interface Props {
  standings: StandingRow[]
  tournamentName: string
}

function FormPill({ result }: { result: string }) {
  const color =
    result === 'W'
      ? 'bg-green-500 text-slate-900'
      : result === 'D'
      ? 'bg-yellow-500 text-black'
      : result === 'L'
      ? 'bg-red-500 text-slate-900'
      : 'bg-slate-200 text-slate-400'

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${color}`}
    >
      {result}
    </span>
  )
}

export default function LeagueTableGraphic({ standings, tournamentName }: Props) {
  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportElementAsPng('broadcast-league-table', 'efa-league-table')}
          className="btn-gold flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PNG
        </button>
      </div>

      {/* Broadcast graphic container — 16:9 ratio */}
      <div
        id="broadcast-league-table"
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: '#0a1128',
          fontFamily: "'Poppins', 'Arial', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
        }}
      >
        {/* Subtle background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(201,168,76,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(30,45,90,0.6) 0%, transparent 50%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Gold header bar */}
          <div
            style={{
              background: 'linear-gradient(135deg, #c9a84c 0%, #e0c06a 50%, #c9a84c 100%)',
              padding: '1.5% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* EFA Logo placeholder */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: '#0a1128',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#c9a84c',
                  letterSpacing: '0.05em',
                }}
              >
                EFA
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#0a1128', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Efootball Federal Association
                </div>
                <div style={{ fontSize: '18px', color: '#0a1128', fontWeight: 800, lineHeight: 1.1 }}>
                  {tournamentName}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#0a1128',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                opacity: 0.75,
              }}
            >
              STANDINGS
            </div>
          </div>

          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 48px 1fr 50px 50px 50px 50px 50px 60px 120px',
              gap: '0',
              padding: '0.6% 3%',
              background: '#111c3d',
              borderBottom: '1px solid #1e2d5a',
            }}
          >
            {['#', '', 'TEAM', 'P', 'W', 'D', 'L', 'GD', 'PTS', 'FORM'].map((h) => (
              <div
                key={h}
                style={{
                  fontSize: '9px',
                  color: '#c9a84c',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  textAlign: h === 'TEAM' || h === '' || h === '#' ? 'left' : 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: h === 'TEAM' || h === '' || h === '#' ? 'flex-start' : 'center',
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Table rows */}
          <div style={{ flex: 1, overflowY: 'hidden' }}>
            {standings.slice(0, 16).map((row, idx) => {
              const isTop3 = row.position <= 3
              const isRelegation = row.position >= standings.length - 2
              const isEven = idx % 2 === 0

              return (
                <div
                  key={row.position}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 48px 1fr 50px 50px 50px 50px 50px 60px 120px',
                    gap: '0',
                    padding: '0.5% 3%',
                    background: isEven ? 'rgba(17, 28, 61, 0.6)' : 'rgba(10, 17, 40, 0.4)',
                    borderBottom: '1px solid rgba(30,45,90,0.4)',
                    alignItems: 'center',
                    borderLeft: isTop3
                      ? '3px solid #c9a84c'
                      : isRelegation
                      ? '3px solid #ef4444'
                      : '3px solid transparent',
                  }}
                >
                  {/* Position */}
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isTop3 ? '#c9a84c' : '#94a3b8' }}>
                    {row.position}
                  </div>

                  {/* Logo */}
                  <div style={{ width: '36px', height: '36px', position: 'relative', flexShrink: 0 }}>
                    <img
                      src={getTeamLogo(row.team.logo_league_folder, row.team.logo_team_slug, 'standings_row')}
                      alt={row.team.name}
                      style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.team.name}
                  </div>

                  {/* Stats */}
                  {[row.played, row.wins, row.draws, row.losses, row.goal_difference].map((val, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#cbd5e1', textAlign: 'center' }}>
                      {i === 4 && val > 0 ? `+${val}` : val}
                    </div>
                  ))}

                  {/* Points */}
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: isTop3 ? '#c9a84c' : '#f1f5f9',
                      textAlign: 'center',
                    }}
                  >
                    {row.points}
                  </div>

                  {/* Form */}
                  <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                    {(row.form || '').split('').slice(-5).map((f, i) => {
                      const bg = f === 'W' ? '#22c55e' : f === 'D' ? '#eab308' : f === 'L' ? '#ef4444' : '#1e2d5a'
                      const tc = f === 'D' ? '#000' : '#fff'
                      return (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                            borderRadius: '3px',
                            background: bg,
                            color: tc,
                            fontSize: '9px',
                            fontWeight: 700,
                          }}
                        >
                          {f}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer watermark */}
          <div
            style={{
              background: '#111c3d',
              borderTop: '1px solid #1e2d5a',
              padding: '0.8% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              EFA — Efootball Federal Association
            </div>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '0.05em' }}>
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
