import { createAdminClient } from '@/lib/supabase/server'

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
  is_abandoned?: boolean
  abandoned_type?: string | null
}

function cleanGroupName(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.replace(/^group\s+/i, '').trim() || null
}

function emptyStandingRow(tournamentId: string, teamId: string) {
  return {
    tournament_id: tournamentId,
    team_id: teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
    form: '',
    unbeaten_run: 0,
    clean_sheets: 0,
    absent: 0,
    gd_penalty: 0,
  }
}

function emptyGroupStandingRow(tournamentId: string, groupName: string, teamId: string) {
  return {
    tournament_id: tournamentId,
    group_name: groupName,
    team_id: teamId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points: 0,
    form: '',
    absent: 0,
    gd_penalty: 0,
  }
}

function applyResult(
  homeRow: any, awayRow: any,
  homeScore: number, awayScore: number,
  isDoubleForfeit: boolean = false,
  homeAbsent: boolean = false,
  awayAbsent: boolean = false,
  homeForfeit: boolean = false,
  awayForfeit: boolean = false,
) {
  homeRow.played++
  awayRow.played++

  // Forfeit (mid-game quit): actual scores GF/GA count, forfeiting team gets L + absent++ -3GD
  if (homeForfeit && awayForfeit) {
    // Both forfeited: no goals counted
    homeRow.absent++
    awayRow.absent++
    homeRow.gd_penalty -= 3
    awayRow.gd_penalty -= 3
    return
  }

  if (homeForfeit) {
    homeRow.losses++
    awayRow.wins++
    homeRow.goals_for += homeScore
    homeRow.goals_against += awayScore
    awayRow.goals_for += awayScore
    awayRow.goals_against += homeScore
    awayRow.points += 3
    homeRow.absent++
    homeRow.gd_penalty -= 3
    if ('form' in awayRow) awayRow.form = (awayRow.form + 'W').slice(-5)
    if ('form' in homeRow) homeRow.form = (homeRow.form + 'L').slice(-5)
    if ('unbeaten_run' in awayRow) awayRow.unbeaten_run++
    if ('unbeaten_run' in homeRow) homeRow.unbeaten_run = 0
    if ('clean_sheets' in awayRow) awayRow.clean_sheets += homeScore === 0 ? 1 : 0
    return
  }

  if (awayForfeit) {
    homeRow.wins++
    awayRow.losses++
    homeRow.goals_for += homeScore
    homeRow.goals_against += awayScore
    awayRow.goals_for += awayScore
    awayRow.goals_against += homeScore
    homeRow.points += 3
    awayRow.absent++
    awayRow.gd_penalty -= 3
    if ('form' in homeRow) homeRow.form = (homeRow.form + 'W').slice(-5)
    if ('form' in awayRow) awayRow.form = (awayRow.form + 'L').slice(-5)
    if ('unbeaten_run' in homeRow) homeRow.unbeaten_run++
    if ('unbeaten_run' in awayRow) awayRow.unbeaten_run = 0
    if ('clean_sheets' in homeRow) homeRow.clean_sheets += awayScore === 0 ? 1 : 0
    return
  }

  if (isDoubleForfeit) {
    // 0 points, 0 goals, but counts as played
    if ('absent' in homeRow) homeRow.absent++
    if ('absent' in awayRow) awayRow.absent++
    if ('gd_penalty' in homeRow) homeRow.gd_penalty -= 3
    if ('gd_penalty' in awayRow) awayRow.gd_penalty -= 3
    return
  }

  if (homeAbsent) {
    // Home absent: away wins 3-0, home gets absent++ and -3GD
    awayRow.wins++
    awayRow.goals_for += 3
    awayRow.points += 3
    if ('form' in awayRow) awayRow.form = (awayRow.form + 'W').slice(-5)
    if ('unbeaten_run' in awayRow) awayRow.unbeaten_run++
    if ('clean_sheets' in awayRow) awayRow.clean_sheets++
    if ('absent' in homeRow) homeRow.absent++
    if ('gd_penalty' in homeRow) homeRow.gd_penalty -= 3
    return
  }

  if (awayAbsent) {
    // Away absent: home wins 3-0, away gets absent++ and -3GD
    homeRow.wins++
    homeRow.goals_for += 3
    homeRow.points += 3
    if ('form' in homeRow) homeRow.form = (homeRow.form + 'W').slice(-5)
    if ('unbeaten_run' in homeRow) homeRow.unbeaten_run++
    if ('clean_sheets' in homeRow) homeRow.clean_sheets++
    if ('absent' in awayRow) awayRow.absent++
    if ('gd_penalty' in awayRow) awayRow.gd_penalty -= 3
    return
  }

  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const draw = homeScore === awayScore

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

  if ('form' in homeRow) homeRow.form = (homeRow.form + (homeWin ? 'W' : draw ? 'D' : 'L')).slice(-5)
  if ('form' in awayRow) awayRow.form = (awayRow.form + (awayWin ? 'W' : draw ? 'D' : 'L')).slice(-5)

  if ('unbeaten_run' in homeRow) homeRow.unbeaten_run = homeWin || draw ? homeRow.unbeaten_run + 1 : 0
  if ('unbeaten_run' in awayRow) awayRow.unbeaten_run = awayWin || draw ? awayRow.unbeaten_run + 1 : 0

  if ('clean_sheets' in homeRow) homeRow.clean_sheets += awayScore === 0 ? 1 : 0
  if ('clean_sheets' in awayRow) awayRow.clean_sheets += homeScore === 0 ? 1 : 0
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
    if (fixture.home_team_id && fixture.away_team_id) {
      union(fixture.home_team_id, fixture.away_team_id)
    }
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
      while (usedNames.has(alphabet[nextAutoIndex] ?? String(nextAutoIndex + 1))) {
        nextAutoIndex++
      }
      groupName = alphabet[nextAutoIndex] ?? String(nextAutoIndex + 1)
      usedNames.add(groupName)
      nextAutoIndex++
    }

    for (const teamId of teamIdsInComponent) {
      groupByTeam[teamId] = groupName
    }
  }

  return groupByTeam
}

