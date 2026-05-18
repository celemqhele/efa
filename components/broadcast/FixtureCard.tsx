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
  tournament: string
  scheduledDate: string
  matchday: number
}

function formatMatchDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d
    .toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase()
}

export default function FixtureCard({
  homeTeam,
  awayTeam,
  tournament,
  scheduledDate,
  matchday,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportElementAsPng('broadcast-fixture-card', 'efa-fixture')}
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
        id="broadcast-fixture-card"
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
        {/* CSS starfield dots */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 25% 35%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 40% 10%, rgba(255,255,255,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 55% 80%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 70% 25%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 15% 70%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 60% 45%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 90% 5%, rgba(255,255,255,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 5% 90%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 75% 88%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 33% 55%, rgba(255,255,255,0.15) 0%, transparent 100%),
              radial-gradient(1px 1px at 92% 40%, rgba(255,255,255,0.25) 0%, transparent 100%),
              radial-gradient(1px 1px at 48% 92%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 20% 5%, rgba(201,168,76,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 80% 75%, rgba(201,168,76,0.2) 0%, transparent 100%)
            `,
          }}
        />

        {/* Central glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(ellipse at 50% 60%, rgba(17,28,61,0.0) 0%, rgba(10,17,40,0.6) 100%)',
          }}
        />

        {/* Gold top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, #c9a84c 30%, #e0c06a 50%, #c9a84c 70%, transparent 100%)',
          }}
        />

        {/* Gold bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent 0%, #c9a84c 30%, #e0c06a 50%, #c9a84c 70%, transparent 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4% 6%',
          }}
        >
          {/* Matchday header */}
          <div
            style={{
              fontSize: 'clamp(10px, 1.8vw, 22px)',
              fontWeight: 900,
              color: '#c9a84c',
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              marginBottom: '0.4em',
              textShadow: '0 2px 12px rgba(201,168,76,0.4)',
            }}
          >
            MATCHDAY {matchday}
          </div>

          {/* Tournament name */}
          <div
            style={{
              fontSize: 'clamp(8px, 1.1vw, 13px)',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '3%',
            }}
          >
            {tournament}
          </div>

          {/* Teams row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3%',
              width: '100%',
              marginBottom: '3%',
            }}
          >
            {/* Home team */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <img
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'broadcast_download')}
                alt={homeTeam.name}
                style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', maxWidth: '140px' }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
              <div
                style={{
                  fontSize: 'clamp(10px, 1.4vw, 16px)',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  textAlign: 'center',
                  maxWidth: '160px',
                  lineHeight: 1.2,
                }}
              >
                {homeTeam.name}
              </div>
            </div>

            {/* VS divider */}
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 'clamp(18px, 3vw, 40px)',
                  fontWeight: 900,
                  color: '#1e2d5a',
                  lineHeight: 1,
                  letterSpacing: '0.05em',
                }}
              >
                VS
              </div>
            </div>

            {/* Away team */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <img
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'broadcast_download')}
                alt={awayTeam.name}
                style={{ width: '100%', maxWidth: '140px', aspectRatio: '1', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
              />
              <div
                style={{
                  fontSize: 'clamp(10px, 1.4vw, 16px)',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  textAlign: 'center',
                  maxWidth: '160px',
                  lineHeight: 1.2,
                }}
              >
                {awayTeam.name}
              </div>
            </div>
          </div>

          {/* Date */}
          <div
            style={{
              fontSize: 'clamp(9px, 1.3vw, 15px)',
              fontWeight: 700,
              color: '#c9a84c',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '0.5em',
            }}
          >
            {formatMatchDate(scheduledDate)}
          </div>

          {/* Deadline */}
          <div
            style={{
              fontSize: 'clamp(8px, 1vw, 12px)',
              color: '#64748b',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            DEADLINE: 14:00 SAST
          </div>
        </div>

        {/* EFA watermark — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: '1.5%',
            right: '2%',
            fontSize: '9px',
            color: 'rgba(201,168,76,0.4)',
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          EFA
        </div>
      </div>
    </div>
  )
}
