import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ tournament?: string }>
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
}

const STATUS_STYLES: Record<
  string,
  { label: string; pill: string }
> = {
  scheduled: {
    label: 'Scheduled',
    pill: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
  awaiting_confirmation: {
    label: 'Awaiting',
    pill: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
  confirmed: {
    label: 'Confirmed',
    pill: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  abandoned: {
    label: 'Abandoned',
    pill: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
}

export default async function FixturesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  // Fetch all tournaments (active or completed)
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .in('status', ['active', 'upcoming', 'completed'])
    .order('created_at', { ascending: true })

  // Determine which tournament to show
  const activeTournamentId =
    selectedTournamentId ??
    tournaments?.find((t) => t.status === 'active')?.id ??
    tournaments?.[0]?.id ??
    null

  // Fetch fixtures for selected tournament
  const { data: fixtures } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date, status, round_type, leg,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
          results(home_score, away_score)
        `)
        .eq('tournament_id', activeTournamentId)
        .order('scheduled_date', { ascending: false })
    : { data: null }

  // Group by matchday
  const grouped = (fixtures ?? []).reduce<Record<number, any[]>>((acc, f) => {
    const md = f.matchday ?? 0
    if (!acc[md]) acc[md] = []
    acc[md].push(f)
    return acc
  }, {})

  // Sort matchday groups descending
  const sortedMatchdays = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)

  const activeTournament = tournaments?.find(
    (t) => t.id === activeTournamentId
  )

  function formatScheduledDate(dateStr: string | null): string {
    if (!dateStr) return 'TBD'
    try {
      return format(parseISO(dateStr), 'EEE d MMM yyyy')
    } catch {
      return dateStr
    }
  }

  function getFirstFixtureDate(fixtureList: any[]): string {
    const sorted = [...fixtureList]
      .filter((f) => f.scheduled_date)
      .sort(
        (a, b) =>
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime()
      )
    if (!sorted.length) return ''
    try {
      return format(parseISO(sorted[0].scheduled_date), 'd MMM yyyy')
    } catch {
      return sorted[0].scheduled_date
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fixtures</h1>
        {activeTournament && (
          <p className="text-sm text-[#c9a84c] mt-0.5">{activeTournament.name}</p>
        )}
      </div>

      {/* Tournament filter tabs */}
      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/fixtures?tournament=${t.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  isActive
                    ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                    : 'bg-transparent text-slate-400 border-[#1e2d5a] hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
                }`}
              >
                {TOURNAMENT_TYPE_LABELS[t.type] ?? t.name}
              </Link>
            )
          })}
        </div>
      )}

      {/* Fixtures grouped by matchday */}
      {sortedMatchdays.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No fixtures found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedMatchdays.map((md) => {
            const dayFixtures: any[] = grouped[md]
            const dateLabel = getFirstFixtureDate(dayFixtures)

            return (
              <div key={md} className="space-y-2">
                {/* Matchday header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#1e2d5a]" />
                  <h2 className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest whitespace-nowrap px-1">
                    Matchday {md}
                    {dateLabel ? ` — ${dateLabel}` : ''}
                  </h2>
                  <div className="h-px flex-1 bg-[#1e2d5a]" />
                </div>

                {/* Fixture cards */}
                <div className="space-y-2">
                  {dayFixtures.map((f: any) => {
                    const result = f.results?.[0] ?? null
                    const statusInfo =
                      STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

                    return (
                      <Link
                        key={f.id}
                        href={`/fixtures/${f.id}`}
                        className="card flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-white/[0.02] transition-all group"
                      >
                        {/* Home team */}
                        <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end sm:justify-start flex-row-reverse sm:flex-row">
                          <span className="text-white font-semibold text-sm truncate text-right sm:text-left">
                            {f.home_team?.name ?? 'TBD'}
                          </span>
                          {f.home_team?.logo_league_folder && (
                            <div className="flex-shrink-0">
                              <TeamLogo
                                leagueFolder={f.home_team.logo_league_folder}
                                teamSlug={f.home_team.logo_team_slug}
                                context="standings_row"
                                alt={f.home_team.name}
                                className="w-8 h-8"
                              />
                            </div>
                          )}
                        </div>

                        {/* Centre: score or VS + date + status */}
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          {result ? (
                            <span className="text-white font-bold text-lg leading-none">
                              {result.home_score}{' '}
                              <span className="text-slate-500">–</span>{' '}
                              {result.away_score}
                            </span>
                          ) : (
                            <span className="text-[#c9a84c] font-bold text-sm">
                              vs
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 text-center leading-tight">
                            {formatScheduledDate(f.scheduled_date)}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        {/* Away team */}
                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                          {f.away_team?.logo_league_folder && (
                            <div className="flex-shrink-0">
                              <TeamLogo
                                leagueFolder={f.away_team.logo_league_folder}
                                teamSlug={f.away_team.logo_team_slug}
                                context="standings_row"
                                alt={f.away_team.name}
                                className="w-8 h-8"
                              />
                            </div>
                          )}
                          <span className="text-white font-semibold text-sm truncate">
                            {f.away_team?.name ?? 'TBD'}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
