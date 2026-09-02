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