import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'

export const revalidate = 60

export default async function ResultsPage() {
  const supabase = await createClient()

  // Fetch all finalised results joined with fixtures, teams, and tournament
  const { data: results } = await supabase
    .from('results')
    .select(`
      id, home_score, away_score, is_abandoned, created_at,
      fixtures(
        id, scheduled_date, tournament_id,
        home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
        away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
        tournaments(id, name, type)
      )
    `)
    .order('created_at', { ascending: false })

  // Group by tournament name
  const grouped = (results ?? []).reduce<Record<string, any[]>>((acc, r) => {
    const tournamentName =
      (r.fixtures as any)?.tournaments?.name ?? 'Unknown Tournament'
    if (!acc[tournamentName]) acc[tournamentName] = []
    acc[tournamentName].push(r)
    return acc
  }, {})

  const tournamentNames = Object.keys(grouped)

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return ''
    try {
      return format(parseISO(dateStr), 'd MMM yyyy')
    } catch {
      return dateStr
    }
  }

  const TOURNAMENT_TYPE_COLORS: Record<string, string> = {
    league: 'bg-[#c9a84c]/20 text-[#c9a84c] border-[#c9a84c]/30',
    ucl: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    europa: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    super_cup: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Results</h1>
        <p className="text-sm text-slate-400 mt-0.5">All finalised match results</p>
      </div>

      {tournamentNames.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No results recorded yet.</p>
        </div>
      ) : (
        tournamentNames.map((tournamentName) => {
          const tournamentResults = grouped[tournamentName]
          const firstResult = tournamentResults[0]
          const tournamentType =
            (firstResult?.fixtures as any)?.tournaments?.type ?? 'league'
          const pillStyle =
            TOURNAMENT_TYPE_COLORS[tournamentType] ??
            TOURNAMENT_TYPE_COLORS['league']

          return (
            <section key={tournamentName} className="space-y-3">
              {/* Tournament group header */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#1e2d5a]" />
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${pillStyle}`}
                  >
                    {tournamentName}
                  </span>
                </div>
                <div className="h-px flex-1 bg-[#1e2d5a]" />
              </div>

              {/* Result cards */}
              <div className="space-y-2">
                {tournamentResults.map((r: any) => {
                  const f = r.fixtures
                  if (!f) return null
                  const homeTeam = f.home_team
                  const awayTeam = f.away_team
                  const dateStr =
                    f.scheduled_date ?? r.created_at

                  return (
                    <Link
                      key={r.id}
                      href={`/results/${r.id}`}
                      className="card flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-white/[0.02] transition-all group"
                    >
                      {/* Home team */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end sm:justify-start flex-row-reverse sm:flex-row">
                        <span className="text-white font-semibold text-sm truncate text-right sm:text-left group-hover:text-[#c9a84c] transition-colors">
                          {homeTeam?.name ?? 'TBD'}
                        </span>
                        {homeTeam?.logo_league_folder && (
                          <div className="flex-shrink-0">
                            <TeamLogo
                              leagueFolder={homeTeam.logo_league_folder}
                              teamSlug={homeTeam.logo_team_slug}
                              context="standings_row"
                              alt={homeTeam.name}
                              className="w-8 h-8"
                            />
                          </div>
                        )}
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center gap-0.5 min-w-[72px]">
                        <span className="text-white font-bold text-xl leading-none">
                          {r.home_score}
                          <span className="text-slate-500 mx-1 text-lg">–</span>
                          {r.away_score}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatDate(dateStr)}
                        </span>
                        {r.is_abandoned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                            ABD
                          </span>
                        )}
                      </div>

                      {/* Away team */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        {awayTeam?.logo_league_folder && (
                          <div className="flex-shrink-0">
                            <TeamLogo
                              leagueFolder={awayTeam.logo_league_folder}
                              teamSlug={awayTeam.logo_team_slug}
                              context="standings_row"
                              alt={awayTeam.name}
                              className="w-8 h-8"
                            />
                          </div>
                        )}
                        <span className="text-white font-semibold text-sm truncate group-hover:text-[#c9a84c] transition-colors">
                          {awayTeam?.name ?? 'TBD'}
                        </span>
                      </div>

                      {/* Arrow hint */}
                      <div className="text-slate-600 group-hover:text-[#c9a84c] transition-colors text-sm flex-shrink-0">
                        →
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
