'use client'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import TeamLogo from '@/components/ui/TeamLogo'
import CalendarGrid from './(public)/calendar/CalendarGrid'
import { Flame, ArrowRight } from 'lucide-react'

export default function Desktop({ data }: { data: any }) {
  const { userTeam, standings, nextDate, upcomingFixtures, latestResults, unbeaten, calendar } = data

  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Upcoming</h2>
                {nextDate && (
                  <p className="text-xs text-accent mt-0.5 font-medium">
                    {format(parseISO(nextDate), 'EEEE, d MMMM yyyy')}
                    {userTeam && <span className="text-text-muted font-normal ml-1.5">· {userTeam.name}</span>}
                  </p>
                )}
              </div>
              <Link href="/fixtures" className="flex items-center gap-1 text-xs text-accent font-medium hover:text-accent-hover transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {!upcomingFixtures.length ? (
              <p className="text-sm text-text-muted py-8 text-center">No upcoming fixtures</p>
            ) : (
              <div className="divide-y divide-border/60">
                {upcomingFixtures.map((f: any) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center py-3 gap-3 hover:bg-bg-base/50 -mx-6 px-6 transition-colors first:pt-0 last:pb-0">
                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                      {f.home_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.home_team.logo_league_folder}
                          teamSlug={f.home_team.logo_team_slug}
                          context="standings_row"
                          alt={f.home_team.name}
                          className="w-6 h-6 shrink-0"
                        />
                      )}
                      <span className="text-sm font-medium text-text-primary truncate">{f.home_team?.name}</span>
                    </div>

                    <div className="text-center min-w-[48px]">
                      {f.results?.[0] ? (
                        <span className="text-text-primary font-bold text-sm">
                          {f.results[0].home_score}–{f.results[0].away_score}
                        </span>
                      ) : (
                        <span className="text-xs text-accent font-semibold">vs</span>
                      )}
                      <div className={`text-[10px] mt-0.5 font-medium ${
                        f.status === 'confirmed' ? 'text-feedback-success' :
                        f.status === 'awaiting_confirmation' ? 'text-feedback-warning' :
                        'text-text-muted'
                      }`}>
                        {f.status === 'confirmed' ? 'FT' :
                         f.status === 'awaiting_confirmation' ? 'Pending' : ''}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">
                      <span className="text-sm font-medium text-text-primary truncate text-right">{f.away_team?.name}</span>
                      {f.away_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.away_team.logo_league_folder}
                          teamSlug={f.away_team.logo_team_slug}
                          context="standings_row"
                          alt={f.away_team.name}
                          className="w-6 h-6 shrink-0"
                        />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Latest Results</h2>
              <Link href="/results" className="flex items-center gap-1 text-xs text-accent font-medium hover:text-accent-hover transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {!latestResults?.length ? (
              <p className="text-sm text-text-muted py-8 text-center">No results yet</p>
            ) : (
              <div className="space-y-2">
                {latestResults.map((r: any) => {
                  const f = r.fixtures
                  if (!f) return null
                  return (
                    <Link key={r.id} href={`/results/${r.id}`} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl hover:bg-bg-base transition-colors border border-transparent hover:border-border/60">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {f.home_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt={f.home_team.name} className="w-5 h-5 shrink-0" />
                        )}
                        <span className="text-sm text-text-primary font-medium truncate">{f.home_team?.name}</span>
                      </div>
                      <div className="mx-3 text-center">
                        <span className="text-text-primary font-bold text-sm tabular-nums">{r.home_score}–{r.away_score}</span>
                      </div>
                      <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
                        <span className="text-sm text-text-primary font-medium truncate text-right">{f.away_team?.name}</span>
                        {f.away_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt={f.away_team.name} className="w-5 h-5 shrink-0" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
                {calendar?.month ? new Date(calendar.year, calendar.month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''}
              </h2>
              <Link href="/calendar" className="flex items-center gap-1 text-xs text-accent font-medium">
                Full calendar <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {calendar ? (
              <CalendarGrid year={calendar.year} month={calendar.month} fixtures={calendar.fixtures} breaks={calendar.breaks} />
            ) : (
              <p className="text-sm text-text-muted py-8 text-center">No calendar data</p>
            )}
          </Card>

          {standings && standings.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Table</h2>
                <Link href="/standings" className="flex items-center gap-1 text-xs text-accent font-medium">
                  Full table <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-0.5">
                {standings.map((s: any, idx: number) => {
                  const team = s.teams
                  const isTop4 = idx < 4
                  return (
                    <Link key={s.id} href={`/teams/${team?.id}`} className="flex items-center gap-2.5 py-1.5 hover:bg-bg-base rounded-lg px-2 -mx-2 transition-colors">
                      <span className={`w-5 text-center text-xs font-bold tabular-nums ${isTop4 ? 'text-accent' : 'text-text-muted'}`}>
                        {idx + 1}
                      </span>
                      {team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={team.logo_league_folder}
                          teamSlug={team.logo_team_slug}
                          context="standings_row"
                          alt={team.name}
                          className="w-5 h-5 shrink-0"
                        />
                      )}
                      <span className="flex-1 text-xs text-text-primary truncate font-medium">{team?.name}</span>
                      {s.unbeaten_run >= 3 && <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                      <span className="text-xs font-bold text-text-primary w-6 text-right tabular-nums">{s.points}</span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {unbeaten && unbeaten.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase mb-4">Unbeaten Runs</h2>
              <div className="space-y-2.5">
                {unbeaten.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {u.teams?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={u.teams.logo_league_folder}
                        teamSlug={u.teams.logo_team_slug}
                        context="standings_row"
                        alt={u.teams.name}
                        className="w-5 h-5 shrink-0"
                      />
                    )}
                    <span className="flex-1 text-sm text-text-primary truncate font-medium">{u.teams?.name}</span>
                    <span className="text-xs bg-feedback-success/15 text-feedback-success px-2.5 py-0.5 rounded-full font-semibold">
                      {u.unbeaten_run}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
