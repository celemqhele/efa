'use client'
import Image from 'next/image'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import TeamLogo from '@/components/ui/TeamLogo'
import { Trophy, ClipboardList, CalendarDays, Flame, Vote } from 'lucide-react'

export default function Mobile({ data }: { data: any }) {
  const { userTeam, tournament, standings, nextDate, upcomingFixtures, latestResults, unbeaten } = data

  return (
    <div className="overflow-x-hidden">
      <Card className="relative overflow-hidden bg-gradient-to-br from-bg-surface to-bg-base p-space-3 sm:p-space-4 mb-space-4 sm:mb-space-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-accent),transparent_70%)] opacity-5" />
        <div className="relative">
          <div className="flex items-center gap-space-2 sm:gap-space-3 mb-space-1 sm:mb-space-2">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={32}
              height={32}
              className="w-6 h-6 sm:w-8 sm:h-8 object-contain"
            />
            <div>
              <h1 className="text-sm sm:text-base font-bold text-text-primary">Efootball Federal Association</h1>
              <p className="text-[10px] sm:text-[11px] text-accent">Season 2025/26 — Live</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-2 mt-space-2 sm:mt-space-3">
            <Button as={Link} href="/standings" variant="primary" className="text-xs px-space-3 sm:px-space-4 min-h-[32px] sm:min-h-0">View Standings</Button>
            <Button as={Link} href="/fixtures" variant="secondary" className="text-xs px-space-3 sm:px-space-4 min-h-[32px] sm:min-h-0">Fixtures</Button>
          </div>
        </div>
      </Card>

      <div className="space-y-space-4 lg:grid lg:grid-cols-3 lg:gap-space-6">
        <div className="lg:col-span-2 space-y-space-4 lg:space-y-space-6">
          <Card className="p-space-3 sm:p-space-4">
            <div className="flex items-center justify-between mb-space-2 sm:mb-space-3">
              <div>
                <h2 className="section-header mb-0">Upcoming Fixtures</h2>
                {nextDate && (
                  <p className="text-[11px] sm:text-xs text-accent mt-0.5">
                    {format(parseISO(nextDate), 'EEEE, d MMMM yyyy')}
                    {userTeam && <span className="text-text-muted ml-1">· {userTeam.name}</span>}
                  </p>
                )}
              </div>
              <Link href="/fixtures" className="text-xs text-accent hover:text-accent-hover font-medium shrink-0">View all →</Link>
            </div>

            {!upcomingFixtures.length ? (
              <p className="text-sm text-text-muted py-space-4 text-center">No upcoming fixtures</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingFixtures.map((f: any) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center py-space-2 sm:py-space-3 gap-space-1 sm:gap-space-3 hover:bg-bg-base/50 transition-colors rounded-lg">
                    <div className="flex-1 flex items-center gap-space-1 sm:gap-space-2 min-w-0">
                      {f.home_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.home_team.logo_league_folder}
                          teamSlug={f.home_team.logo_team_slug}
                          context="standings_row"
                          alt={f.home_team.name}
                          className="w-5 h-5 sm:w-7 sm:h-7 shrink-0"
                        />
                      )}
                      <span className="text-xs sm:text-sm font-medium text-text-primary truncate">{f.home_team?.name}</span>
                    </div>

                    <div className="text-center shrink-0 min-w-[36px] sm:min-w-[60px]">
                      {f.results ? (
                        <span className="text-text-primary font-bold text-xs sm:text-sm">
                          {f.results.home_score}–{f.results.away_score}
                        </span>
                      ) : (
                        <span className="text-[11px] sm:text-xs text-accent font-medium">vs</span>
                      )}
                      <div className={`text-[9px] sm:text-[10px] mt-0.5 ${
                        f.status === 'confirmed' ? 'text-feedback-success' :
                        f.status === 'awaiting_confirmation' ? 'text-feedback-warning' :
                        'text-text-muted'
                      }`}>
                        {f.status === 'confirmed' ? 'FT' :
                         f.status === 'awaiting_confirmation' ? 'Pending' : ''}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-space-1 sm:gap-space-2 min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-text-primary truncate">{f.away_team?.name}</span>
                      {f.away_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.away_team.logo_league_folder}
                          teamSlug={f.away_team.logo_team_slug}
                          context="standings_row"
                          alt={f.away_team.name}
                          className="w-5 h-5 sm:w-7 sm:h-7 shrink-0"
                        />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-space-3 sm:p-space-4">
            <div className="flex items-center justify-between mb-space-2 sm:mb-space-3">
              <h2 className="section-header mb-0">Latest Results</h2>
              <Link href="/results" className="text-xs text-accent hover:text-accent-hover font-medium shrink-0">View all →</Link>
            </div>

            {!latestResults?.length ? (
              <p className="text-sm text-text-muted py-space-4 text-center">No results yet</p>
            ) : (
              <div className="space-y-space-1 sm:space-y-space-2">
                {latestResults.map((r: any) => {
                  const f = r.fixtures
                  if (!f) return null
                  return (
                    <Link key={r.id} href={`/results/${r.id}`} className="flex items-center justify-between py-space-1.5 sm:py-space-2 px-0 rounded-lg hover:bg-bg-base transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center gap-space-1 sm:gap-space-2 flex-1 min-w-0">
                        {f.home_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt={f.home_team.name} className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                        )}
                        <span className="text-xs sm:text-sm text-text-primary font-medium truncate">{f.home_team?.name}</span>
                      </div>
                      <div className="mx-space-1 sm:mx-space-3 text-center shrink-0">
                        <span className="text-text-primary font-bold text-xs sm:text-sm">{r.home_score}–{r.away_score}</span>
                      </div>
                      <div className="flex items-center gap-space-1 sm:gap-space-2 flex-1 justify-end min-w-0">
                        <span className="text-xs sm:text-sm text-text-primary font-medium truncate">{f.away_team?.name}</span>
                        {f.away_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt={f.away_team.name} className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-space-4 lg:space-y-space-6">
          {standings && standings.length > 0 && (
            <Card className="p-space-4">
              <div className="flex items-center justify-between mb-space-3">
                <h2 className="section-header mb-0">
                  <span className="text-accent">PL</span> Top 6
                </h2>
                <Link href="/standings" className="text-xs text-accent font-medium shrink-0">Full table →</Link>
              </div>
              <div className="space-y-space-1">
                {standings.map((s: any, idx: number) => {
                  const team = s.teams
                  const isTop4 = idx < 4
                  return (
                    <Link key={s.id} href={`/teams/${team?.id}`} className="flex items-center gap-space-2 py-space-1 hover:bg-bg-base rounded-lg px-space-1 transition-colors">
                      <span className={`w-5 text-center text-xs font-bold ${isTop4 ? 'text-accent' : 'text-text-muted'}`}>
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
                      {s.unbeaten_run >= 3 && <Flame className="w-3.5 h-3.5 text-orange-400 inline shrink-0" />}
                      <span className="text-xs font-bold text-text-primary w-5 text-right shrink-0">{s.points}</span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {unbeaten && unbeaten.length > 0 && (
            <Card className="p-space-4">
              <h2 className="section-header">Unbeaten Runs</h2>
              <div className="space-y-space-2">
                {unbeaten.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-space-2">
                    {u.teams?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={u.teams.logo_league_folder}
                        teamSlug={u.teams.logo_team_slug}
                        context="standings_row"
                        alt={u.teams.name}
                        className="w-6 h-6 shrink-0"
                      />
                    )}
                    <span className="flex-1 text-sm text-text-primary truncate">{u.teams?.name}</span>
                    <span className="text-xs bg-feedback-success/20 text-feedback-success px-space-2 py-0.5 rounded font-bold shrink-0">
                      {u.unbeaten_run} unbeaten
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-space-4">
            <h2 className="section-header">Quick Links</h2>
            <div className="grid grid-cols-2 gap-space-2">
              {[
                { href: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
                { href: '/rules', label: 'Rules', icon: ClipboardList },
                { href: '/calendar', label: 'Calendar', icon: CalendarDays },
                { href: '/polls', label: 'Polls', icon: Vote },
              ].map((link) => {
                const Icon = link.icon
                return (
                  <Link key={link.href} href={link.href} className="flex flex-col items-center gap-space-1.5 p-space-3 rounded-lg bg-bg-elevated border border-border hover:border-accent/40 transition-colors group">
                    <Icon className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-text-secondary font-medium">{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
