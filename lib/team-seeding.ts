export interface ManagerRecord {
  manager_id: string
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
}

export interface TeamRecord {
  team_id: string
  played: number
  wins: number
  points: number
  goals_for: number
  goals_against: number
}

export async function computeSeedRanks(
  db: (table: string) => any,
  teamIds: string[]
): Promise<Map<string, number>> {
  const { data: rows } = await db('standings')
    .select('team_id, played, wins, points, goals_for, goals_against')
    .in('team_id', teamIds)

  const totals = new Map<string, TeamRecord>()
  for (const row of rows ?? []) {
    const existing = totals.get(row.team_id) ?? { team_id: row.team_id, played: 0, wins: 0, points: 0, goals_for: 0, goals_against: 0 }
    existing.played += row.played ?? 0
    existing.wins += row.wins ?? 0
    existing.points += row.points ?? 0
    existing.goals_for += row.goals_for ?? 0
    existing.goals_against += row.goals_against ?? 0
    totals.set(row.team_id, existing)
  }

  const scored = [...totals.values()].map((t) => ({
    ...t,
    ppg: t.played > 0 ? t.points / t.played : -1,
    goal_difference: t.goals_for - t.goals_against,
  }))

  const ranked = scored
    .filter((t) => t.ppg >= 0)
    .sort((a, b) => {
      if (b.ppg !== a.ppg) return b.ppg - a.ppg
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      return b.goals_for - a.goals_for
    })

  const seedRanks = new Map<string, number>()
  ranked.forEach((t, idx) => seedRanks.set(t.team_id, idx + 1))

  let rank = ranked.length + 1
  for (const id of teamIds) {
    if (!seedRanks.has(id)) seedRanks.set(id, rank++)
  }

  return seedRanks
}

// Career seeding by manager: aggregates every tenure recorded in manager_tenures
// (whose wins/draws/losses/GF/GA are auto-updated by the results trigger in
// supabase/migrations/010_auto_manager_stats.sql), scores career PPG =
// (3*wins + draws) / played, and ranks PPG desc -> wins desc -> GD desc -> GF desc.
// Managers with no completed tenure are ranked after every scored manager.
export async function computeManagerSeedRanks(
  db: (table: string) => any,
  managerIds: string[]
): Promise<Map<string, number>> {
  const { data: rows } = await db('manager_tenures')
    .select('manager_id, wins, draws, losses, goals_for, goals_against')
    .in('manager_id', managerIds)

  const totals = new Map<string, ManagerRecord>()
  for (const row of rows ?? []) {
    const existing = totals.get(row.manager_id) ?? {
      manager_id: row.manager_id, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0,
    }
    existing.wins += row.wins ?? 0
    existing.draws += row.draws ?? 0
    existing.losses += row.losses ?? 0
    existing.goals_for += row.goals_for ?? 0
    existing.goals_against += row.goals_against ?? 0
    totals.set(row.manager_id, existing)
  }

  const scored = [...totals.values()].map((t) => {
    const played = t.wins + t.draws + t.losses
    return {
      ...t,
      played,
      ppg: played > 0 ? (t.wins * 3 + t.draws) / played : -1,
      goal_difference: t.goals_for - t.goals_against,
    }
  })

  const ranked = scored
    .filter((t) => t.ppg >= 0)
    .sort((a, b) => {
      if (b.ppg !== a.ppg) return b.ppg - a.ppg
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      return b.goals_for - a.goals_for
    })

  const seedRanks = new Map<string, number>()
  ranked.forEach((t, idx) => seedRanks.set(t.manager_id, idx + 1))

  let rank = ranked.length + 1
  for (const id of managerIds) {
    if (!seedRanks.has(id)) seedRanks.set(id, rank++)
  }

  return seedRanks
}