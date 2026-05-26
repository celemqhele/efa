import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import DateNav from '@/components/ui/DateNav'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { getAppTodayKey, getAppDayUtcRange, APP_TIME_ZONE } from '@/lib/app-time'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

const TYPE_ORDER = ['league', 'ucl', 'europa', 'super_cup'] as const

const TYPE_LABELS: Record<string, string> = {
  league: 'Premier League',
  ucl: 'UEFA Champions League',
  europa: 'UEFA Europa League',
  super_cup: 'Super Cup',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-[#c9a84c] border-[#c9a84c]/40 bg-[#c9a84c]/5',
  ucl: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  europa: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  super_cup: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
}

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-slate-500/20 text-slate-500 border-slate-500/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  confirmed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-red-500/20 text-red-500 border-red-500/30' },
}

const ROUND_LABELS: Record<string, string> = {
  group: 'Group',
  r16: 'Round of 16',
  qf: 'Quarter-Final',
  sf: 'Semi-Final',
  final: 'Final',
}

export default async function FixturesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const todayKey = await getAppTodayKey(supabase)
  const selectedDate = params.date ?? todayKey
  const { startIso, endIso } = getAppDayUtcRange(selectedDate)

  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  // Fetch all fixtures scheduled on the selected JHB day
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg,
      tournament:tournaments(id, name, type),
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .gte('scheduled_date', startIso)
    .lt('scheduled_date', endIso)
    .order('scheduled_date', { ascending: true })

  // Results for those fixtures
  const fixtureIds = (fixtures ?? []).map((f: any) => f.id)
  const { data: resultsData } = fixtureIds.length > 0
    ? await supabase
        .from('results')
        .select('fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, { home_score: number; away_score: number }> = {}
  for (const r of resultsData ?? []) {
    resultsByFixture[(r as any).fixture_id] = r as any
  }

  // Group by tournament type
  const grouped: Record<string, any[]> = {}
  for (const f of fixtures ?? []) {
    const t = Array.isArray((f as any).tournament) ? (f as any).tournament[0] : (f as any).tournament
    const key = t?.type ?? 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  }

  const orderedTypes = TYPE_ORDER.filter((t) => (grouped[t]?.length ?? 0) > 0)

  function fixtureTime(scheduledDate: string | null): string | null {
    if (!scheduledDate) return null
    try {
      return new Date(scheduledDate).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: APP_TIME_ZONE,
      })
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fixtures & Results</h1>
      </div>

      <DateNav currentDate={selectedDate} todayKey={todayKey} basePath="/fixtures" />

      {orderedTypes.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">
            No fixtures for {format(parseISO(selectedDate), 'EEEE d MMM yyyy')}.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedTypes.map((type) => {
            const sectionFixtures = grouped[type] ?? []
            const tournamentMeta = (Array.isArray(sectionFixtures[0]?.tournament)
              ? sectionFixtures[0].tournament[0]
              : sectionFixtures[0]?.tournament) as { id: string; name: string; type: string } | undefined
            return (
              <section key={type} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded border ${TYPE_ACCENT[type] ?? 'text-slate-500 border-slate-200'}`}>
                    {TYPE_LABELS[type] ?? tournamentMeta?.name ?? type}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {sectionFixtures.length} {sectionFixtures.length === 1 ? 'fixture' : 'fixtures'}
                  </span>
                </div>

                <div className="space-y-2">
                  {sectionFixtures.map((f: any) => {
                    const result = resultsByFixture[f.id]
                    const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']
                    const homeWin = result && result.home_score > result.away_score
                    const awayWin = result && result.away_score > result.home_score
                    const time = fixtureTime(f.scheduled_date)
                    const roundLabel = f.round_type && f.round_type !== 'group'
                      ? ROUND_LABELS[f.round_type] ?? f.round_type.toUpperCase()
                      : null

                    return (
                      <div key={f.id} className="flex items-center gap-2">
                        <Link
                          href={`/fixtures/${f.id}`}
                          className="card flex-1 flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-black/[0.03] transition-all"
                        >
                          {/* Home */}
                          <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end flex-row-reverse sm:flex-row">
                            <span className={`text-sm font-semibold truncate text-right sm:text-left ${
                              awayWin ? 'text-slate-400' : 'text-slate-900'
                            }`}>
                              {f.home_team?.name ?? 'TBC'}
                            </span>
                            {f.home_team?.logo_league_folder && (
                              <div className="flex-shrink-0">
                                <TeamLogo
                                  leagueFolder={f.home_team.logo_league_folder}
                                  teamSlug={f.home_team.logo_team_slug}
                                  context="standings_row"
                                  alt={f.home_team.name}
                                  className={`w-8 h-8 ${awayWin ? 'opacity-40' : ''}`}
                                />
                              </div>
                            )}
                          </div>

                          {/* Centre */}
                          <div className="flex flex-col items-center gap-1 min-w-[80px]">
                            {result ? (
                              <span className="text-slate-900 font-bold text-lg leading-none">
                                {result.home_score}{' '}
                                <span className="text-slate-500">–</span>{' '}
                                {result.away_score}
                              </span>
                            ) : (
                              <span className="text-[#c9a84c] font-bold text-sm">vs</span>
                            )}
                            {time && (
                              <span className="text-[10px] text-slate-500 font-mono">{time}</span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
                              {statusInfo.label}
                            </span>
                            {roundLabel && (
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                                {roundLabel}
                              </span>
                            )}
                          </div>

                          {/* Away */}
                          <div className="flex-1 flex items-center gap-2.5 min-w-0">
                            {f.away_team?.logo_league_folder && (
                              <div className="flex-shrink-0">
                                <TeamLogo
                                  leagueFolder={f.away_team.logo_league_folder}
                                  teamSlug={f.away_team.logo_team_slug}
                                  context="standings_row"
                                  alt={f.away_team.name}
                                  className={`w-8 h-8 ${homeWin ? 'opacity-40' : ''}`}
                                />
                              </div>
                            )}
                            <span className={`text-sm font-semibold truncate ${
                              homeWin ? 'text-slate-400' : 'text-slate-900'
                            }`}>
                              {f.away_team?.name ?? 'TBC'}
                            </span>
                          </div>
                        </Link>

                        {isAdmin && f.status !== 'abandoned' && (
                          <Link
                            href={`/admin/results/submit?fixture=${f.id}`}
                            className="shrink-0 px-3 py-2 text-xs font-semibold text-[#c9a84c] border border-[#c9a84c]/30 rounded-lg hover:bg-[#c9a84c]/10 transition-colors whitespace-nowrap"
                          >
                            Submit
                          </Link>
                        )}
                      </div>
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
