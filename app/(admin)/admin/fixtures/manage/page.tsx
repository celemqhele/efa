import { createAdminClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import FixtureActions from './FixtureActions'
import DateNav from '@/components/ui/DateNav'
import { getAppTodayKey, getAppDayUtcRange, APP_TIME_ZONE } from '@/lib/app-time'
import ScheduleRoundPanel from './ScheduleRoundPanel'
import { CalendarDays } from 'lucide-react'

export const revalidate = 0
export const dynamic = 'force-dynamic'

const TYPE_ORDER = ['league', 'tournament_club', 'tournament_international', 'friendlies'] as const

const TYPE_LABELS: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Tournament (Clubs)',
  tournament_international: 'Tournament (Intl)',
  friendlies: 'Friendly',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-accent border-accent/40 bg-accent/5',
  tournament_club: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  tournament_international: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  friendlies: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
}

const STATUS_COLOURS: Record<string, string> = {
  scheduled: 'text-text-muted bg-slate-500/10 border-slate-500/20',
  awaiting_confirmation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  postponed: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const ROUND_LABELS: Record<string, string> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'Final',
}

export default async function FixturesManagePage({
  searchParams,
}: {
  searchParams: any // Flexible type prevents compilation errors across Next.js 14/15 version environments
}) {
  const supabase = await createAdminClient()

  // Hybrid Resolution: Safe unpack whether searchParams arrives as a Promise (Next 15) or plain Object (Next 14)
  const resolvedParams = searchParams && typeof searchParams.then === 'function'
    ? await searchParams
    : searchParams

  const todayKey = await getAppTodayKey(supabase)
  const selectedDate = resolvedParams?.date ?? todayKey

  // Fetch all fixtures scheduled on the selected day using core database relation aliases
  // We align with the ExportPage logic which is confirmed working
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, round_type, scheduled_date, status, is_postponed, leg,
      tournament:tournaments(id, name, type),
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      result:results(home_score, away_score)
    `)
    .eq('scheduled_date', selectedDate)
    .order('scheduled_date', { ascending: true })

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground-primary">Fixture Management</h1>
        <p className="text-text-muted text-sm mt-1">
          {(fixtures?.length ?? 0)} fixture{(fixtures?.length ?? 0) === 1 ? '' : 's'} on {format(parseISO(selectedDate), 'EEE d MMM yyyy')}
        </p>
      </div>

      <DateNav currentDate={selectedDate} todayKey={todayKey} basePath="/admin/fixtures/manage" />

      <ScheduleRoundPanel />

      {orderedTypes.length === 0 ? (
        <div className="card p-12 text-center text-text-muted">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p>No fixtures scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedTypes.map((type) => {
            const sectionFixtures = grouped[type] ?? []
            const tournamentMeta = (Array.isArray(sectionFixtures[0]?.tournament)
              ? sectionFixtures[0].tournament[0]
              : sectionFixtures[0]?.tournament) as { id: string; name: string; type: string } | undefined
            return (
              <section key={type} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded border ${TYPE_ACCENT[type] ?? 'text-text-muted border-border'}`}>
                    {TYPE_LABELS[type] ?? tournamentMeta?.name ?? type}
                  </h2>
                  <span className="text-xs text-text-muted">
                    {sectionFixtures.length} {sectionFixtures.length === 1 ? 'fixture' : 'fixtures'}
                  </span>
                </div>

                <div className="card overflow-hidden">
                  {/* Mobile card list layout */}
                  <div className="sm:hidden divide-y divide-navy-border">
                    {sectionFixtures.map((fx: any) => {
                      const result = fx.result?.[0]
                      const statusCls = STATUS_COLOURS[fx.status] ?? STATUS_COLOURS.scheduled
                      const homeTeam = Array.isArray(fx.home_team) ? fx.home_team[0] : fx.home_team
                      const awayTeam = Array.isArray(fx.away_team) ? fx.away_team[0] : fx.away_team
                      const time = fixtureTime(fx.scheduled_date)
                      const round = fx.round_type && fx.round_type !== 'group'
                        ? ROUND_LABELS[fx.round_type] ?? fx.round_type.toUpperCase()
                        : null
                      return (
                        <div key={fx.id} className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {time && (
                              <span className="text-text-muted text-xs font-bold font-mono">{time}</span>
                            )}
                            {round && (
                              <span className="text-text-muted text-[10px] font-semibold uppercase">{round}</span>
                            )}
                            <span className="text-text-muted text-[10px]">MD{fx.matchday}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>
                              {fx.status.replaceAll('_', ' ')}
                            </span>
                            {fx.is_postponed && (
                              <span className="text-orange-400 text-[10px]">Postponed</span>
                            )}
                          </div>
                          <p className="text-foreground-primary text-sm font-semibold">
                            {homeTeam?.name ?? 'TBC'}
                            <span className="text-text-muted font-normal mx-1.5">
                              {result ? `${result.home_score}–${result.away_score}` : 'vs'}
                            </span>
                            {awayTeam?.name ?? 'TBC'}
                          </p>
                          <FixtureActions
                            fixtureId={fx.id}
                            currentDate={fx.scheduled_date}
                            status={fx.status}
                            homeTeamId={homeTeam?.id ?? ''}
                            homeTeamName={homeTeam?.name ?? ''}
                            awayTeamId={awayTeam?.id ?? ''}
                            awayTeamName={awayTeam?.name ?? ''}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop table layout */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-navy-border bg-navy-light/50">
                          <th className="text-left text-xs text-text-muted py-3 px-4 w-20">Time</th>
                          <th className="text-left text-xs text-text-muted py-3 px-4">Home</th>
                          <th className="text-center text-xs text-text-muted py-3 px-2">Score</th>
                          <th className="text-left text-xs text-text-muted py-3 px-4">Away</th>
                          <th className="text-left text-xs text-text-muted py-3 px-4">Status</th>
                          <th className="text-left text-xs text-text-muted py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-navy-border">
                        {sectionFixtures.map((fx: any) => {
                          const result = fx.result?.[0]
                          const statusCls = STATUS_COLOURS[fx.status] ?? STATUS_COLOURS.scheduled
                          const homeTeam = Array.isArray(fx.home_team) ? fx.home_team[0] : fx.home_team
                          const awayTeam = Array.isArray(fx.away_team) ? fx.away_team[0] : fx.away_team
                          const time = fixtureTime(fx.scheduled_date)
                          const round = fx.round_type && fx.round_type !== 'group'
                            ? ROUND_LABELS[fx.round_type] ?? fx.round_type.toUpperCase()
                            : null
                          return (
                            <tr key={fx.id} className="hover:bg-navy-light/40 transition-colors">
                              <td className="py-3 px-4">
                                <div className="text-foreground-primary font-bold font-mono text-sm">{time ?? '—'}</div>
                                <div className="text-text-muted text-[10px] uppercase">
                                  {round ?? `MD${fx.matchday}`}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {homeTeam?.logo_league_folder && (
                                    <Image
                                      src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'standings_row')}
                                      alt={homeTeam.name}
                                      width={28} height={28}
                                      className="object-contain shrink-0"
                                    />
                                  )}
                                  <span className="text-foreground-primary font-medium">{homeTeam?.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                {result ? (
                                  <span className="text-foreground-primary font-bold text-base">
                                    {result.home_score} – {result.away_score}
                                  </span>
                                ) : (
                                  <span className="text-text-muted">vs</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {awayTeam?.logo_league_folder && (
                                    <Image
                                      src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'standings_row')}
                                      alt={awayTeam.name}
                                      width={28} height={28}
                                      className="object-contain shrink-0"
                                    />
                                  )}
                                  <span className="text-foreground-primary font-medium">{awayTeam?.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded border ${statusCls}`}>
                                  {fx.status.replaceAll('_', ' ')}
                                </span>
                                {fx.is_postponed && (
                                  <span className="text-orange-400 text-xs ml-1">P</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <FixtureActions
                                  fixtureId={fx.id}
                                  currentDate={fx.scheduled_date}
                                  status={fx.status}
                                  homeTeamId={homeTeam?.id ?? ''}
                                  homeTeamName={homeTeam?.name ?? ''}
                                  awayTeamId={awayTeam?.id ?? ''}
                                  awayTeamName={awayTeam?.name ?? ''}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

