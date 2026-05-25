import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tournament?: string }>
}

type FixtureRow = {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  round_type: string | null
  status: string | null
}

type ResultRow = {
  fixture_id: string
  home_score: number
  away_score: number
  override_reason?: string | null
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
}

function cleanGroupName(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.replace(/^group\s+/i, '').trim() || null
}

function goalDifference(row: any): number {
  return (row.goals_for ?? 0) - (row.goals_against ?? 0)
}

function sortStandingsRows(rows: any[]) {
  return [...rows].sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)

    const gdA = goalDifference(a)
    const gdB = goalDifference(b)
    if (gdB !== gdA) return gdB - gdA

    if ((b.goals_for ?? 0) !== (a.goals_for ?? 0)) return (b.goals_for ?? 0) - (a.goals_for ?? 0)

    return String(a.team?.name ?? '').localeCompare(String(b.team?.name ?? ''))
  })
}

function formatGroupTitle(groupName: string) {
  const clean = String(groupName ?? '').trim()
  if (!clean) return 'Group A'
  return /^group\s+/i.test(clean) ? clean : `Group ${clean}`
}

function emptyRow(teamId: string, team: any, groupName?: string | null) {
  return {
    id: groupName ? `${groupName}-${teamId}` : teamId,
    team_id: teamId,
    group_name: groupName ?? null,
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
  }
}

function applyResult(homeRow: any, awayRow: any, homeScore: number, awayScore: number) {
  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const draw = homeScore === awayScore

  homeRow.played++
  awayRow.played++

  homeRow.wins += homeWin ? 1 : 0
  awayRow.wins += awayWin ? 1 : 0

  homeRow.draws += draw ? 1 : 0
  awayRow.draws += draw ? 1 : 0

  homeRow.losses += awayWin ? 1 : 0
  awayRow.losses += homeWin ? 1 : 0

  homeRow.goals_for += homeScore
  awayRow.goals_for += awayScore

  homeRow.goals_against += awayScore
  awayRow.goals_against += homeScore

  homeRow.points += homeWin ? 3 : draw ? 1 : 0
  awayRow.points += awayWin ? 3 : draw ? 1 : 0
}

