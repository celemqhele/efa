import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import PageWrapper from '@/components/ui/PageWrapper'
import { FormStrip } from '@/components/ui/FormBadge'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO } from 'date-fns'

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
  // Build OR filter covering all of the user's team rows across phases
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
  const { data: latestResults } = await supabase
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-white dark:from-[#0f1a3d] dark:to-[#0a1128] border border-slate-200 dark:border-navy-border p-6 mb-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.08),transparent_70%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a84c] to-[#a07830] flex items-center justify-center">
              <span className="text-[#0a1128] font-black text-sm">EFA</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Efootball Federal Association</h1>
              <p className="text-xs text-[#c9a84c]">Season 2025/26 — Live</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/standings" className="btn-gold text-xs">View Standings</Link>
            <Link href="/fixtures" className="btn-outline text-xs">Fixtures</Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Fixtures */}
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="section-header mb-0">Upcoming Fixtures</h2>
                {nextDate && (
                  <p className="text-xs text-[#c9a84c] mt-0.5">
                    {format(parseISO(nextDate), 'EEEE, d MMMM yyyy')}
                    {userTeam && <span className="text-slate-500 ml-1">· {userTeam.name}</span>}
                  </p>
                )}
              </div>
              <Link href="/fixtures" className="text-xs text-[#c9a84c] hover:text-[#e0c06a]">View all →</Link>
            </div>

            {!upcomingFixtures.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No upcoming fixtures</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {upcomingFixtures.map((f: any) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`} className="flex items-center py-3 gap-3 hover:bg-black/5 -mx-4 px-4 transition-colors">
                    <div className="flex-1 flex items-center gap-2">
                      {f.home_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                          alt={f.home_team.name}
                          width={28} height={28}
                          className="object-contain"
                        />
                      )}
                      <span className="text-sm font-medium text-slate-900 truncate">{f.home_team?.name}</span>
                    </div>

                    <div className="text-center min-w-[60px]">
                      {f.results?.[0] ? (
                        <span className="text-slate-900 font-bold text-sm">
                          {f.results[0].home_score} – {f.results[0].away_score}
                        </span>
                      ) : (
                        <span className="text-xs text-[#c9a84c] font-medium">vs</span>
                      )}
                      <div className={`text-[10px] mt-0.5 ${
                        f.status === 'confirmed' ? 'text-green-400' :
                        f.status === 'awaiting_confirmation' ? 'text-yellow-400' :
                        'text-slate-500'
                      }`}>
                        {f.status === 'confirmed' ? 'FT' :
                         f.status === 'awaiting_confirmation' ? 'Pending' : ''}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate text-right">{f.away_team?.name}</span>
                      {f.away_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                          alt={f.away_team.name}
                          width={28} height={28}
                          className="object-contain"
                        />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Latest Results */}
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-header mb-0">Latest Results</h2>
              <Link href="/results" className="text-xs text-[#c9a84c] hover:text-[#e0c06a]">View all →</Link>
            </div>

            {!latestResults?.length ? (
              <p className="text-sm text-slate-500 py-4 text-center">No results yet</p>
            ) : (
              <div className="space-y-2">
                {latestResults.map((r: any) => {
                  const f = r.fixtures
                  if (!f) return null
                  return (
                    <Link key={r.id} href={`/results/${r.id}`} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-black/5 transition-colors border border-transparent hover:border-slate-200">
                      <div className="flex items-center gap-2 flex-1">
                        {f.home_team?.logo_league_folder && (
                          <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                        )}
                        <span className="text-sm text-slate-900 font-medium truncate">{f.home_team?.name}</span>
                      </div>
                      <div className="mx-3 text-center">
                        <span className="text-slate-900 font-bold">{r.home_score}–{r.away_score}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className="text-sm text-slate-900 font-medium truncate text-right">{f.away_team?.name}</span>
                        {f.away_team?.logo_league_folder && (
                          <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Mini Standings */}
          {standings && standings.length > 0 && (
            <section className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0">
                  <span className="text-[#c9a84c]">PL</span> Top 6
                </h2>
                <Link href="/standings" className="text-xs text-[#c9a84c]">Full table →</Link>
              </div>
              <div className="space-y-1">
                {standings.map((s: any, idx: number) => {
                  const team = s.teams
                  const isTop4 = idx < 4
                  return (
                    <Link key={s.id} href={`/teams/${team?.id}`} className="flex items-center gap-2 py-1.5 hover:bg-black/5 rounded-lg px-1 transition-colors">
                      <span className={`w-5 text-center text-xs font-bold ${isTop4 ? 'text-[#c9a84c]' : 'text-slate-500'}`}>
                        {idx + 1}
                      </span>
                      {team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                          alt={team.name}
                          width={20} height={20}
                          className="object-contain"
                        />
                      )}
                      <span className="flex-1 text-xs text-slate-900 truncate font-medium">{team?.name}</span>
                      {s.unbeaten_run >= 3 && <span className="text-xs">🔥</span>}
                      <span className="text-xs font-bold text-slate-900 w-5 text-right">{s.points}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Unbeaten runs */}
          {unbeaten && unbeaten.length > 0 && (
            <section className="card p-4">
              <h2 className="section-header">Unbeaten Runs</h2>
              <div className="space-y-2">
                {unbeaten.map((u: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    {u.teams?.logo_league_folder && (
                      <Image src={getTeamLogo(u.teams.logo_league_folder, u.teams.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                    )}
                    <span className="flex-1 text-sm text-slate-900 truncate">{u.teams?.name}</span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">
                      {u.unbeaten_run} unbeaten
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick links */}
          <section className="card p-4">
            <h2 className="section-header">Quick Links</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/hall-of-fame', label: 'Hall of Fame', icon: '🏆' },
                { href: '/predictions', label: 'Predictions', icon: '🎯' },
                { href: '/rules', label: 'Rules', icon: '📋' },
                { href: '/calendar', label: 'Calendar', icon: '📅' },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-navy-light border border-navy-border hover:border-[#c9a84c]/40 transition-colors">
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-xs text-slate-400 font-medium">{link.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
