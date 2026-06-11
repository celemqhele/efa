import type { SupabaseClient } from '@supabase/supabase-js'

export type StandingsRow = {
  id: string
  team_id: string
  group_name: string | null
  team: {
    id: string
    name: string
    logo_league_folder: string | null
    logo_team_slug: string | null
  } | null
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  points: number
  absent: number
  gd_penalty: number
}

export function goalDifference(row: any): number {
  return (row.goals_for ?? 0) - (row.goals_against ?? 0) + (row.gd_penalty ?? 0)
}

export function sortStandingsRows(rows: any[]) {
  return [...rows].sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    const gdA = goalDifference(a)
    const gdB = goalDifference(b)
    if (gdB !== gdA) return gdB - gdA
    if ((b.goals_for ?? 0) !== (a.goals_for ?? 0)) return (b.goals_for ?? 0) - (a.goals_for ?? 0)
    return String(a.team?.name ?? '').localeCompare(String(b.team?.name ?? ''))
  })
}

export function emptyStandingsRow(teamId: string, team: any, groupName?: string | null): StandingsRow {
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
    absent: 0,
    gd_penalty: 0,
  }
}

export function applyResultToRow(
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

  if (homeForfeit && awayForfeit) {
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
    return
  }

  if (isDoubleForfeit) {
    homeRow.absent++
    awayRow.absent++
    homeRow.gd_penalty -= 3
    awayRow.gd_penalty -= 3
    return
  }

  if (homeAbsent) {
    awayRow.wins++
    awayRow.goals_for += 3
    awayRow.points += 3
    homeRow.absent++
    homeRow.gd_penalty -= 3
    return
  }

  if (awayAbsent) {
    homeRow.wins++
    homeRow.goals_for += 3
    homeRow.points += 3
    awayRow.absent++
    awayRow.gd_penalty -= 3
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
}

export async function buildLiveStandings(supabase: SupabaseClient, tournamentId: string, tournamentType: string) {
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('team_id, group_name, team:teams(id, name, logo_league_folder, logo_team_slug)')
    .eq('tournament_id', tournamentId)

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, status, results(home_score, away_score, override_reason, is_abandoned, abandoned_type)')
    .eq('tournament_id', tournamentId)

  if (tournamentType === 'league') {
    const rowsByTeam: Record<string, any> = {}
    const getRow = (teamId: string, teamData?: any) => {
      if (!rowsByTeam[teamId]) rowsByTeam[teamId] = emptyStandingsRow(teamId, teamData)
      return rowsByTeam[teamId]
    }

    participants?.forEach(p => getRow(p.team_id, p.team))

    fixtures?.forEach(f => {
      if (f.status !== 'confirmed') return
      const res = Array.isArray(f.results) ? f.results[0] : f.results
      if (!res) return

      const reason = String(res.override_reason ?? '').toLowerCase()
      const isBothAbsent = reason.includes('both') && reason.includes('absent')
      const isAbsent = reason.includes('absent') && !isBothAbsent
      const homeForfeit = res.is_abandoned === true && (res.abandoned_type === 'home' || res.abandoned_type === 'both')
      const awayForfeit = res.is_abandoned === true && (res.abandoned_type === 'away' || res.abandoned_type === 'both')
      const bothForfeit = res.is_abandoned === true && res.abandoned_type === 'both'
      const homeAbsent = isAbsent && (res.home_score === 0 && res.away_score === 3) && !homeForfeit
      const awayAbsent = isAbsent && (res.home_score === 3 && res.away_score === 0) && !awayForfeit

      const effectiveHomeScore = bothForfeit ? 0 : (res.home_score ?? 0)
      const effectiveAwayScore = bothForfeit ? 0 : (res.away_score ?? 0)

      const hr = getRow(f.home_team_id!)
      const ar = getRow(f.away_team_id!)
      if (hr && ar) applyResultToRow(hr, ar, effectiveHomeScore, effectiveAwayScore, isBothAbsent, homeAbsent, awayAbsent, homeForfeit, awayForfeit)
    })

    return {
      leagueStandings: sortStandingsRows(Object.values(rowsByTeam)),
      groupStandings: {},
    }
  }

  // Group tournaments (UCL, Europa)
  const groupMap: Record<string, Record<string, any>> = {}
  const getGroupRow = (teamId: string, groupName: string, teamData?: any) => {
    if (!groupMap[groupName]) groupMap[groupName] = {}
    if (!groupMap[groupName][teamId]) groupMap[groupName][teamId] = emptyStandingsRow(teamId, teamData, groupName)
    return groupMap[groupName][teamId]
  }

  const teamGroupMap: Record<string, string> = {}
  participants?.forEach(p => {
    const gn = (p.group_name || 'A').replace(/^group\s+/i, '').trim()
    teamGroupMap[p.team_id] = gn
    getGroupRow(p.team_id, gn, p.team)
  })

  fixtures?.forEach(f => {
    if (f.status !== 'confirmed' || f.round_type !== 'group') return
    const res = Array.isArray(f.results) ? f.results[0] : f.results
    if (!res) return

      const reason = String(res.override_reason ?? '').toLowerCase()
      const isBothAbsent = reason.includes('both') && reason.includes('absent')
      const isAbsent = reason.includes('absent') && !isBothAbsent
      const homeForfeit = res.is_abandoned === true && (res.abandoned_type === 'home' || res.abandoned_type === 'both')
      const awayForfeit = res.is_abandoned === true && (res.abandoned_type === 'away' || res.abandoned_type === 'both')
      const bothForfeit = res.is_abandoned === true && res.abandoned_type === 'both'
      const homeAbsent = isAbsent && (res.home_score === 0 && res.away_score === 3) && !homeForfeit
      const awayAbsent = isAbsent && (res.home_score === 3 && res.away_score === 0) && !awayForfeit

      const effectiveHomeScore = bothForfeit ? 0 : (res.home_score ?? 0)
      const effectiveAwayScore = bothForfeit ? 0 : (res.away_score ?? 0)

      const hgn = teamGroupMap[f.home_team_id!] || 'A'
      const agn = teamGroupMap[f.away_team_id!] || hgn
      
      const hr = getGroupRow(f.home_team_id!, hgn)
      const ar = getGroupRow(f.away_team_id!, agn)
      if (hr && ar) applyResultToRow(hr, ar, effectiveHomeScore, effectiveAwayScore, isBothAbsent, homeAbsent, awayAbsent, homeForfeit, awayForfeit)
  })

  const groupStandings: Record<string, any[]> = {}
  for (const [gn, rows] of Object.entries(groupMap)) {
    groupStandings[gn] = sortStandingsRows(Object.values(rows))
  }

  return {
    leagueStandings: [],
    groupStandings,
  }
}
