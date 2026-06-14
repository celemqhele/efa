import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PageWrapper from '@/components/ui/PageWrapper'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Trophy, ClipboardList, CalendarDays, Flame, Vote } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  // Current user + all their team rows (same club can exist in multiple phases)
  const { data: { user } } = await supabase.auth.getUser()
  let userTeam: { id: string; name: string } | null = null
  let userTeamIds: string[] = []
  if (user) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .eq('manager_id', user.id)
    userTeam = (teamRows?.[0] as any) ?? null
    userTeamIds = (teamRows ?? []).map((t: any) => t.id)
  }

  // Get active tournament (Premier League)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, type')
    .eq('type', 'league')
    .eq('status', 'active')
    .single()

  // Top 6 standings
  const { data: standings } = tournament
    ? await supabase
        .from('standings')
        .select('*, teams(id, name, logo_league_folder, logo_team_slug, profiles!manager_id(username))')
        .eq('tournament_id', tournament.id)
        .order('points', { ascending: false })
        .order('goal_difference', { ascending: false })
        .order('goals_for', { ascending: false })
        .limit(6)
    : { data: null }

  // Upcoming fixtures — find next date batch for user's team (or all if no team)
  const teamOrFilter = userTeamIds.length > 0
    ? userTeamIds.flatMap(id => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`]).join(',')
    : null

  const today = new Date().toISOString().split('T')[0]
  let upcomingQuery = supabase
    .from('fixtures')
    .select('scheduled_date')
    .gte('scheduled_date', today)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .order('scheduled_date', { ascending: true })
    .limit(1)

  if (teamOrFilter) {
    upcomingQuery = upcomingQuery.or(teamOrFilter)
  }

  const { data: nextDateRow } = await upcomingQuery
  const nextDate: string | null = (nextDateRow?.[0] as any)?.scheduled_date?.slice(0, 10) ?? null

  // Fetch all fixtures on that next date
  let upcomingFixtures: any[] = []
  if (nextDate) {
    let batchQuery = supabase
      .from('fixtures')
      .select(`
        id, matchday, scheduled_date, status, deadline,
        home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
        away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
        results(home_score, away_score)
      `)
      .eq('scheduled_date', nextDate)
      .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
      .order('deadline')

    if (teamOrFilter) {
      batchQuery = batchQuery.or(teamOrFilter)
    }

    const { data } = await batchQuery
    upcomingFixtures = (data ?? []) as any[]
  }

  // Latest results
  let latestResults: any[] = []
  if (userTeamIds.length > 0) {
    const teamOrFilterResults = userTeamIds
      .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
      .join(',')
    const { data: myFixtureIds } = await supabase
      .from('fixtures')
      .select('id')
      .or(teamOrFilterResults)
      .in('status', ['confirmed', 'completed', 'abandoned'])
    const ids = (myFixtureIds ?? []).map((f: any) => f.id)
    if (ids.length > 0) {
      const { data } = await supabase
        .from('results')
        .select(`
          id, home_score, away_score, created_at,
          fixtures(
            id, scheduled_date,
            home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
            away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
          )
        `)
        .in('fixture_id', ids)
        .order('created_at', { ascending: false })
        .limit(5)
      latestResults = data ?? []
    }
  } else {
    const { data } = await supabase
      .from('results')
      .select(`
        id, home_score, away_score, created_at,
        fixtures(
          id, scheduled_date,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)
    latestResults = data ?? []
  }

  // Unbeaten run leaders (5+)
  const { data: unbeaten } = tournament
    ? await supabase
        .from('standings')
        .select('unbeaten_run, teams(name, logo_league_folder, logo_team_slug)')
        .eq('tournament_id', tournament.id)
        .gte('unbeaten_run', 5)
        .order('unbeaten_run', { ascending: false })
        .limit(3)
    : { data: null }

  return (
    <PageWrapper>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-surface to-bg-base border border-border p-space-6 mb-space-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-accent),transparent_70%)] opacity-5" />
        <div className="relative">
          <div className="flex items-center gap-space-3 mb-space-2">
            <Image
              src="/efa-logo-white.png"
              alt="EFA"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-text-primary">Efootball Federal Association</h1>
              <p className="text-xs text-accent">Season 2025/26 — Live</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-2 mt-space-4">
            <Button as={Link} href="/standings" variant="primary" className="text-xs px-space-4">View Standings</Button>
            <Button as={Link} href="/fixtures" variant="secondary" className="text-xs px-space-4">Fixtures</Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-space-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-space-6">
          {/* Upcoming Fixtures */}
          <Card className="p-space-4">
            <div className="flex items-center justify-between mb-space-3">
              <div>
                <h2 className="section-header mb-0">Upcoming Fixtures</h2>
                {nextDate && (
                  <p className="text-xs text-accent mt-0.5">
                    {format(parseISO(nextDate), 'EEEE, d MMMM yyyy')}
                    {userTeam && <span className="text-text-muted ml-1">· {userTeam.name}</span>}
                  </p>
                )}
              </div>
              <Link href="/fixtures" className="text-xs text-accent hover:text-accent-hover font-medium">View all →</Link>
            </div>

            {!upcomingFixtures.length ? (
              <p className="text-sm text-text-muted py-space-4 text-center">No upcoming fixtures</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingFixtures.map((f: any) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center py-space-3 gap-space-3 hover:bg-bg-base/50 -mx-space-4 px-space-4 transition-colors">
                    <div className="flex-1 flex items-center gap-space-2">
                      {f.home_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.home_team.logo_league_folder}
                          teamSlug={f.home_team.logo_team_slug}
                          context="standings_row"
                          alt={f.home_team.name}
                          className="w-7 h-7 shrink-0"
                        />
                      )}
                      <span className="text-sm font-medium text-text-primary truncate">{f.home_team?.name}</span>
                    </div>

                    <div className="text-center min-w-[60px]">
                      {f.results?.[0] ? (
                        <span className="text-text-primary font-bold text-sm">
                          {f.results[0].home_score} – {f.results[0].away_score}
                        </span>
                      ) : (
                        <span className="text-xs text-accent font-medium">vs</span>
                      )}
                      <div className={`text-[10px] mt-0.5 ${
                        f.status === 'confirmed' ? 'text-feedback-success' :
                        f.status === 'awaiting_confirmation' ? 'text-feedback-warning' :
                        'text-text-muted'
                      }`}>
                        {f.status === 'confirmed' ? 'FT' :
                         f.status === 'awaiting_confirmation' ? 'Pending' : ''}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-space-2">
                      <span className="text-sm font-medium text-text-primary truncate text-right">{f.away_team?.name}</span>
                      {f.away_team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={f.away_team.logo_league_folder}
                          teamSlug={f.away_team.logo_team_slug}
                          context="standings_row"
                          alt={f.away_team.name}
                          className="w-7 h-7 shrink-0"
                        />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Latest Results */}
          <Card className="p-space-4">
            <div className="flex items-center justify-between mb-space-3">
              <h2 className="section-header mb-0">Latest Results</h2>
              <Link href="/results" className="text-xs text-accent hover:text-accent-hover font-medium">View all →</Link>
            </div>

            {!latestResults?.length ? (
              <p className="text-sm text-text-muted py-space-4 text-center">No results yet</p>
            ) : (
              <div className="space-y-space-2">
                {latestResults.map((r: any) => {
                  const f = r.fixtures
                  if (!f) return null
                  return (
                    <Link key={r.id} href={`/results/${r.id}`} className="flex items-center justify-between py-space-2 px-space-3 rounded-lg hover:bg-bg-base transition-colors border border-transparent hover:border-border">
                      <div className="flex items-center gap-space-2 flex-1">
                        {f.home_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt={f.home_team.name} className="w-6 h-6 shrink-0" />
                        )}
                        <span className="text-sm text-text-primary font-medium truncate">{f.home_team?.name}</span>
                      </div>
                      <div className="mx-space-3 text-center">
                        <span className="text-text-primary font-bold">{r.home_score}–{r.away_score}</span>
                      </div>
                      <div className="flex items-center gap-space-2 flex-1 justify-end">
                        <span className="text-sm text-text-primary font-medium truncate text-right">{f.away_team?.name}</span>
                        {f.away_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt={f.away_team.name} className="w-6 h-6 shrink-0" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-space-6">
          {/* Mini Standings */}
          {standings && standings.length > 0 && (
            <Card className="p-space-4">
              <div className="flex items-center justify-between mb-space-3">
                <h2 className="section-header mb-0">
                  <span className="text-accent">PL</span> Top 6
                </h2>
                <Link href="/standings" className="text-xs text-accent font-medium">Full table →</Link>
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
                      {s.unbeaten_run >= 3 && <Flame className="w-3.5 h-3.5 text-orange-400 inline" />}
                      <span className="text-xs font-bold text-text-primary w-5 text-right">{s.points}</span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Unbeaten runs */}
          {unbeaten && unbeaten.length > 0 && (
            <Card className="p-space-4">
              <h2 className="section-header">Unbeaten Runs</h2>
              <div className="space-y-space-2">
                {unbeaten.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-space-2">
                    {u.teams?.logo_league_folder && (
                      <Image src={getTeamLogo(u.teams.logo_league_folder, u.teams.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                    )}
                    <span className="flex-1 text-sm text-text-primary truncate">{u.teams?.name}</span>
                    <span className="text-xs bg-feedback-success/20 text-feedback-success px-space-2 py-0.5 rounded font-bold">
                      {u.unbeaten_run} unbeaten
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick links */}
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
    </PageWrapper>
  )
}

