'use client'

import { getTeamLogo } from '@/lib/logo-resolver'
import { exportElementAsPng } from '@/lib/broadcast-export'

interface GroupTeamRow {
  team: { name: string; logo_league_folder: string; logo_team_slug: string }
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

interface Props {
  groups: Record<string, GroupTeamRow[]>
  tournament: string
}

function SingleGroupTable({ letter, rows }: { letter: string; rows: GroupTeamRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return b.goals_for - a.goals_for
  })

  return (
    <div
      style={{
        background: 'rgba(17, 28, 61, 0.7)',
        border: '1px solid #1e2d5a',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Group header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #c9a84c 0%, #e0c06a 100%)',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 900, color: '#0a1128', letterSpacing: '0.1em' }}>
          GROUP {letter}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 28px 28px 28px 36px', gap: '0', textAlign: 'center' }}>
          {['P', 'W', 'D', 'L', 'PTS'].map((h) => (
            <div key={h} style={{ fontSize: '8px', fontWeight: 700, color: '#0a1128', opacity: 0.7, textAlign: 'center' }}>
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {sorted.map((row, idx) => {
        const isQualified = idx < 2
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderBottom: idx < sorted.length - 1 ? '1px solid rgba(30,45,90,0.5)' : 'none',
              background: isQualified
                ? 'rgba(201,168,76,0.06)'
                : 'transparent',
              borderLeft: isQualified ? '2px solid #c9a84c' : '2px solid transparent',
            }}
          >
            {/* Pos */}
            <div style={{ width: '16px', fontSize: '10px', fontWeight: 700, color: isQualified ? '#c9a84c' : '#64748b', flexShrink: 0 }}>
              {idx + 1}
            </div>

            {/* Logo */}
            <div style={{ width: '22px', height: '22px', flexShrink: 0, marginRight: '6px' }}>
              <img
                src={getTeamLogo(row.team.logo_league_folder, row.team.logo_team_slug, 'group_table')}
                alt={row.team.name}
                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            {/* Name */}
            <div
              style={{
                flex: 1,
                fontSize: '10px',
                fontWeight: 600,
                color: '#e2e8f0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginRight: '6px',
              }}
            >
              {row.team.name}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 28px 28px 28px 36px', gap: '0', textAlign: 'center', flexShrink: 0 }}>
              {[row.played, row.wins, row.draws, row.losses].map((v, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                  {v}
                </div>
              ))}
              <div style={{ fontSize: '11px', fontWeight: 800, color: isQualified ? '#c9a84c' : '#f1f5f9', textAlign: 'center' }}>
                {row.points}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function GroupTableGraphic({ groups, tournament }: Props) {
  const groupLetters = Object.keys(groups).slice(0, 4)

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportElementAsPng('broadcast-group-table', 'efa-group-table')}
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
        id="broadcast-group-table"
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
        {/* UCL-style starfield background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(1px 1px at 8% 12%, rgba(255,255,255,0.5) 0%, transparent 100%),
              radial-gradient(1px 1px at 18% 35%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 28% 8%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 42% 78%, rgba(255,255,255,0.25) 0%, transparent 100%),
              radial-gradient(1px 1px at 58% 18%, rgba(255,255,255,0.45) 0%, transparent 100%),
              radial-gradient(1px 1px at 68% 62%, rgba(255,255,255,0.3) 0%, transparent 100%),
              radial-gradient(1px 1px at 78% 28%, rgba(255,255,255,0.35) 0%, transparent 100%),
              radial-gradient(1px 1px at 88% 88%, rgba(255,255,255,0.2) 0%, transparent 100%),
              radial-gradient(1px 1px at 95% 45%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 3% 55%, rgba(201,168,76,0.25) 0%, transparent 100%),
              radial-gradient(1px 1px at 52% 95%, rgba(201,168,76,0.2) 0%, transparent 100%),
              radial-gradient(600px 400px at 50% 50%, rgba(17,28,61,0.5) 0%, transparent 100%)
            `,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #c9a84c 0%, #e0c06a 50%, #c9a84c 100%)',
              padding: '1.2% 3%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#0a1128',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 800,
                  color: '#c9a84c',
                }}
              >
                EFA
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0a1128' }}>
                {tournament}
              </div>
            </div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0a1128', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              GROUP STAGE
            </div>
          </div>

          {/* 2x2 grid of group tables */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: '1.5%',
              padding: '1.5% 3%',
            }}
          >
            {groupLetters.map((letter) => (
              <SingleGroupTable key={letter} letter={letter} rows={groups[letter]} />
            ))}
            {/* Fill empty cells if < 4 groups */}
            {groupLetters.length < 4 &&
              Array.from({ length: 4 - groupLetters.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ background: 'rgba(17,28,61,0.3)', borderRadius: '8px', border: '1px solid #1e2d5a' }} />
              ))}
          </div>

          {/* Qualified legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 3% 1%',
            }}
          >
            <div style={{ width: '10px', height: '10px', background: '#c9a84c', borderRadius: '2px', flexShrink: 0 }} />
            <div style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '0.06em' }}>
              Qualified for knockout stage (top 2 per group)
            </div>
          </div>

          {/* Footer */}
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