function inferGroups(
  teamIds: string[],
  groupFixtures: FixtureRow[],
  participantGroupByTeam: Record<string, string>,
) {
  const parent: Record<string, string> = {}

  const find = (teamId: string): string => {
    if (!parent[teamId]) parent[teamId] = teamId
    if (parent[teamId] !== teamId) parent[teamId] = find(parent[teamId])
    return parent[teamId]
  }

  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (const teamId of teamIds) find(teamId)

  for (const fixture of groupFixtures) {
    if (fixture.home_team_id && fixture.away_team_id) union(fixture.home_team_id, fixture.away_team_id)
  }

  const teamsByRoot: Record<string, string[]> = {}
  for (const teamId of teamIds) {
    const root = find(teamId)
    if (!teamsByRoot[root]) teamsByRoot[root] = []
    teamsByRoot[root].push(teamId)
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const usedNames = new Set(Object.values(participantGroupByTeam))
  let nextAutoIndex = 0
  const groupByTeam: Record<string, string> = {}

  for (const teamIdsInComponent of Object.values(teamsByRoot)) {
    const knownGroupName = teamIdsInComponent
      .map((teamId) => participantGroupByTeam[teamId])
      .filter(Boolean)
      .sort()[0]

    let groupName = knownGroupName
    if (!groupName) {
      while (usedNames.has(alphabet[nextAutoIndex] ?? String(nextAutoIndex + 1))) nextAutoIndex++
      groupName = alphabet[nextAutoIndex] ?? String(nextAutoIndex + 1)
      usedNames.add(groupName)
      nextAutoIndex++
    }

    for (const teamId of teamIdsInComponent) groupByTeam[teamId] = groupName
  }

  return groupByTeam
}

async function fetchTeamsById(supabase: any, teamIds: string[]) {
  const uniqueTeamIds = Array.from(new Set(teamIds.filter(Boolean)))
  if (uniqueTeamIds.length === 0) return {}

  const { data } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .in('id', uniqueTeamIds)

  const teamsById: Record<string, any> = {}
  for (const team of data ?? []) teamsById[(team as any).id] = team
  return teamsById
}

async function buildLiveStandings(supabase: any, tournamentId: string, tournamentType: string) {
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('team_id, group_name')
    .eq('tournament_id', tournamentId)

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, status')
    .eq('tournament_id', tournamentId)

  const allFixtures = (fixtures ?? []) as FixtureRow[]
  const fixtureIds = allFixtures.map((fixture) => fixture.id).filter(Boolean)

  const { data: results } = fixtureIds.length > 0
    ? await supabase
        .from('results')
        .select('fixture_id, home_score, away_score, override_reason')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, ResultRow> = {}
  for (const result of results ?? []) resultsByFixture[(result as any).fixture_id] = result as ResultRow

  if (tournamentType === 'league') {
    const leagueFixtures = allFixtures.filter((fixture) => !fixture.round_type || fixture.round_type === 'league')
    const teamIds = Array.from(new Set([
      ...(participants ?? []).map((p: any) => p.team_id).filter(Boolean),
      ...leagueFixtures.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]).filter(Boolean),
    ])) as string[]

    const teamsById = await fetchTeamsById(supabase, teamIds)
    const rowsByTeam: Record<string, any> = {}
    const getRow = (teamId: string) => {
      if (!rowsByTeam[teamId]) rowsByTeam[teamId] = emptyRow(teamId, teamsById[teamId] ?? null)
      return rowsByTeam[teamId]
    }

    for (const teamId of teamIds) getRow(teamId)

    for (const fixture of leagueFixtures) {
      if (fixture.status !== 'confirmed') continue
      if (!fixture.home_team_id || !fixture.away_team_id) continue

      const result = resultsByFixture[fixture.id]
      if (!result) continue

      const homeScore = Number(result.home_score)
      const awayScore = Number(result.away_score)
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue

      const reason = String(result.override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      applyResult(getRow(fixture.home_team_id), getRow(fixture.away_team_id), homeScore, awayScore)
    }

    return {
      leagueStandings: sortStandingsRows(Object.values(rowsByTeam)),
      groupStandings: {},
    }
  }

  if (tournamentType === 'ucl' || tournamentType === 'europa') {
    const groupFixtures = allFixtures.filter((fixture) => fixture.round_type === 'group')
    const participantGroupByTeam: Record<string, string> = {}

    for (const participant of participants ?? []) {
      const teamId = (participant as any).team_id
      const groupName = cleanGroupName((participant as any).group_name)
      if (teamId && groupName) participantGroupByTeam[teamId] = groupName
    }

    const teamIds = Array.from(new Set([
      ...(participants ?? []).map((p: any) => p.team_id).filter(Boolean),
      ...groupFixtures.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]).filter(Boolean),
    ])) as string[]

    const teamsById = await fetchTeamsById(supabase, teamIds)
    const groupByTeam = inferGroups(teamIds, groupFixtures, participantGroupByTeam)
    const groupMap: Record<string, Record<string, any>> = {}

    const getGroupRow = (teamId: string, fallbackGroupName?: string | null) => {
      const groupName = groupByTeam[teamId] ?? participantGroupByTeam[teamId] ?? fallbackGroupName ?? 'A'
      if (!groupMap[groupName]) groupMap[groupName] = {}
      if (!groupMap[groupName][teamId]) groupMap[groupName][teamId] = emptyRow(teamId, teamsById[teamId] ?? null, groupName)
      return groupMap[groupName][teamId]
    }

    for (const teamId of teamIds) getGroupRow(teamId)

    for (const fixture of groupFixtures) {
      if (fixture.status !== 'confirmed') continue
      if (!fixture.home_team_id || !fixture.away_team_id) continue

      const result = resultsByFixture[fixture.id]
      if (!result) continue

      const homeScore = Number(result.home_score)
      const awayScore = Number(result.away_score)
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue

      const reason = String(result.override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeGroup = groupByTeam[fixture.home_team_id] ?? participantGroupByTeam[fixture.home_team_id]
      const awayGroup = groupByTeam[fixture.away_team_id] ?? participantGroupByTeam[fixture.away_team_id] ?? homeGroup

      applyResult(
        getGroupRow(fixture.home_team_id, homeGroup),
        getGroupRow(fixture.away_team_id, awayGroup),
        homeScore,
        awayScore,
      )
    }

    const groupStandings: Record<string, any[]> = {}
    for (const [groupName, rowsByTeam] of Object.entries(groupMap)) {
      groupStandings[groupName] = sortStandingsRows(Object.values(rowsByTeam))
    }

    return {
      leagueStandings: [],
      groupStandings,
    }
  }

  return { leagueStandings: [], groupStandings: {} }
}

