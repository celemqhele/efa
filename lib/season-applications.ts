type ClientLike = any

export type OpenSeason = {
  season_id: string
  season_name: string
  tournament_id: string
  tournament_name: string
  tournament_type: string
  vacant_seats: number
}

// Seasons (status active) that still have at least one vacant seat anywhere in
// their active tournaments. One entry per (season, tournament) so the UI can
// show where the seat is.
export async function listOpenSeasons(db: ClientLike): Promise<OpenSeason[]> {
  const { data: tournaments } = await db
    .from('tournaments')
    .select('id, name, type, season_id, season:season_id(id, name, status)')
    .eq('status', 'active')

  const active = (tournaments ?? []).filter((t: any) => {
    const season = Array.isArray(t.season) ? t.season[0] : t.season
    return season?.status === 'active'
  })

  if (active.length === 0) return []

  const { data: vacant } = await db
    .from('tournament_participants')
    .select('tournament_id')
    .is('user_id', null)
    .in('tournament_id', active.map((t: any) => t.id as string))

  const counts = new Map<string, number>()
  for (const row of vacant ?? []) {
    counts.set(row.tournament_id, (counts.get(row.tournament_id) ?? 0) + 1)
  }

  const result: OpenSeason[] = []
  for (const t of active) {
    const vacant_seats = counts.get(t.id) ?? 0
    if (vacant_seats === 0) continue
    const season = Array.isArray(t.season) ? t.season[0] : t.season
    result.push({
      season_id: t.season_id,
      season_name: season?.name ?? 'Season',
      tournament_id: t.id,
      tournament_name: t.name,
      tournament_type: t.type,
      vacant_seats,
    })
  }

  // Group seats across the season's tournaments into one row
  const bySeason = new Map<string, OpenSeason & { tournaments: string[] }>()
  for (const row of result) {
    const existing = bySeason.get(row.season_id)
    if (existing) {
      existing.vacant_seats += row.vacant_seats
      existing.tournaments.push(row.tournament_id)
    } else {
      bySeason.set(row.season_id, {
        ...row,
        vacant_seats: row.vacant_seats,
        tournaments: [row.tournament_id],
      })
    }
  }

  return Array.from(bySeason.values()).sort((a, b) => a.season_name.localeCompare(b.season_name))
}

export type PickableTeam = {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

// Clubs the applicant may choose: any unmanaged club that already has a seat in
// the season (its league/slug appears among the season's participants). Mixed
// competitions therefore offer the full catalog; single-league cups only their
// own league's unmanaged clubs.
export async function getSeasonPickableTeams(db: ClientLike, seasonId: string): Promise<PickableTeam[]> {
  const { data: tours } = await db
    .from('tournaments')
    .select('id')
    .eq('season_id', seasonId)
    .eq('status', 'active')

  const tourIds = (tours ?? []).map((t: any) => t.id as string)
  if (tourIds.length === 0) return []

  const { data: participantTeams } = await db
    .from('tournament_participants')
    .select('team:team_id(logo_league_folder, logo_team_slug)')
    .in('tournament_id', tourIds)

  const clubKeys = new Set<string>()
  for (const row of participantTeams ?? []) {
    const team = Array.isArray(row.team) ? row.team[0] : row.team
    if (team?.logo_league_folder && team?.logo_team_slug) {
      clubKeys.add(`${team.logo_league_folder}::${team.logo_team_slug}`)
    }
  }

  const { data: allTeams } = await db
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  return (allTeams ?? []).filter((t: any) =>
    t.manager_id === null &&
    clubKeys.has(`${t.logo_league_folder}::${t.logo_team_slug}`)
  )
}

// True when the user already occupies a seat anywhere in the season (so they
// can't apply for a second seat / start takeover racing).
export async function userInSeason(db: ClientLike, seasonId: string, userId: string): Promise<boolean> {
  const { data: tours } = await db
    .from('tournaments')
    .select('id')
    .eq('season_id', seasonId)
    .eq('status', 'active')

  const tourIds = (tours ?? []).map((t: any) => t.id as string)
  if (tourIds.length === 0) return false

  const { data: owned } = await db
    .from('tournament_participants')
    .select('id')
    .eq('user_id', userId)
    .in('tournament_id', tourIds)
    .limit(1)

  return (owned ?? []).length > 0
}