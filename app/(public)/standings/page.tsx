import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'

export const revalidate = 60

export default async function StandingsPage() {
  const supabase = await createClient()

  // Get active league tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, type')
    .eq('type', 'league')
    .eq('status', 'active')
    .single()

  // Fetch all standings joined with teams + manager profile
  const { data: standings } = tournament
    ? await supabase
        .from('standings')
        .select(`
          id, played, wins, draws, losses, goals_for, goals_against,
          goal_difference, points, form, unbeaten_run,
          teams(
            id, name, logo_league_folder, logo_team_slug,
            profiles!manager_id(username)
          )
        `)
        .eq('tournament_id', tournament.id)
        .order('points', { ascending: false })
        .order('goal_difference', { ascending: false })
        .order('goals_for', { ascending: false })
    : { data: null }

  function getPositionStyle(pos: number): string {
    if (pos <= 4) return 'text-[#c9a84c] font-bold'
    if (pos <= 8) return 'text-blue-400 font-bold'
    if (pos >= 17) return 'text-red-400 font-bold'
    return 'text-slate-400'
  }

  function getRowHighlight(pos: number): string {
    if (pos <= 4) return 'border-l-2 border-[#c9a84c]'
    if (pos <= 8) return 'border-l-2 border-blue-500'
    if (pos >= 17) return 'border-l-2 border-red-500'
    return 'border-l-2 border-transparent'
  }

  function hasWinStreak(form: string): boolean {
    // Check if form ends with 3 or more consecutive W's
    const trimmed = form.replace(/[^WDL]/g, '')
    return trimmed.length >= 3 && trimmed.slice(-3) === 'WWW'
  }

  const lastSix = (form: string) =>
    form
      .replace(/[^WDL]/g, '')
      .split('')
      .slice(-6)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Standings</h1>
          {tournament && (
            <p className="text-sm text-[#c9a84c] mt-0.5">{tournament.name}</p>
          )}
        </div>
        <div className="hidden sm:flex flex-col gap-1 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-3 h-3 rounded-sm bg-[#c9a84c]" />
            <span className="text-xs text-slate-400">UCL (1–4)</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-xs text-slate-400">Europa (5–8)</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            <span className="text-xs text-slate-400">Relegation (17–20)</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {!standings || standings.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No standings data available.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table scroll container */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2d5a] bg-[#0f1a3d]">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-8">
                    #
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Club
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    P
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    W
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    D
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    L
                  </th>
                  {/* GF / GA hidden on mobile */}
                  <th className="hidden sm:table-cell text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    GF
                  </th>
                  <th className="hidden sm:table-cell text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    GA
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">
                    GD
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-semibold text-[#c9a84c] uppercase tracking-wider w-10">
                    Pts
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[120px]">
                    Form
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s: any, idx: number) => {
                  const pos = idx + 1
                  const team = s.teams
                  const managerUsername =
                    team?.profiles?.username ?? null
                  const formLetters = lastSix(s.form ?? '')
                  const onFire = hasWinStreak(s.form ?? '')
                  const unbeaten = s.unbeaten_run >= 5

                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-[#1e2d5a]/60 hover:bg-white/[0.03] transition-colors ${getRowHighlight(pos)}`}
                    >
                      {/* Position */}
                      <td className="py-3 px-3">
                        <span className={`text-sm ${getPositionStyle(pos)}`}>
                          {pos}
                        </span>
                      </td>

                      {/* Club */}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {team?.logo_league_folder && (
                            <div className="flex-shrink-0">
                              <TeamLogo
                                leagueFolder={team.logo_league_folder}
                                teamSlug={team.logo_team_slug}
                                context="standings_row"
                                alt={team.name}
                                className="w-7 h-7"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-white font-semibold text-sm truncate leading-tight">
                                {team?.name ?? 'Unknown'}
                              </span>
                              {onFire && (
                                <span className="text-base leading-none" title="Win streak">
                                  🔥
                                </span>
                              )}
                              {unbeaten && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold whitespace-nowrap">
                                  Unbeaten
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                              {managerUsername
                                ? `(${managerUsername})`
                                : '(NO MANAGER)'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stats */}
                      <td className="py-3 px-2 text-center text-slate-300">{s.played}</td>
                      <td className="py-3 px-2 text-center text-slate-300">{s.wins}</td>
                      <td className="py-3 px-2 text-center text-slate-300">{s.draws}</td>
                      <td className="py-3 px-2 text-center text-slate-300">{s.losses}</td>

                      {/* GF / GA — hidden on mobile */}
                      <td className="hidden sm:table-cell py-3 px-2 text-center text-slate-300">
                        {s.goals_for}
                      </td>
                      <td className="hidden sm:table-cell py-3 px-2 text-center text-slate-300">
                        {s.goals_against}
                      </td>

                      {/* GD */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={
                            s.goal_difference > 0
                              ? 'text-green-400'
                              : s.goal_difference < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                          }
                        >
                          {s.goal_difference > 0
                            ? `+${s.goal_difference}`
                            : s.goal_difference}
                        </span>
                      </td>

                      {/* Points */}
                      <td className="py-3 px-2 text-center">
                        <span className="text-white font-bold text-sm">{s.points}</span>
                      </td>

                      {/* Form */}
                      <td className="py-3 px-2">
                        <div className="flex gap-0.5">
                          {formLetters.map((r, i) => {
                            const cls =
                              r === 'W'
                                ? 'badge-win'
                                : r === 'D'
                                ? 'badge-draw'
                                : 'badge-loss'
                            return (
                              <span key={i} className={cls}>
                                {r}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend (mobile) */}
          <div className="sm:hidden flex flex-wrap gap-3 px-4 py-3 border-t border-[#1e2d5a] bg-[#0f1a3d]">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#c9a84c]" />
              <span className="text-xs text-slate-400">UCL (1–4)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xs text-slate-400">Europa (5–8)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              <span className="text-xs text-slate-400">Relegation (17–20)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
