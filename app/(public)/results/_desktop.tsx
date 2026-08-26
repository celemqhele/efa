'use client'

import TeamLogo, { TBCBadge } from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, Crosshair, CalendarDays, ChevronRight } from 'lucide-react'

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: APP_TIME_ZONE,
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
    return `${datePart} · ${timePart}`
  } catch {
    return dateStr
  }
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return parseISO(dateStr).toLocaleDateString('en-GB', {
      month: 'long', year: 'numeric',
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
    grouped: Record<string, any[]>
    sortedKeys: string[]
    primaryTeam: any
    wins: number
    draws: number
    losses: number
  }
}

export default function Desktop({ data }: DesktopProps) {
  const { user, teamIds, fixturesWithResults, grouped, sortedKeys, primaryTeam, wins, draws, losses } = data
  const pathname = usePathname()

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Results</h1>
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
          <Trophy className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">Log in to see your team&apos;s past results.</p>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-bg-base rounded-xl px-5 py-2.5 hover:bg-accent/90 transition-colors shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)]">
            Log in
          </Link>
        </div>
      </div>
    )
  }

  if (teamIds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">My Results</h1>
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">You don&apos;t have a team yet.</p>
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
            <h1 className="text-2xl font-bold text-text-primary">My Results</h1>
            {primaryTeam && <p className="text-sm text-accent font-medium">{primaryTeam.name}</p>}
          </div>
        </div>
        <Link href="/fixtures" className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
          Upcoming <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {(fixturesWithResults?.length ?? 0) > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-feedback-success/5 border border-feedback-success/15 rounded-2xl flex flex-col items-center py-5 gap-1">
            <span className="text-2xl font-black text-feedback-success leading-none tabular-nums">{wins}</span>
            <span className="text-xs uppercase tracking-widest text-feedback-success font-bold">Won</span>
          </div>
          <div className="bg-bg-elevated/50 border border-border-subtle rounded-2xl flex flex-col items-center py-5 gap-1">
            <span className="text-2xl font-black text-text-muted leading-none tabular-nums">{draws}</span>
            <span className="text-xs uppercase tracking-widest text-text-secondary font-bold">Drawn</span>
          </div>
          <div className="bg-feedback-error/5 border border-feedback-error/15 rounded-2xl flex flex-col items-center py-5 gap-1">
            <span className="text-2xl font-black text-feedback-error leading-none tabular-nums">{losses}</span>
            <span className="text-xs uppercase tracking-widest text-feedback-error font-bold">Lost</span>
          </div>
        </div>
      )}

      {fixturesWithResults.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-2xl p-12 text-center">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">No results yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((monthKey) => {
            const fixturesInGroup = grouped[monthKey]!
            return (
              <section key={monthKey} className="bg-bg-surface border border-border rounded-2xl overflow-hidden shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-3.5 bg-bg-base flex items-center gap-3">
                  <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
                  <h2 className="text-sm font-bold tracking-wide text-text-muted">
                    {formatMonth(fixturesInGroup[0]?.scheduled_date)}
                  </h2>
                  <span className="text-xs text-text-muted font-medium ml-auto">({fixturesInGroup.length})</span>
                </div>
                <div className="divide-y divide-border/50">
                  {fixturesInGroup.map((f: any) => {
                    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
                    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
                    const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
                    const result = f._result
                    const isHome = teamIds.includes(home?.id)
                    const opponent = isHome ? away : home
                    const myScore = isHome ? result?.home_score : result?.away_score
                    const oppScore = isHome ? result?.away_score : result?.home_score
                    const won = result != null && myScore != null && oppScore != null && myScore > oppScore
                    const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
                    const drew = result != null && myScore != null && oppScore != null && myScore === oppScore
                    const tournamentType = t?.type ?? 'unknown'
                    const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }

                    let resultBadge: { label: string; cls: string } | null = null
                    if (won) resultBadge = { label: 'W', cls: 'bg-feedback-success/15 text-feedback-success border-feedback-success/30' }
                    else if (lost) resultBadge = { label: 'L', cls: 'bg-feedback-error/15 text-feedback-error border-feedback-error/30' }
                    else if (drew) resultBadge = { label: 'D', cls: 'bg-text-muted/15 text-text-muted border-text-muted/30' }

                    const borderAccent = won ? 'border-l-feedback-success/40' : lost ? 'border-l-feedback-error/40' : 'border-l-text-muted/30'

                    return (
                      <Link
                        key={f.id}
                        href={`/fixtures/${f.id}`}
                        className={`flex items-center gap-4 px-6 py-4 border-l-4 ${borderAccent} hover:bg-accent/5 transition-colors`}
                      >
                        {opponent ? (
                          <TeamLogo
                            leagueFolder={opponent.logo_league_folder}
                            teamSlug={opponent.logo_team_slug}
                            context="fixture_card"
                            alt={opponent.name}
                            className="w-10 h-10 shrink-0"
                          />
                        ) : (
                          <TBCBadge className="w-10 h-10 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md border ${typeStyle.colour}`}>
                              {typeStyle.label}
                            </span>
                            <span className="text-[10px] text-text-muted font-semibold">MD{f.matchday}</span>
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
                              <div className="flex items-center gap-1">
                                {f._aggregate && (
                                  <span className="text-[9px] text-text-muted font-semibold px-1 py-0.5 rounded bg-bg-elevated">
                                    AGG {f._aggregate.home}–{f._aggregate.away}
                                  </span>
                                )}
                                {f._penScore && (
                                  <span className="text-[9px] text-text-muted/70 font-medium px-1 py-0.5 rounded bg-bg-elevated">
                                    pens {f._penScore.home}–{f._penScore.away}
                                  </span>
                                )}
                                {resultBadge && (
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${resultBadge.cls}`}>
                                    {resultBadge.label}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-text-muted italic">No score</span>
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