export async function recalculateStandings(tournamentId: string) {
  const db = await createAdminClient()

  const { data: tournament, error: tournamentErr } = await db
    .from('tournaments')
    .select('type, settings')
    .eq('id', tournamentId)
    .single()

  if (tournamentErr) throw new Error(tournamentErr.message)

  const tournamentType = (tournament as any)?.type ?? 'league'
  const settings = (tournament as any)?.settings as any
  const isGroupBased = !!(settings?.num_groups && settings.num_groups > 0)

  const { data: participants, error: participantsErr } = await db
    .from('tournament_participants')
    .select('team_id, group_name')
    .eq('tournament_id', tournamentId)

  if (participantsErr) throw new Error(participantsErr.message)

  const { data: fixtures, error: fixturesErr } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, status')
    .eq('tournament_id', tournamentId)

  if (fixturesErr) throw new Error(fixturesErr.message)

  const allFixtures = (fixtures ?? []) as FixtureRow[]
  const fixtureIds = allFixtures.map((fixture) => fixture.id).filter(Boolean)

  const { data: results, error: resultsErr } = fixtureIds.length > 0
    ? await db
        .from('results')
        .select('fixture_id, home_score, away_score, override_reason, is_abandoned, abandoned_type')
        .in('fixture_id', fixtureIds)
    : { data: [], error: null }

  if (resultsErr) throw new Error(resultsErr.message)

  const resultsByFixture: Record<string, ResultRow> = {}
  for (const result of results ?? []) {
    resultsByFixture[(result as any).fixture_id] = result as ResultRow
  }

  let standingsRowsWritten = 0
  let groupRowsWritten = 0

  if (!isGroupBased) {
    // League logic (Standard League or Custom without groups)
    const leagueFixtures = allFixtures.filter(f => f.round_type === 'league' || !f.round_type)
    const teamIds = Array.from(new Set([
      ...(participants ?? []).map((p: any) => p.team_id).filter(Boolean),
      ...leagueFixtures.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]).filter(Boolean),
    ])) as string[]

    const standingsByTeam: Record<string, any> = {}
    const getRow = (teamId: string) => {
      if (!standingsByTeam[teamId]) standingsByTeam[teamId] = emptyStandingRow(tournamentId, teamId)
      return standingsByTeam[teamId]
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
      const isDoubleForfeit = reason.includes('both') && reason.includes('absent')
      const isAbsent = reason.includes('absent') && !isDoubleForfeit
      const homeForfeit = result.is_abandoned === true && result.abandoned_type === 'home'
      const awayForfeit = result.is_abandoned === true && result.abandoned_type === 'away'
      const bothForfeit = result.is_abandoned === true && result.abandoned_type === 'both'

      const homeAbsent = isAbsent && (homeScore === 0 && awayScore === 3) && !homeForfeit && !bothForfeit
      const awayAbsent = isAbsent && (homeScore === 3 && awayScore === 0) && !awayForfeit && !bothForfeit

      const effectiveHomeScore = bothForfeit ? 0 : homeScore
      const effectiveAwayScore = bothForfeit ? 0 : awayScore

      applyResult(getRow(fixture.home_team_id), getRow(fixture.away_team_id), effectiveHomeScore, effectiveAwayScore, isDoubleForfeit, homeAbsent, awayAbsent, homeForfeit, awayForfeit || bothForfeit)
    }

    const { error: deleteErr } = await db.from('standings').delete().eq('tournament_id', tournamentId)
    if (deleteErr) throw new Error(deleteErr.message)

    const rows = Object.values(standingsByTeam)
    if (rows.length > 0) {
      const { error: insertErr } = await db.from('standings').insert(rows)
      if (insertErr) throw new Error(insertErr.message)
      standingsRowsWritten = rows.length
    }
  } else {
    // Group logic (UCL, Europa, or Custom with groups)
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

    const groupByTeam = inferGroups(teamIds, groupFixtures, participantGroupByTeam)
    const groupStandingsByKey: Record<string, any> = {}

    const getGroupRow = (teamId: string, fallbackGroupName?: string | null) => {
      const groupName = groupByTeam[teamId] ?? participantGroupByTeam[teamId] ?? fallbackGroupName ?? 'A'
      const key = `${groupName}:${teamId}`
      if (!groupStandingsByKey[key]) {
        groupStandingsByKey[key] = emptyGroupStandingRow(tournamentId, groupName, teamId)
      }
      return groupStandingsByKey[key]
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
      const isDoubleForfeit = reason.includes('both') && reason.includes('absent')
      const isAbsent = reason.includes('absent') && !isDoubleForfeit
      const homeForfeit = result.is_abandoned === true && result.abandoned_type === 'home'
      const awayForfeit = result.is_abandoned === true && result.abandoned_type === 'away'
      const bothForfeit = result.is_abandoned === true && result.abandoned_type === 'both'

      const homeAbsent = isAbsent && (homeScore === 0 && awayScore === 3) && !homeForfeit && !bothForfeit
      const awayAbsent = isAbsent && (homeScore === 3 && awayScore === 0) && !awayForfeit && !bothForfeit

      const effectiveHomeScore = bothForfeit ? 0 : homeScore
      const effectiveAwayScore = bothForfeit ? 0 : awayScore

      const homeGroup = groupByTeam[fixture.home_team_id] ?? participantGroupByTeam[fixture.home_team_id]
      const awayGroup = groupByTeam[fixture.away_team_id] ?? participantGroupByTeam[fixture.away_team_id] ?? homeGroup

      applyResult(
        getGroupRow(fixture.home_team_id, homeGroup),
        getGroupRow(fixture.away_team_id, awayGroup),
        effectiveHomeScore,
        effectiveAwayScore,
        isDoubleForfeit,
        homeAbsent,
        awayAbsent,
        homeForfeit,
        awayForfeit || bothForfeit
      )
    }

    const { error: deleteErr } = await db.from('group_standings').delete().eq('tournament_id', tournamentId)
    if (deleteErr) throw new Error(deleteErr.message)

    const rows = Object.values(groupStandingsByKey)
    if (rows.length > 0) {
      const { error: insertErr } = await db.from('group_standings').insert(rows)
      if (insertErr) throw new Error(insertErr.message)
      groupRowsWritten = rows.length
    }
  }

  return {
    tournamentType,
    standingsRowsWritten,
    groupRowsWritten,
    fixturesProcessed: allFixtures.length,
    participantsProcessed: (participants ?? []).length,
  }
}
