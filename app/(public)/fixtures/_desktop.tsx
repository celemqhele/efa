'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, Crosshair, CalendarDays, ChevronRight } from 'lucide-react'

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

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
    return timePart
  } catch {
    return dateStr
  }
}

interface DesktopProps {
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

export default function Desktop({ data }: DesktopProps) {
  const { user, teamIds, upcoming, grouped, sortedKeys, primaryTeam } = data

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
          <Trophy className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">Log in to see your team&apos;s fixtures.</p>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-bg-base rounded-xl px-5 py-2.5 hover:bg-accent/90 transition-colors shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)]">
            Log in
          </Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">You don&apos;t have a team yet.</p>
          <Link href="/select-team" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-bg-base rounded-xl px-5 py-2.5 hover:bg-accent/90 transition-colors shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)]">
            Pick a team
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {primaryTeam?.logo_league_folder && (
            <TeamLogo
              leagueFolder={primaryTeam.logo_league_folder}
              teamSlug={primaryTeam.logo_team_slug}
              context="fixture_card"
              alt={primaryTeam.name}
              className="w-10 h-10 shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
            {primaryTeam && <p className="text-sm text-accent font-medium">{primaryTeam.name}</p>}
          </div>
        </div>
        <Link href="/results" className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
          Results <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted font-medium text-sm">No upcoming fixtures.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            return (
              <section key={dateKey} className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-3.5 bg-bg-base flex items-center gap-3">
                  <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
                  <h2 className="text-sm font-bold tracking-wide text-text-muted">{formatDateGroup(dateKey)}</h2>
                  <span className="text-xs text-text-muted font-medium ml-auto">({fixturesInGroup.length})</span>
                </div>
                <div className="divide-y divide-border/50">
                  {fixturesInGroup.map((f: any) => {
                    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
                    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
                    const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
                    const isHome = teamIds.includes(home?.id)
                    const opponent = isHome ? away : home
                    const result = f._result
                    const myScore = isHome ? result?.home_score : result?.away_score
                    const oppScore = isHome ? result?.away_score : result?.home_score
                    const tournamentType = t?.type ?? 'unknown'
                    const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }
                    const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

                    return (
                      <Link
                        key={f.id}
                        href={`/fixtures/${f.id}`}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-accent/5 transition-colors"
                      >
                        {opponent?.logo_league_folder && (
                          <TeamLogo
                            leagueFolder={opponent.logo_league_folder}
                            teamSlug={opponent.logo_team_slug}
                            context="fixture_card"
                            alt={opponent.name}
                            className="w-10 h-10 shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md border ${typeStyle.colour}`}>
                              {typeStyle.label}
                            </span>
                            {f.matchday && <span className="text-[10px] text-text-muted font-semibold">MD{f.matchday}</span>}
                          </div>
                          <p className="text-sm font-semibold text-text-primary truncate">{opponent?.name ?? 'TBC'}</p>
                          <p className="text-xs text-text-muted mt-0.5">{formatWhen(f.scheduled_date)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {result ? (
                            <>
                              <span className="text-xl font-black text-text-primary tabular-nums leading-none">
                                {myScore}–{oppScore}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusInfo.pill}`}>
                                {statusInfo.label}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-base font-black uppercase tracking-widest text-text-muted leading-none">vs</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${statusInfo.pill}`}>
                                {statusInfo.label}
                              </span>
                            </>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
