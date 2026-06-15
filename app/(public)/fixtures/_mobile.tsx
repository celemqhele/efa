'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { CircleDot, Crosshair, CalendarDays } from 'lucide-react'

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-slate-500/20 text-text-muted border-slate-500/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  confirmed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  completed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-red-500/20 text-red-500 border-red-500/30' },
}

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return parseISO(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return null
  }
}

function formatDateGroup(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const today = new Date()
    const todayKey = today.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = tomorrow.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const dateKey = d.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })

    if (dateKey === todayKey) return 'Today'
    if (dateKey === tomorrowKey) return 'Tomorrow'

    return d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return dateStr
  }
}

function FixtureCard({ f, teamIds }: { f: any; teamIds: string[] }) {
  const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
  const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
  const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament

  const isHome = teamIds.includes(home?.id)
  const opponent = isHome ? away : home
  const result = f._result
  const myScore = isHome ? result?.home_score : result?.away_score
  const oppScore = isHome ? result?.away_score : result?.home_score
  const won = result != null && myScore != null && oppScore != null && myScore > oppScore
  const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
  const drew = result != null && myScore != null && oppScore != null && myScore === oppScore

  const tournamentType = t?.type ?? 'unknown'
  const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }
  const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']
  const time = formatTime(f.scheduled_date)

  let resultBadge: React.ReactNode = null
  if (won) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">W</span>
  } else if (lost) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 border border-red-500/30">L</span>
  } else if (drew) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-500/20 text-text-muted border border-slate-500/30">D</span>
  }

  return (
    <Link
      href={`/fixtures/${f.id}`}
      className="flex items-center gap-3 px-3 py-3 min-h-[64px] bg-bg-surface border border-border rounded-xl active:bg-accent/5 transition-colors"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-0.5 w-16 shrink-0">
          {home?.logo_league_folder && (
            <TeamLogo
              leagueFolder={home.logo_league_folder}
              teamSlug={home.logo_team_slug}
              context="fixture_card"
              alt={home.name}
              className="w-7 h-7"
            />
          )}
          <span className="text-[10px] font-semibold text-text-primary text-center truncate max-w-full leading-tight">{home?.name ?? 'TBC'}</span>
        </div>

        <div className="flex flex-col items-center shrink-0 min-w-[50px]">
          {result ? (
            <span className="text-base font-black text-text-primary tabular-nums leading-none">{myScore}–{oppScore}</span>
          ) : time ? (
            <span className="text-xs font-mono text-text-muted font-semibold leading-none">{time}</span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted leading-none">vs</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-0.5 w-16 shrink-0">
          {away?.logo_league_folder && (
            <TeamLogo
              leagueFolder={away.logo_league_folder}
              teamSlug={away.logo_team_slug}
              context="fixture_card"
              alt={away.name}
              className="w-7 h-7"
            />
          )}
          <span className="text-[10px] font-semibold text-text-primary text-center truncate max-w-full leading-tight">{away?.name ?? 'TBC'}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${typeStyle.colour}`}>
          {typeStyle.label}
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
          {statusInfo.label}
        </span>
        {resultBadge}
      </div>
    </Link>
  )
}

interface MobileProps {
  data: {
    user: any
    teams: any[]
    teamIds: string[]
    fixturesWithResults: any[]
    upcoming: any[]
    grouped: Record<string, any[]>
    sortedKeys: string[]
    primaryTeam: any
  }
}

export default function Mobile({ data }: MobileProps) {
  const { user, teamIds, upcoming, grouped, sortedKeys, primaryTeam } = data

  if (!user) {
    return (
      <div className="px-3 pb-6 space-y-4">
        <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center space-y-3">
          <CircleDot className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">Log in to see your team&apos;s fixtures.</p>
          <Link href="/login" className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="px-3 pb-6 space-y-4">
        <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center space-y-3">
          <Crosshair className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">You don&apos;t have a team yet.</p>
          <Link href="/select-team" className="btn-gold inline-block text-sm">Pick a team</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 pb-6 space-y-4">
      <div className="flex items-center gap-3">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="fixture_card"
            alt={primaryTeam.name}
            className="w-9 h-9"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
          {primaryTeam && (
            <p className="text-xs text-accent truncate">{primaryTeam.name}</p>
          )}
        </div>
        <Link href="/results" className="text-sm font-semibold text-accent shrink-0">Results →</Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-6 text-center">
          <CalendarDays className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">No upcoming fixtures.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            return (
              <section key={dateKey}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1 h-3 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-text-muted">{formatDateGroup(dateKey)}</h2>
                  <span className="text-[10px] text-text-muted">({fixturesInGroup.length})</span>
                </div>
                <div className="space-y-2">
                  {fixturesInGroup.map((f: any) => (
                    <FixtureCard key={f.id} f={f} teamIds={teamIds} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
