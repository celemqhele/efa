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

// ─── League standings zones ──────────────────────────────────────────────────
// Counts live in the tournament's `settings.standings_zones` so the UI is
// data-driven per division:
//   Division 1 -> { bottom_yellow: 2, bottom_red: 3 }   (12/13 yellow, 14-16 red)
//   Division 2 -> { top_green: 3, top_yellow: 2 }        (1-3 green, 4/5 yellow)
// A tournament without zones renders neutral rows (no special borders).

export type StandingsZones = {
  top_green?: number
  top_yellow?: number
  bottom_yellow?: number
  bottom_red?: number
}

export type ZoneKind = 'top_green' | 'top_yellow' | 'bottom_yellow' | 'bottom_red' | null

export function normalizeStandingsZones(settings: any): StandingsZones | null {
  const zones = settings?.standings_zones
  if (!zones || typeof zones !== 'object') return null
  const out: StandingsZones = {}
  if (Number.isFinite(zones.top_green)) out.top_green = Math.max(0, Math.floor(zones.top_green))
  if (Number.isFinite(zones.top_yellow)) out.top_yellow = Math.max(0, Math.floor(zones.top_yellow))
  if (Number.isFinite(zones.bottom_yellow)) out.bottom_yellow = Math.max(0, Math.floor(zones.bottom_yellow))
  if (Number.isFinite(zones.bottom_red)) out.bottom_red = Math.max(0, Math.floor(zones.bottom_red))
  return out
}

export function rowZone(zones: StandingsZones | null | undefined, index: number, total: number): ZoneKind {
  if (!zones || total <= 0 || index < 0 || index >= total) return null
  const topGreen = zones.top_green ?? 0
  const topYellow = zones.top_yellow ?? 0
  const bottomYellow = zones.bottom_yellow ?? 0
  const bottomRed = zones.bottom_red ?? 0

  if (topGreen > 0 && index < topGreen) return 'top_green'
  if (topYellow > 0 && index < topGreen + topYellow) return 'top_yellow'
  if (bottomRed > 0 && index >= total - bottomRed) return 'bottom_red'
  if (bottomYellow > 0 && index >= total - bottomRed - bottomYellow) return 'bottom_yellow'
  return null
}

export const ZONE_BORDER_CLASS: Record<NonNullable<ZoneKind>, string> = {
  top_green: 'border-l-emerald-500',
  top_yellow: 'border-l-yellow-400',
  bottom_yellow: 'border-l-yellow-400',
  bottom_red: 'border-l-red-500',
}

export function zoneLegend(zones: StandingsZones | null | undefined): { color: 'green' | 'yellow' | 'red'; label: string }[] {
  if (!zones) return []
  const items: { color: 'green' | 'yellow' | 'red'; label: string }[] = []
  if ((zones.top_green ?? 0) > 0) items.push({ color: 'green', label: 'Promotion' })
  if ((zones.top_yellow ?? 0) > 0) items.push({ color: 'yellow', label: 'Promotion playoff' })
  if ((zones.bottom_yellow ?? 0) > 0) items.push({ color: 'yellow', label: 'Relegation playoff' })
  if ((zones.bottom_red ?? 0) > 0) items.push({ color: 'red', label: 'Relegation' })
  return items
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
    .select('id, team_id, group_name, team:teams(id, name, logo_league_folder, logo_team_slug)')
    .eq('tournament_id', tournamentId)

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, home_participant_id, away_participant_id, round_type, status, results(home_score, away_score, override_reason, is_abandoned, abandoned_type)')
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
  const participantById: Record<string, any> = {}
  participants?.forEach(p => {
    const gn = (p.group_name || 'A').replace(/^group\s+/i, '').trim()
    if (p.id) participantById[p.id] = p
    teamGroupMap[p.team_id] = gn
    getGroupRow(p.team_id, gn, p.team)
  })

  // Resolve a fixture side to the participant row it belongs to. A side may
  // reference a team that is no longer a participant (e.g. the seat was
  // vacated and the team copy went stale); fall back to the seat's current
  // club so results always land on the slot's active row instead of a
  // fabricated "unknown" team. Returns null when the side is genuinely
  // unplaceable (never part of the tournament).
  const resolveSide = (teamId: string | null, participantId: string | null) => {
    if (teamId && teamGroupMap[teamId]) return { teamId, group: teamGroupMap[teamId], teamData: undefined }
    const part = participantId ? participantById[participantId] : null
    if (part?.team_id && teamGroupMap[part.team_id]) {
      return { teamId: part.team_id, group: teamGroupMap[part.team_id], teamData: part.team }
    }
    return null
  }

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

      const home = resolveSide(f.home_team_id, f.home_participant_id)
      const away = resolveSide(f.away_team_id, f.away_participant_id)
      if (!home || !away) return

      const hr = getGroupRow(home.teamId, home.group, home.teamData)
      const ar = getGroupRow(away.teamId, away.group, away.teamData)
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
