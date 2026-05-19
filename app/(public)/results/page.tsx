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

const ROUND_LABELS: Record<string, string> = {
  sf: 'Semi-Final',
  final: 'Final',
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  // Fetch tournaments with any confirmed fixtures
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: true })

  const activeTournamentId =
    selectedTournamentId ??
    tournaments?.find((t) => t.status === 'active')?.id ??
    tournaments?.[0]?.id ??
    null

  const activeTournament = tournaments?.find((t) => t.id === activeTournamentId)

  // Get all matchdays that have at least one confirmed fixture
  const { data: confirmedRows } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select('matchday')
        .eq('tournament_id', activeTournamentId)
        .eq('status', 'confirmed')
    : { data: null }

  const matchdaysWithResults = Array.from(
    new Set((confirmedRows ?? []).map((f) => f.matchday ?? 0).filter((md) => md > 0))
  ).sort((a, b) => a - b)

  // Default = most recent (highest) matchday with results
  const defaultMatchday = matchdaysWithResults[matchdaysWithResults.length - 1] ?? 1
  const selectedMatchday = params.matchday ? parseInt(params.matchday) : defaultMatchday

  const prevMd = matchdaysWithResults.filter((md) => md < selectedMatchday).at(-1) ?? null
  const nextMd = matchdaysWithResults.filter((md) => md > selectedMatchday)[0] ?? null

  // Fetch confirmed fixtures for selected matchday
  const { data: fixtures } = activeTournamentId
    ? await supabase
        .from('fixtures')
        .select(`
          id, matchday, scheduled_date, status, round_type, leg, group_name,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
          results(id, home_score, away_score, is_abandoned)
        `)
        .eq('tournament_id', activeTournamentId)
        .eq('matchday', selectedMatchday)
        .eq('status', 'confirmed')
        .order('scheduled_date', { ascending: true })
    : { data: null }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    try { return format(parseISO(dateStr), 'EEE d MMM yyyy') }
    catch { return dateStr }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Results</h1>
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
                href={`/results?tournament=${t.id}`}
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
      {matchdaysWithResults.length > 0 && (
        <div className="flex items-center gap-3">
          {prevMd !== null ? (
            <Link
              href={`/results?${activeTournamentId ? `tournament=${activeTournamentId}&` : ''}matchday=${prevMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d5a] text-slate-400 hover:border-[#c9a84c]/50 hover:text-white transition-colors"
            >
              ← MD {prevMd}
            </Link>
          ) : (
            <div className="w-20" />
          )}

          <div className="flex-1 text-center">
            <span className="text-sm font-bold text-white">
              {ROUND_LABELS[(fixtures?.[0] as any)?.round_type ?? ''] ?? `Matchday ${selectedMatchday}`}
            </span>
          </div>

          {nextMd !== null ? (
            <Link
              href={`/results?${activeTournamentId ? `tournament=${activeTournamentId}&` : ''}matchday=${nextMd}`}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#1e2d5a] text-slate-400 hover:border-[#c9a84c]/50 hover:text-white transition-colors"
            >
              MD {nextMd} →
            </Link>
          ) : (
            <div className="w-20" />
          )}
        </div>
      )}

      {/* Results */}
      {matchdaysWithResults.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No results recorded yet.</p>
        </div>
      ) : (fixtures ?? []).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No results for Matchday {selectedMatchday}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(fixtures ?? []).map((f: any) => {
            const result = f.results?.[0] ?? null
            if (!result) return null
            const homeWin = result.home_score > result.away_score
            const awayWin = result.away_score > result.home_score

            return (
              <Link
                key={f.id}
                href={`/results/${result.id}`}
                className="card flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-white/[0.02] transition-all group"
              >
                {/* Home team */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end flex-row-reverse sm:flex-row">
                  <span className={`text-sm font-semibold truncate text-right sm:text-left ${
                    homeWin ? 'text-white' : awayWin ? 'text-slate-500' : 'text-white'
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

                {/* Score */}
                <div className="flex flex-col items-center gap-0.5 min-w-[80px]">
                  <span className="text-white font-bold text-xl leading-none">
                    {result.home_score}
                    <span className="text-slate-500 mx-1.5">–</span>
                    {result.away_score}
                  </span>
                  <span className="text-[10px] text-slate-500 text-center">
                    {formatDate(f.scheduled_date)}
                  </span>
                  {result.is_abandoned && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                      ABD
                    </span>
                  )}
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
                        className={`w-8 h-8 ${homeWin ? 'opacity-40' : ''}`}
                      />
                    </div>
                  )}
                  <span className={`text-sm font-semibold truncate ${
                    awayWin ? 'text-white' : homeWin ? 'text-slate-500' : 'text-white'
                  }`}>
                    {f.away_team?.name ?? 'TBC'}
                  </span>
                </div>

                <div className="text-slate-600 group-hover:text-[#c9a84c] transition-colors text-sm flex-shrink-0">→</div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
