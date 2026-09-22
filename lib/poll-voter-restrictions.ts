// Poll voter restrictions helper
//
// voter_restrictions JSONB on polls maps user_id -> [league_folder, ...].
// This module builds that map from a tournament's participants by ranking them
// on group-stage performance (points, goal difference, goals scored) then
// assigning league folders per placement band.

export const SA_PREMIERSHIP_FOLDER = 'south-african-premiership-2026-2027.football-logos.cc'
export const SA_MOTSEPE_FOLDER = 'motsepe-foundation-championship-2026-2027.football-logos.cc'
export const SA_ABC_FOLDER = 'abc-motsepe-league-2026-2027.football-logos.cc'

export interface VoterRestrictions {
  [user_id: string]: string[]
}

interface RankedManager {
  user_id: string
  points: number
  goal_difference: number
  goals_for: number
}

// Rank all participants of a tournament on combined group-stage table:
// points desc, then goal difference desc, then goals for desc.
export async function rankTournamentManagers(
  db: any,
  tournament_id: string
): Promise<RankedManager[]> {
  const { data: standings, error } = await db
    .from('group_standings' as any)
    .select('team_id, points, goal_difference, goals_for')
    .eq('tournament_id', tournament_id)

  if (error) throw new Error(error.message)

  const { data: participants } = await db
    .from('tournament_participants' as any)
    .select('team_id, user_id')
    .eq('tournament_id', tournament_id)

  const userByTeam = new Map<string, string>()
  for (const p of participants ?? []) {
    userByTeam.set(p.team_id, p.user_id)
  }

  const ranked = (standings ?? [])
    .filter((s: any) => userByTeam.has(s.team_id))
    .map((s: any) => ({
      user_id: userByTeam.get(s.team_id)!,
      points: s.points ?? 0,
      goal_difference: s.goal_difference ?? 0,
      goals_for: s.goals_for ?? 0,
    }))
    .sort(
      (a: RankedManager, b: RankedManager) =>
        b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for
    )

  return ranked
}

// Build a voter_restrictions map: managers ranked in the top `psl_count` can
// pick from the first league; the rest pick from the remaining leagues.
export function buildPlacementRestrictions(
  ranked: RankedManager[],
  options: {
    psl_count: number
    top_leagues: string[]
    bottom_leagues: string[]
  }
): VoterRestrictions {
  const restrictions: VoterRestrictions = {}
  ranked.forEach((m, idx) => {
    restrictions[m.user_id] = idx < options.psl_count ? options.top_leagues : options.bottom_leagues
  })
  return restrictions
}

// Split a list of user ids from a restricted poll into the two league divisions:
// anyone allowed the Premiership folder is Division 1, everyone else with a
// restriction is Division 2. Returns { d1, d2 }.
export function splitRestrictedUsersByDivision(
  restrictions: VoterRestrictions | null,
  userIds: string[]
): { d1: string[]; d2: string[] } {
  const d1: string[] = []
  const d2: string[] = []
  if (!restrictions) return { d1: userIds, d2: [] }
  for (const id of userIds) {
    const folders = restrictions[id]
    if (folders && folders.includes(SA_PREMIERSHIP_FOLDER)) d1.push(id)
    else if (folders && folders.length > 0) d2.push(id)
  }
  return { d1, d2 }
}