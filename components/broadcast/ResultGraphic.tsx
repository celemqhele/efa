'use client'

import { getTeamLogo } from '@/lib/logo-resolver'
import { exportElementAsPng } from '@/lib/broadcast-export'

interface TeamRef {
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface Props {
  homeTeam: TeamRef
  awayTeam: TeamRef
  homeScore: number
  awayScore: number
  tournament: string
  date: string
  stats?: {
    home_possession?: number
    away_possession?: number
    home_shots?: number
    away_shots?: number
  }
}

export default function ResultGraphic({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  tournament,
  date,
  stats,
}: Props) {
  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).toUpperCase()

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportElementAsPng('broadcast-result-graphic', 'efa-result')}
          className="btn-gold flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PNG
        </button>
      </div>

      {/* Broadcast graphic — 16:9 */}
      <div
        id="broadcast-result-graphic"
        style={{
          width: '100%',
          aspectRatio: '16/9',
          background: '#0a1128',
          fontFamily: "'Poppins', 'Arial', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Background gradients */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(ellipse at 15% 50%, rgba(201,168,76,0.08) 0%, transparent 55%), radial-gradient(ellipse at 85% 50%, rgba(201,168,76,0.08) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(30,45,90,0.8) 0%, transparent 60%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Top: tournament pill */}
          <div style={{ textAlign: 'center', padding: '3% 0 1%' }}>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.4)',
                borderRadius: '20px',
                padding: '3px 16px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#c9a84c',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              {tournament}
            </span>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', letterSpacing: '0.08em' }}>
              {formattedDate}
            </div>
          </div>

          {/* FULL TIME label */}
          <div style={{ textAlign: 'center', padding: '0.5% 0' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
              }}
            >
              FULL TIME
            </span>
          </div>

          {/* Center: logos + score */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0',
              padding: '0 5%',
            }}
          >
            {/* Home team */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <img
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'broadcast_download')}
                alt={homeTeam.name}
                style={{ width: '22%', aspectRatio: '1', objectFit: 'contain', maxWidth: '180px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
              <div
                style={{
                  fontSize: 'clamp(11px, 1.6vw, 18px)',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  textAlign: 'center',
                  maxWidth: '200px',
                  lineHeight: 1.2,
                }}
              >
                {homeTeam.name}
              </div>
            </div>

            {/* Score */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
                padding: '0 2%',
              }}
            >
              <span
                style={{
                  fontSize: 'clamp(48px, 8vw, 96px)',
                  fontWeight: 900,
                  color: '#c9a84c',
                  lineHeight: 1,
                  textShadow: '0 4px 20px rgba(201,168,76,0.3)',
                }}
              >
                {homeScore}
              </span>
              <span
                style={{
                  fontSize: 'clamp(24px, 4vw, 48px)',
                  fontWeight: 300,
                  color: '#1e2d5a',
                  lineHeight: 1,
                }}
              >
                —
              </span>
              <span
                style={{
                  fontSize: 'clamp(48px, 8vw, 96px)',
                  fontWeight: 900,
                  color: '#c9a84c',
                  lineHeight: 1,
                  textShadow: '0 4px 20px rgba(201,168,76,0.3)',
                }}
              >
                {awayScore}
              </span>
            </div>

            {/* Away team */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <img
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'broadcast_download')}
                alt={awayTeam.name}
                style={{ width: '22%', aspectRatio: '1', objectFit: 'contain', maxWidth: '180px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
              <div
                style={{
                  fontSize: 'clamp(11px, 1.6vw, 18px)',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  textAlign: 'center',
                  maxWidth: '200px',
                  lineHeight: 1.2,
                }}
              >
                {awayTeam.name}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          {stats && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '40px',
                padding: '1.5% 0',
                borderTop: '1px solid #1e2d5a',
                margin: '0 5%',
              }}
            >
              {stats.home_possession !== undefined && stats.away_possession !== undefined && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                    Possession
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1' }}>
                    {stats.home_possession}% — {stats.away_possession}%
                  </div>
                </div>
              )}
              {stats.home_shots !== undefined && stats.away_shots !== undefined && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>
                    Shots
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1' }}>
                    {stats.home_shots} — {stats.away_shots}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer watermark */}
          <div
            style={{
              background: '#111c3d',
              borderTop: '1px solid #1e2d5a',
              padding: '1% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '9px', color: '#c9a84c', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              EFA — Efootball Federal Association
            </div>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '0.05em' }}>
              MATCH RESULT
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
