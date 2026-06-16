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
      className="flex items-center gap-3 px-4 py-3.5 min-h-[72px] bg-bg-surface border border-border rounded-xl active:bg-accent/5 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-1 w-16 shrink-0">
          {home?.logo_league_folder && (
            <TeamLogo
              leagueFolder={home.logo_league_folder}
              teamSlug={home.logo_team_slug}
              context="fixture_card"
              alt={home.name}
              className="w-8 h-8"
            />
          )}
          <span className="text-xs font-semibold text-text-primary text-center truncate max-w-full leading-tight">{home?.name ?? 'TBC'}</span>
        </div>

        <div className="flex flex-col items-center shrink-0 min-w-[52px]">
          {result ? (
            <span className="text-lg font-black text-text-primary tabular-nums leading-none">{myScore}–{oppScore}</span>
          ) : time ? (
            <span className="text-xs font-mono text-text-muted font-bold leading-none">{time}</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted leading-none">vs</span>
          )}
          {f.matchday && (
            <span className="text-[9px] text-text-muted mt-1">MD{f.matchday}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 w-16 shrink-0">
          {away?.logo_league_folder && (
            <TeamLogo
              leagueFolder={away.logo_league_folder}
              teamSlug={away.logo_team_slug}
              context="fixture_card"
              alt={away.name}
              className="w-8 h-8"
            />
          )}
          <span className="text-xs font-semibold text-text-primary text-center truncate max-w-full leading-tight">{away?.name ?? 'TBC'}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${typeStyle.colour}`}>
          {typeStyle.label}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
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
      <div className="px-4 pb-8 space-y-5">
        <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-10 text-center space-y-4">
          <CircleDot className="w-10 h-10 text-text-muted mx-auto" />
          <div>
            <p className="text-text-muted text-sm font-medium">Log in to see your team&apos;s fixtures.</p>
          </div>
          <Link href="/login" className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="px-4 pb-8 space-y-5">
        <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-10 text-center space-y-4">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <div>
            <p className="text-text-muted text-sm font-medium">You don&apos;t have a team yet.</p>
          </div>
          <Link href="/select-team" className="btn-gold inline-block text-sm">Pick a team</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="fixture_card"
            alt={primaryTeam.name}
            className="w-10 h-10"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text-primary">My Fixtures</h1>
          {primaryTeam && (
            <p className="text-xs text-accent font-medium truncate">{primaryTeam.name}</p>
          )}
        </div>
        <Link href="/results" className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors shrink-0">Results →</Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-muted font-medium">No upcoming fixtures.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            return (
              <section key={dateKey}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="w-1 h-4 rounded-full bg-accent" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">{formatDateGroup(dateKey)}</h2>
                  <span className="text-[10px] text-text-muted font-medium ml-auto">({fixturesInGroup.length})</span>
                </div>
                <div className="space-y-2.5">
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
