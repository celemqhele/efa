import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 300

interface TrophyWithRelations {
  id: string
  team_id: string
  tournament_id: string
  season_id: string
  trophy_type: 'league' | 'tournament_club' | 'tournament_international' | 'friendlies'
  awarded_at: string
  team: {
    id: string
    name: string
    logo_league_folder: string
    logo_team_slug: string
  }
  tournament: {
    id: string
    name: string
    type: string
  }
  season: {
    id: string
    name: string
  }
}

export default async function HallOfFamePage() {
  const supabase = await createClient()

  const { data: trophiesRaw } = await supabase
    .from('trophies')
    .select(
      `*,
      team:teams(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments(id, name, type),
      season:seasons(id, name)`
    )
    .order('awarded_at', { ascending: false })

  const trophies = (trophiesRaw ?? []) as unknown as TrophyWithRelations[]

  const seasonMap: Record<string, TrophyWithRelations[]> = {}
  for (const t of trophies) {
    const sName = t.season?.name ?? 'Unknown Season'
    if (!seasonMap[sName]) seasonMap[sName] = []
    seasonMap[sName].push(t)
  }
  const seasons = Object.entries(seasonMap).sort((a, b) =>
    b[0].localeCompare(a[0])
  )

  const teamTrophyMap: Record<
    string,
    {
      team: TrophyWithRelations['team']
      total: number
      byType: Record<string, number>
    }
  > = {}
  for (const t of trophies) {
    const tid = t.team_id
    if (!teamTrophyMap[tid]) {
      teamTrophyMap[tid] = { team: t.team, total: 0, byType: {} }
    }
    teamTrophyMap[tid].total++
    teamTrophyMap[tid].byType[t.trophy_type] =
      (teamTrophyMap[tid].byType[t.trophy_type] ?? 0) + 1
  }

  const allTimeRecords = Object.entries(teamTrophyMap)
    .sort((a, b) => b[1].total - a[1].total)

  const mostPL = allTimeRecords.find(([, d]) => (d.byType['league'] ?? 0) > 0)
  const mostUCL = allTimeRecords.find(([, d]) => (d.byType['tournament_club'] ?? 0) > 0)
  const mostTotal = allTimeRecords[0]

  return <Shell data={{ seasons, allTimeRecords, mostPL, mostUCL, mostTotal }} />
}
