export interface TeamStats {
  avg_possession: number
  avg_interceptions: number
  avg_fouls: number
  avg_shots_on_target: number
  avg_shots: number
  avg_passes: number
  avg_successful_passes: number
  avg_crosses: number
  avg_saves: number
  avg_goals_against: number
  avg_tackles: number
}

export interface DNAProfile {
  label: string
  emoji: string
  color: string
}

const DNA_PROFILES: Array<{ label: string; emoji: string; color: string; condition: (s: TeamStats) => boolean }> = [
  {
    label: 'High Press',
    emoji: '⚡',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    condition: (s) => s.avg_possession > 52 && s.avg_interceptions > 20 && s.avg_fouls > 8,
  },
  {
    label: 'Counter Attack',
    emoji: '🗡️',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    condition: (s) => s.avg_possession < 42 && s.avg_shots_on_target > 3 && s.avg_interceptions > 22,
  },
  {
    label: 'Possession Game',
    emoji: '🎯',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    condition: (s) => s.avg_possession > 55 && s.avg_successful_passes > 110,
  },
  {
    label: 'Defensive Block',
    emoji: '🧱',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    condition: (s) => s.avg_saves > 3 && s.avg_goals_against < 0.8 && s.avg_tackles > 8,
  },
  {
    label: 'Direct Play',
    emoji: '⬆️',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    condition: (s) => s.avg_passes < 100 && s.avg_crosses > 5 && s.avg_shots > 6,
  },
]

export function getTeamDNA(stats: TeamStats): DNAProfile[] {
  return DNA_PROFILES
    .filter((p) => p.condition(stats))
    .map(({ label, emoji, color }) => ({ label, emoji, color }))
}

export function buildTeamStats(matchStats: Array<{
  home_possession?: number | null
  away_possession?: number | null
  home_shots?: number | null
  away_shots?: number | null
  home_shots_on_target?: number | null
  away_shots_on_target?: number | null
  home_fouls?: number | null
  away_fouls?: number | null
  home_passes?: number | null
  away_passes?: number | null
  home_successful_passes?: number | null
  away_successful_passes?: number | null
  home_crosses?: number | null
  away_crosses?: number | null
  home_saves?: number | null
  away_saves?: number | null
  home_interceptions?: number | null
  away_interceptions?: number | null
  home_tackles?: number | null
  away_tackles?: number | null
}>, isHome: boolean, goalsAgainstList: number[]): TeamStats {
  const n = matchStats.length || 1
  const avg = (key: 'home' | 'away', stat: string) => {
    const fullKey = `${key}_${stat}` as keyof typeof matchStats[0]
    const sum = matchStats.reduce((acc, s) => acc + ((s[fullKey] as number) ?? 0), 0)
    return sum / n
  }

  const side = isHome ? 'home' : 'away'
  const opp = isHome ? 'away' : 'home'

  return {
    avg_possession: avg(side as 'home' | 'away', 'possession'),
    avg_interceptions: avg(side as 'home' | 'away', 'interceptions'),
    avg_fouls: avg(side as 'home' | 'away', 'fouls'),
    avg_shots_on_target: avg(side as 'home' | 'away', 'shots_on_target'),
    avg_shots: avg(side as 'home' | 'away', 'shots'),
    avg_passes: avg(side as 'home' | 'away', 'passes'),
    avg_successful_passes: avg(side as 'home' | 'away', 'successful_passes'),
    avg_crosses: avg(side as 'home' | 'away', 'crosses'),
    avg_saves: avg(side as 'home' | 'away', 'saves'),
    avg_goals_against: goalsAgainstList.reduce((a, b) => a + b, 0) / (goalsAgainstList.length || 1),
    avg_tackles: avg(side as 'home' | 'away', 'tackles'),
  }
}