function StandingsTable({ rows, mode }: { rows: any[]; mode: 'league' | 'group' }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[28px_1fr_30px_36px_40px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_42px_44px] items-center gap-1 sm:gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="hidden sm:block text-center">W</span>
        <span className="hidden sm:block text-center">D</span>
        <span className="hidden sm:block text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center text-[#c9a84c]">Pts</span>
      </div>

      {rows.map((row: any, index: number) => {
        const gd = goalDifference(row)
        const qualificationBorder = mode === 'league'
          ? index < 12 ? 'border-l-[#c9a84c]' : index < 20 ? 'border-l-blue-500' : 'border-l-transparent'
          : index < 2 ? 'border-l-[#c9a84c]' : 'border-l-transparent'

        return (
          <Link
            key={row.id ?? `${row.team_id}-${index}`}
            href={`/teams/${row.team_id}`}
            className={`grid grid-cols-[28px_1fr_30px_36px_40px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_42px_44px] items-center gap-1 sm:gap-2 px-3 py-2.5 text-xs border-l-4 ${qualificationBorder} ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-[#c9a84c]/10 transition-colors cursor-pointer`}
          >
            <span className="text-center font-bold text-slate-500">{index + 1}</span>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {row.team?.logo_league_folder && (
                <TeamLogo
                  leagueFolder={row.team.logo_league_folder}
                  teamSlug={row.team.logo_team_slug}
                  context="standings_row"
                  alt={row.team.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                />
              )}
              <span className="font-semibold text-slate-900 truncate">{row.team?.name ?? 'Unknown team'}</span>
              {mode === 'group' && index < 2 && (
                <span className="hidden sm:inline text-[9px] font-black text-[#c9a84c] border border-[#c9a84c]/30 rounded px-1 py-0.5">Q</span>
              )}
            </div>

            <span className="text-center text-slate-600">{row.played ?? 0}</span>
            <span className="hidden sm:block text-center text-slate-600">{row.wins ?? 0}</span>
            <span className="hidden sm:block text-center text-slate-600">{row.draws ?? 0}</span>
            <span className="hidden sm:block text-center text-slate-600">{row.losses ?? 0}</span>
            <span className={`text-center font-semibold ${gd >= 0 ? 'text-green-600' : 'text-red-500'}`}>{gd > 0 ? `+${gd}` : gd}</span>
            <span className="text-center font-black text-[#c9a84c]">{row.points ?? 0}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default async function StandingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const requestedTournament = selectedTournamentId
    ? tournaments?.find((t) => t.id === selectedTournamentId)
    : null

  const activeTournamentId = requestedTournament?.id ?? tournaments?.[0]?.id ?? null
  const activeTournament = tournaments?.find((t) => t.id === activeTournamentId)

  let leagueStandings: any[] = []
  const groupStandings: Record<string, any[]> = {}

  if (activeTournamentId && activeTournament?.type === 'league') {
    const { data } = await supabase
      .from('standings')
      .select('id, tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points')
      .eq('tournament_id', activeTournamentId)

    const rows = data ?? []
    const teamsById = await fetchTeamsById(supabase, rows.map((row: any) => row.team_id))

    leagueStandings = sortStandingsRows(rows.map((row: any) => ({ ...row, team: teamsById[row.team_id] ?? null })))
  }

  if (activeTournamentId && (activeTournament?.type === 'ucl' || activeTournament?.type === 'europa')) {
    const { data } = await supabase
      .from('group_standings')
      .select('id, tournament_id, group_name, team_id, played, wins, draws, losses, goals_for, goals_against, points')
      .eq('tournament_id', activeTournamentId)

    const rows = data ?? []
    const teamsById = await fetchTeamsById(supabase, rows.map((row: any) => row.team_id))

    for (const row of rows) {
      const groupName = cleanGroupName((row as any).group_name) ?? 'A'
      if (!groupStandings[groupName]) groupStandings[groupName] = []
      groupStandings[groupName].push({ ...row, group_name: groupName, team: teamsById[(row as any).team_id] ?? null })
    }

    for (const groupName of Object.keys(groupStandings)) {
      groupStandings[groupName] = sortStandingsRows(groupStandings[groupName])
    }
  }

  // Fallback only for display. The admin route still writes to standings/group_standings.
  // This prevents the public standings page from going blank if the table has not refreshed yet.
  const needsFallback = activeTournamentId && activeTournament && (
    (activeTournament.type === 'league' && leagueStandings.length === 0) ||
    ((activeTournament.type === 'ucl' || activeTournament.type === 'europa') && Object.keys(groupStandings).length === 0)
  )

  if (needsFallback) {
    const fallback = await buildLiveStandings(supabase, activeTournamentId, activeTournament.type)
    leagueStandings = fallback.leagueStandings

    for (const [groupName, rows] of Object.entries(fallback.groupStandings)) {
      groupStandings[groupName] = rows
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Standings</h1>
        {activeTournament && <p className="text-sm text-[#c9a84c] mt-0.5">{activeTournament.name}</p>}
      </div>

      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  isActive
                    ? 'bg-[#c9a84c] text-[#0a1128] border-[#c9a84c]'
                    : 'bg-transparent text-slate-400 border-slate-200 hover:border-[#c9a84c]/50 hover:text-[#c9a84c]'
                }`}
              >
                {TOURNAMENT_TYPE_LABELS[t.type] ?? t.name}
              </Link>
            )
          })}
        </div>
      )}

      {!activeTournamentId ? (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No active tournaments.</p>
        </div>
      ) : activeTournament?.type === 'league' ? (
        <div className="card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">League Standings</h2>
          </div>

          {leagueStandings.length > 0 ? (
            <>
              <StandingsTable rows={leagueStandings} mode="league" />
              <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c9a84c]" />UCL places</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Europa places</span>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No teams found for this tournament.</div>
          )}
        </div>
      ) : activeTournament?.type === 'ucl' || activeTournament?.type === 'europa' ? (
        <div className="card p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Group Standings</h2>
          </div>

          {Object.keys(groupStandings).length > 0 ? (
            <>
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#c9a84c]">{formatGroupTitle(groupName)}</h3>
                    <StandingsTable rows={rows} mode="group" />
                  </div>
                ))}

              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#c9a84c]" />
                Top 2 qualify
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No teams found for this tournament.</div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-slate-500 text-sm">No standings available for this tournament type.</p>
        </div>
      )}
    </div>
  )
}
