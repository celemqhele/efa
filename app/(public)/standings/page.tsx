export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import StandingsSwitcher from './StandingsSwitcher'

interface Props {
  searchParams: { t?: string }
}

function positionStyle(pos: number) {
  if (pos <= 12) return 'text-[#c9a84c] font-bold'
  return 'text-blue-400 font-semibold'
}

function rowHighlight(pos: number) {
  if (pos <= 12) return 'border-l-2 border-[#c9a84c]'
  return 'border-l-2 border-blue-500'
}

function lastSix(form: string) {
  return form.replace(/[^WDL]/g, '').split('').slice(-6)
}

function hasWinStreak(form: string) {
  const t = form.replace(/[^WDL]/g, '')
  return t.length >= 3 && t.slice(-3) === 'WWW'
}

export default async function StandingsPage({ searchParams }: Props) {
  const supabase = await createClient()

  // All visible tournaments
  const { data: allT } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .in('status', ['active', 'completed', 'upcoming'])
    .order('created_at', { ascending: false })

  const tournaments = allT ?? []

  // Selected tournament: URL param → active league → first
  const selectedId = searchParams.t
  const selected =
    (selectedId ? tournaments.find((t) => t.id === selectedId) : null) ??
    tournaments.find((t) => t.type === 'league' && t.status === 'active') ??
    tournaments[0]

  if (!selected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Standings</h1>
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-slate-500 text-sm">No active competitions yet.</p>
        </div>
      </div>
    )
  }

  // Fetch based on type
  let standings: any[] | null = null
  const groupStandings: Record<string, any[]> = {}
  let knockoutRounds: any[] | null = null

  if (selected.type === 'league') {
    const { data } = await supabase
      .from('standings')
      .select(`
        id, played, wins, draws, losses, goals_for, goals_against,
        goal_difference, points, form, unbeaten_run,
        teams(
          id, name, logo_league_folder, logo_team_slug,
          profiles!manager_id(username)
        )
      `)
      .eq('tournament_id', selected.id)
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
      .order('goals_for', { ascending: false })
    standings = data

    // Fallback: if no standings rows yet, show all participants with 0 stats
    if (!standings || standings.length === 0) {
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select(`
          team_id,
          teams(id, name, logo_league_folder, logo_team_slug, profiles!manager_id(username))
        `)
        .eq('tournament_id', selected.id)
      standings = (parts ?? []).map((p: any, idx) => ({
        id: `fallback-${idx}`,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
        form: '', unbeaten_run: 0,
        teams: p.teams,
      }))
    }
  } else if (selected.type === 'ucl' || selected.type === 'europa') {
    const { data: gs } = await supabase
      .from('group_standings')
      .select(`
        id, group_name, played, wins, draws, losses,
        goals_for, goals_against, goal_difference, points,
        teams(id, name, logo_league_folder, logo_team_slug)
      `)
      .eq('tournament_id', selected.id)
      .order('group_name')
      .order('points', { ascending: false })
      .order('goal_difference', { ascending: false })
    for (const row of gs ?? []) {
      const g = row.group_name ?? 'A'
      if (!groupStandings[g]) groupStandings[g] = []
      groupStandings[g].push(row)
    }

    // Fallback: if no group_standings rows yet, build from participants
    if (Object.keys(groupStandings).length === 0) {
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select(`team_id, group_name, teams(id, name, logo_league_folder, logo_team_slug)`)
        .eq('tournament_id', selected.id)
      for (const p of parts ?? []) {
        const g = (p as any).group_name ?? 'A'
        if (!groupStandings[g]) groupStandings[g] = []
        groupStandings[g].push({
          id: `fallback-${(p as any).team_id}`,
          group_name: g,
          played: 0, wins: 0, draws: 0, losses: 0,
          goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
          teams: (p as any).teams,
        })
      }
    }

    const { data: kr } = await supabase
      .from('knockout_rounds')
      .select(`
        id, round_name, home_agg, away_agg, winner_id,
        home_team:home_team_id(id, name, logo_league_folder, logo_team_slug),
        away_team:away_team_id(id, name, logo_league_folder, logo_team_slug)
      `)
      .eq('tournament_id', selected.id)
    knockoutRounds = kr
  } else {
    // Super Cup, custom
    const { data: kr } = await supabase
      .from('knockout_rounds')
      .select(`
        id, round_name, home_agg, away_agg, winner_id,
        home_team:home_team_id(id, name, logo_league_folder, logo_team_slug),
        away_team:away_team_id(id, name, logo_league_folder, logo_team_slug)
      `)
      .eq('tournament_id', selected.id)
    knockoutRounds = kr
    const { data: s } = await supabase
      .from('standings')
      .select(`
        id, played, wins, draws, losses, goals_for, goals_against,
        goal_difference, points, form,
        teams(id, name, logo_league_folder, logo_team_slug, profiles!manager_id(username))
      `)
      .eq('tournament_id', selected.id)
      .order('points', { ascending: false })
    standings = s
  }

  const switcherTournaments = tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Standings</h1>
          <p className="text-sm text-[#c9a84c] mt-0.5">{selected.name}</p>
        </div>
        {selected.type === 'league' && (
          <div className="hidden sm:flex flex-col gap-1 text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-3 h-3 rounded-sm bg-[#c9a84c]" />
              <span className="text-xs text-slate-400">UCL (1–12)</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xs text-slate-400">Europa (13–20)</span>
            </div>
          </div>
        )}
      </div>

      {/* Switcher — only shown when >1 tournament */}
      {tournaments.length > 1 && (
        <StandingsSwitcher tournaments={switcherTournaments} selectedId={selected.id} />
      )}

      {/* LEAGUE VIEW */}
      {selected.type === 'league' && (
        <>
          {!standings || standings.length === 0 ? (
            <div className="card p-12 text-center text-slate-500 text-sm">No standings data yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2d5a] bg-[#0f1a3d]">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-8">#</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Club</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">P</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">W</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">D</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">L</th>
                      <th className="hidden sm:table-cell text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">GF</th>
                      <th className="hidden sm:table-cell text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">GA</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider w-9">GD</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-[#c9a84c] uppercase tracking-wider w-10">Pts</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[120px]">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s: any, idx: number) => {
                      const pos = idx + 1
                      const team = s.teams
                      const managerUsername = team?.profiles?.username ?? null
                      const formLetters = lastSix(s.form ?? '')
                      const onFire = hasWinStreak(s.form ?? '')
                      const unbeaten = s.unbeaten_run >= 5

                      return (
                        <tr
                          key={s.id}
                          className={`border-b border-[#1e2d5a]/60 hover:bg-white/[0.03] transition-colors ${rowHighlight(pos)}`}
                        >
                          <td className="py-3 px-3">
                            <span className={`text-sm ${positionStyle(pos)}`}>{pos}</span>
                          </td>
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
                                  {onFire && <span className="text-base leading-none" title="Win streak">🔥</span>}
                                  {unbeaten && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-bold whitespace-nowrap">
                                      Unbeaten
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">
                                  {managerUsername ? `(${managerUsername})` : '(NO MANAGER)'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-300">{s.played}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{s.wins}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{s.draws}</td>
                          <td className="py-3 px-2 text-center text-slate-300">{s.losses}</td>
                          <td className="hidden sm:table-cell py-3 px-2 text-center text-slate-300">{s.goals_for}</td>
                          <td className="hidden sm:table-cell py-3 px-2 text-center text-slate-300">{s.goals_against}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={s.goal_difference > 0 ? 'text-green-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400'}>
                              {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className="text-white font-bold text-sm">{s.points}</span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-0.5">
                              {formLetters.map((r, i) => (
                                <span
                                  key={i}
                                  className={r === 'W' ? 'badge-win' : r === 'D' ? 'badge-draw' : 'badge-loss'}
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile legend */}
              <div className="sm:hidden flex flex-wrap gap-3 px-4 py-3 border-t border-[#1e2d5a] bg-[#0f1a3d]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#c9a84c]" />
                  <span className="text-xs text-slate-400">UCL (1–12)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span className="text-xs text-slate-400">Europa (13–20)</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* UCL / EUROPA VIEW — groups + knockout */}
      {(selected.type === 'ucl' || selected.type === 'europa') && (
        <div className="space-y-8">
          {Object.keys(groupStandings).length > 0 && (
            <div>
              <h2 className="text-base font-bold text-white mb-4 uppercase tracking-wider text-[#c9a84c]">Group Stage</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(groupStandings).map(([group, rows]) => (
                  <GroupTable key={group} groupName={group} rows={rows} />
                ))}
              </div>
            </div>
          )}
          {knockoutRounds && knockoutRounds.length > 0 && (
            <KnockoutBracket rounds={knockoutRounds} />
          )}
          {Object.keys(groupStandings).length === 0 && !knockoutRounds?.length && (
            <EmptyComp name={selected.name} />
          )}
        </div>
      )}

      {/* SUPER CUP / CUSTOM */}
      {selected.type !== 'league' && selected.type !== 'ucl' && selected.type !== 'europa' && (
        <div className="space-y-6">
          {knockoutRounds && knockoutRounds.length > 0 && (
            <KnockoutBracket rounds={knockoutRounds} />
          )}
          {standings && standings.length > 0 && (
            <GenericTable standings={standings} />
          )}
          {!knockoutRounds?.length && !standings?.length && (
            <EmptyComp name={selected.name} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function GroupTable({ groupName, rows }: { groupName: string; rows: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-2 bg-[#0f1a3d] border-b border-[#1e2d5a]">
        <span className="text-xs font-bold text-[#c9a84c] uppercase tracking-widest">Group {groupName}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e2d5a]">
            <th className="text-left py-2 px-3 text-xs text-slate-500">Club</th>
            <th className="text-center py-2 px-1 text-xs text-slate-500 w-7">P</th>
            <th className="text-center py-2 px-1 text-xs text-slate-500 w-7">W</th>
            <th className="text-center py-2 px-1 text-xs text-slate-500 w-7">D</th>
            <th className="text-center py-2 px-1 text-xs text-slate-500 w-7">L</th>
            <th className="text-center py-2 px-1 text-xs text-slate-500 w-9">GD</th>
            <th className="text-center py-2 px-2 text-xs text-[#c9a84c] w-9">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, idx: number) => (
            <tr key={r.id} className={`border-b border-[#1e2d5a]/40 ${idx < 2 ? 'border-l-2 border-[#c9a84c]' : 'border-l-2 border-transparent'}`}>
              <td className="py-2 px-3">
                <div className="flex items-center gap-2">
                  {r.teams?.logo_league_folder && (
                    <TeamLogo
                      leagueFolder={r.teams.logo_league_folder}
                      teamSlug={r.teams.logo_team_slug}
                      context="standings_row"
                      alt={r.teams.name}
                      className="w-5 h-5"
                    />
                  )}
                  <span className="text-white text-xs font-medium truncate">{r.teams?.name ?? '—'}</span>
                  {idx < 2 && (
                    <span className="text-[10px] text-[#c9a84c] font-bold ml-auto shrink-0">Q</span>
                  )}
                </div>
              </td>
              <td className="text-center text-xs text-slate-300 py-2 px-1">{r.played}</td>
              <td className="text-center text-xs text-slate-300 py-2 px-1">{r.wins}</td>
              <td className="text-center text-xs text-slate-300 py-2 px-1">{r.draws}</td>
              <td className="text-center text-xs text-slate-300 py-2 px-1">{r.losses}</td>
              <td className="text-center text-xs py-2 px-1">
                <span className={r.goal_difference > 0 ? 'text-green-400' : r.goal_difference < 0 ? 'text-red-400' : 'text-slate-400'}>
                  {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
                </span>
              </td>
              <td className="text-center py-2 px-2">
                <span className="text-white font-bold text-xs">{r.points}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ROUND_ORDER = ['Quarter Final', 'Semi Final', 'Final', 'Super Cup']

function KnockoutBracket({ rounds }: { rounds: any[] }) {
  const sorted = [...rounds].sort(
    (a, b) => ROUND_ORDER.indexOf(a.round_name) - ROUND_ORDER.indexOf(b.round_name)
  )
  const grouped: Record<string, any[]> = {}
  for (const r of sorted) {
    const k = r.round_name ?? 'Round'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(r)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([roundName, matches]) => (
        <div key={roundName}>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{roundName}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((m: any) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MatchCard({ match }: { match: any }) {
  const home = match.home_team
  const away = match.away_team
  const hasScore = match.home_agg != null && match.away_agg != null
  const winnerId = match.winner_id

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {/* Home */}
        <div className={`flex items-center gap-2 flex-1 min-w-0 ${winnerId === away?.id ? 'opacity-50' : ''}`}>
          {home?.logo_league_folder && (
            <TeamLogo
              leagueFolder={home.logo_league_folder}
              teamSlug={home.logo_team_slug}
              context="standings_row"
              alt={home.name}
              className="w-7 h-7 shrink-0"
            />
          )}
          <span className="text-white font-semibold text-sm truncate">{home?.name ?? 'TBD'}</span>
          {winnerId === home?.id && <span className="text-[10px] text-[#c9a84c] font-bold shrink-0">W</span>}
        </div>

        {/* Score */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasScore ? (
            <>
              <span className="text-white font-black text-lg w-6 text-center">{match.home_agg}</span>
              <span className="text-slate-500 text-sm">–</span>
              <span className="text-white font-black text-lg w-6 text-center">{match.away_agg}</span>
            </>
          ) : (
            <span className="text-slate-500 text-sm px-2">vs</span>
          )}
        </div>

        {/* Away */}
        <div className={`flex items-center gap-2 flex-1 min-w-0 justify-end ${winnerId === home?.id ? 'opacity-50' : ''}`}>
          {winnerId === away?.id && <span className="text-[10px] text-[#c9a84c] font-bold shrink-0">W</span>}
          <span className="text-white font-semibold text-sm truncate text-right">{away?.name ?? 'TBD'}</span>
          {away?.logo_league_folder && (
            <TeamLogo
              leagueFolder={away.logo_league_folder}
              teamSlug={away.logo_team_slug}
              context="standings_row"
              alt={away.name}
              className="w-7 h-7 shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function GenericTable({ standings }: { standings: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d5a] bg-[#0f1a3d]">
              <th className="text-left py-3 px-3 text-xs text-slate-400 uppercase w-8">#</th>
              <th className="text-left py-3 px-2 text-xs text-slate-400 uppercase">Club</th>
              <th className="text-center py-3 px-2 text-xs text-slate-400 uppercase w-9">P</th>
              <th className="text-center py-3 px-2 text-xs text-slate-400 uppercase w-9">W</th>
              <th className="text-center py-3 px-2 text-xs text-slate-400 uppercase w-9">D</th>
              <th className="text-center py-3 px-2 text-xs text-slate-400 uppercase w-9">L</th>
              <th className="text-center py-3 px-2 text-xs text-slate-400 uppercase w-9">GD</th>
              <th className="text-center py-3 px-2 text-xs text-[#c9a84c] uppercase w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s: any, idx: number) => (
              <tr key={s.id} className="border-b border-[#1e2d5a]/60 hover:bg-white/[0.03] border-l-2 border-l-transparent">
                <td className="py-3 px-3 text-slate-400 text-sm">{idx + 1}</td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2.5">
                    {s.teams?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={s.teams.logo_league_folder}
                        teamSlug={s.teams.logo_team_slug}
                        context="standings_row"
                        alt={s.teams.name}
                        className="w-7 h-7"
                      />
                    )}
                    <div>
                      <div className="text-white font-semibold text-sm">{s.teams?.name ?? 'Unknown'}</div>
                      {s.teams?.profiles?.username && (
                        <div className="text-[11px] text-slate-500">({s.teams.profiles.username})</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2 text-center text-slate-300">{s.played}</td>
                <td className="py-3 px-2 text-center text-slate-300">{s.wins}</td>
                <td className="py-3 px-2 text-center text-slate-300">{s.draws}</td>
                <td className="py-3 px-2 text-center text-slate-300">{s.losses}</td>
                <td className="py-3 px-2 text-center">
                  <span className={s.goal_difference > 0 ? 'text-green-400' : s.goal_difference < 0 ? 'text-red-400' : 'text-slate-400'}>
                    {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                  </span>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-white font-bold text-sm">{s.points}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyComp({ name }: { name: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-slate-500 text-sm">No data available for {name} yet.</p>
    </div>
  )
}
