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
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center space-y-3">
          <CircleDot className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted">Log in to see your team&apos;s fixtures.</p>
          <Link href="/login" className="btn-gold inline-block">Log in</Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center space-y-3">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted">You don&apos;t have a team yet.</p>
          <Link href="/select-team" className="btn-gold inline-block">Pick a team</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {primaryTeam?.logo_league_folder && (
            <TeamLogo
              leagueFolder={primaryTeam.logo_league_folder}
              teamSlug={primaryTeam.logo_team_slug}
              context="fixture_card"
              alt={primaryTeam.name}
              className="w-10 h-10"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">My Fixtures</h1>
            {primaryTeam && <p className="text-sm text-accent">{primaryTeam.name}</p>}
          </div>
        </div>
        <Link href="/results" className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors">View Results →</Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">No upcoming fixtures.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            return (
              <section key={dateKey} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-bg-base border-b border-border">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">{formatDateGroup(dateKey)}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-base/50">
                        <th className="text-left text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5 w-20">Time</th>
                        <th className="text-left text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5 w-28">Comp</th>
                        <th className="text-left text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5">Home</th>
                        <th className="text-center text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5 w-16">Score</th>
                        <th className="text-left text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5">Away</th>
                        <th className="text-center text-text-muted font-semibold text-xs uppercase tracking-wider px-4 py-2.5 w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixturesInGroup.map((f: any) => {
                        const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
                        const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
                        const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
                        const isHome = teamIds.includes(home?.id)
                        const result = f._result
                        const myScore = isHome ? result?.home_score : result?.away_score
                        const oppScore = isHome ? result?.away_score : result?.home_score
                        const tournamentType = t?.type ?? 'unknown'
                        const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }
                        const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']
                        const time = formatTime(f.scheduled_date)

                        return (
                          <tr
                            key={f.id}
                            className="border-b border-border/50 hover:bg-accent/5 transition-colors cursor-pointer"
                            onClick={() => window.location.href = `/fixtures/${f.id}`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-text-muted text-xs font-semibold">{time ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${typeStyle.colour}`}>
                                {typeStyle.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {home?.logo_league_folder && (
                                  <TeamLogo
                                    leagueFolder={home.logo_league_folder}
                                    teamSlug={home.logo_team_slug}
                                    context="fixture_card"
                                    alt={home.name}
                                    className="w-6 h-6"
                                  />
                                )}
                                <span className="font-semibold text-text-primary">{home?.name ?? 'TBC'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {result ? (
                                <span className="text-base font-black text-text-primary tabular-nums">{myScore}–{oppScore}</span>
                              ) : (
                                <span className="text-xs font-black uppercase tracking-widest text-text-muted">vs</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {away?.logo_league_folder && (
                                  <TeamLogo
                                    leagueFolder={away.logo_league_folder}
                                    teamSlug={away.logo_team_slug}
                                    context="fixture_card"
                                    alt={away.name}
                                    className="w-6 h-6"
                                  />
                                )}
                                <span className="font-semibold text-text-primary">{away?.name ?? 'TBC'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
                                  {statusInfo.label}
                                </span>
                                {f.matchday && <span className="text-[10px] text-text-muted">MD{f.matchday}</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
