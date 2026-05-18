import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tournament?: string; matchday?: string }>
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
}

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
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

  // Fetch all active/completed tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .in('status', ['active', 'upcoming', 'completed'])
    .order('created_at', { ascending: true })

  const activeTournamentId =
    selectedTournamentId ??
    tournaments?.find((t) => t.status === 'active')?.id ??
    tournaments?.[0]?.id ??
    null

  const activeTournament = tournaments?.find((t) => t.id === activeTournamentId)

  // ── Determine current matchday ───────────────────────────────────────────────
  // Fetch matchday completion summary for the tournament
  const { data: allMdRows } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select('matchday, status')
        .eq('tournament_id', activeTournamentId)
    : { data: null }

  // Build per-matchday completion map
  const mdMap: Record<number, { total: number; done: number }> = {}
  for (const f of allMdRows ?? []) {
    const md = f.matchday ?? 0
    if (!mdMap[md]) mdMap[md] = { total: 0, done: 0 }
    mdMap[md].total++
    if (f.status === 'confirmed') mdMap[md].done++
  }

  const sortedMatchdays = Object.keys(mdMap)
    .map(Number)
    .sort((a, b) => a - b)

  // Current matchday = lowest MD where not all fixtures are confirmed
  const currentMatchday =
    sortedMatchdays.find((md) => mdMap[md].done < mdMap[md].total) ??
    sortedMatchdays[sortedMatchdays.length - 1] ??
    1

  const selectedMatchday = params.matchday
    ? parseInt(params.matchday)
    : currentMatchday

  const isCurrentMd = selectedMatchday === currentMatchday

  // ── Fetch fixtures for the selected matchday ─────────────────────────────────
  // On current matchday: only show unresolved (scheduled/awaiting) fixtures
  // On past matchdays: show everything
  let fixtureQuery = supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg,
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
      results(home_score, away_score)
    `)
    .eq('tournament_id', activeTournamentId ?? '')
    .eq('matchday', selectedMatchday)
    .order('scheduled_date', { ascending: true })

  if (isCurrentMd) {
    // Hide fully confirmed fixtures — they belong in Results
    fixtureQuery = fixtureQuery.neq('status', 'confirmed')
  }

  const { data: fixtures } = activeTournamentId
    ? await fixtureQuery
    : { data: null }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'TBD'
    try {
      return format(parseISO(dateStr), 'EEE d MMM yyyy')
    } catch {
      return dateStr
    }
  }

  const prevMd = sortedMatchdays
    .filter((md) => md < selectedMatchday)
    .at(-1) ?? null
  const nextMd = sortedMatchdays
    .filter((md) => md > selectedMatchday)[0] ?? null

  const mdComplete =
    mdMap[selectedMatchday]?.total > 0 &&
    mdMap[selectedMatchday]?.done === mdMap[selectedMatchday]?.total

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fixtures</h1>
        {activeTournament && (
          <p className="text-sm text-[#c9a84c] mt-0.5">{activeTournament.name}</p>
        )}
      </div>

      {/* Tournament tabs */}
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

      {/* Matchday navigation */}
      {sortedMatchdays.length > 1 && (
        <div className="flex items-center gap-3">
          {prevMd !== null ? (
            <Link
              href={`/fixtures?${activeTournamentId ? `tournament=${activeTournamentId}&` : ''}matchday=${prevMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d5a] text-slate-400 hover:border-[#c9a84c]/50 hover:text-white transition-colors"
            >
              ← MD {prevMd}
            </Link>
          ) : (
            <div className="w-20" />
          )}

          <div className="flex-1 text-center">
            <span className="text-sm font-bold text-white">Matchday {selectedMatchday}</span>
            {isCurrentMd && (
              <span className="ml-2 text-[10px] bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Current
              </span>
            )}
            {mdComplete && (
              <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Complete
              </span>
            )}
          </div>

          {nextMd !== null ? (
            <Link
              href={`/fixtures?${activeTournamentId ? `tournament=${activeTournamentId}&` : ''}matchday=${nextMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d5a] text-slate-400 hover:border-[#c9a84c]/50 hover:text-white transition-colors"
            >
              MD {nextMd} →
            </Link>
          ) : (
            <div className="w-20" />
          )}
        </div>
      )}

      {/* Fixtures list */}
      {!activeTournamentId ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No active tournaments.</p>
        </div>
      ) : mdComplete && isCurrentMd ? (
        <div className="card p-10 text-center space-y-2">
          <p className="text-2xl">✅</p>
          <p className="text-white font-semibold">All results submitted for Matchday {selectedMatchday}</p>
          {nextMd !== null ? (
            <Link
              href={`/fixtures?${activeTournamentId ? `tournament=${activeTournamentId}&` : ''}matchday=${nextMd}`}
              className="inline-block mt-3 px-5 py-2 bg-[#c9a84c] text-[#0a1128] font-bold rounded-lg text-sm"
            >
              View Matchday {nextMd} →
            </Link>
          ) : (
            <p className="text-slate-500 text-sm">All matchdays complete.</p>
          )}
        </div>
      ) : (fixtures ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No fixtures for Matchday {selectedMatchday}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(fixtures ?? []).map((f: any) => {
            const result = f.results?.[0] ?? null
            const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

            return (
              <Link
                key={f.id}
                href={`/fixtures/${f.id}`}
                className="card flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-white/[0.02] transition-all group"
              >
                {/* Home team */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end flex-row-reverse sm:flex-row">
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

                {/* Centre */}
                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                  {result ? (
                    <span className="text-white font-bold text-lg leading-none">
                      {result.home_score}{' '}
                      <span className="text-slate-500">–</span>{' '}
                      {result.away_score}
                    </span>
                  ) : (
                    <span className="text-[#c9a84c] font-bold text-sm">vs</span>
                  )}
                  <span className="text-[10px] text-slate-500 text-center leading-tight">
                    {formatDate(f.scheduled_date)}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
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
      )}
    </div>
  )
}
