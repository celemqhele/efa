export interface TeamStats {
  avg_possession: number
  avg_shots: number
  avg_shots_on_target: number
  avg_fouls: number
  avg_offsides: number
  avg_corners: number
  avg_free_kicks: number
  avg_passes: number
  avg_successful_passes: number
  avg_crosses: number
  avg_interceptions: number
  avg_tackles: number
  avg_saves: number
  avg_goals_against: number
}

export interface DNAProfile {
  label: string
  emoji: string
  color: string
}

const DNA_PROFILES: Array<{
  label: string
  emoji: string
  color: string
  condition: (s: TeamStats) => boolean
}> = [
  // ── Strictest multi-variable profiles first (highest priority) ──────────
  {
    label: 'Elite Dominators',
    emoji: '👑',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    condition: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return (
        s.avg_possession >= 53 &&
        s.avg_passes >= 143 &&
        pa >= 0.76 &&
        s.avg_shots_on_target >= 5 &&
        s.avg_saves <= 3 &&
        s.avg_goals_against <= 1.0
      )
    },
  },
  {
    label: 'Tiki-Taka',
    emoji: '🎭',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    condition: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return (
        s.avg_possession >= 52 &&
        s.avg_passes >= 140 &&
        pa >= 0.75 &&
        s.avg_crosses <= 2
      )
    },
  },
  // ── Active transition / pressing profiles ────────────────────────────────
  {
    label: 'Gegenpressing',
    emoji: '⚡',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    condition: (s) =>
      s.avg_tackles >= 6 &&
      s.avg_interceptions >= 26 &&
      s.avg_fouls >= 2 &&
      s.avg_possession >= 47,
  },
  {
    label: 'Disciplined Pressers',
    emoji: '🧠',
    color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    condition: (s) =>
      s.avg_interceptions >= 26 &&
      s.avg_tackles >= 6 &&
      s.avg_fouls <= 2,
  },
  // ── Counter-attack profiles ───────────────────────────────────────────────
  {
    label: 'Quick Counter',
    emoji: '🗡️',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    condition: (s) =>
      s.avg_possession >= 44 &&
      s.avg_possession <= 55 &&
      s.avg_shots >= 9 &&
      s.avg_offsides >= 1 &&
      s.avg_passes <= 138,
  },
  {
    label: 'Long Ball Counter',
    emoji: '🛡️',
    color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    condition: (s) =>
      s.avg_possession <= 47 &&
      s.avg_saves >= 4 &&
      s.avg_interceptions >= 26,
  },
  {
    label: 'The Grinders',
    emoji: '💪',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    condition: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return (
        s.avg_passes <= 128 &&
        pa <= 0.72 &&
        s.avg_fouls >= 2 &&
        s.avg_tackles >= 6
      )
    },
  },
  // ── Attacking style profiles ──────────────────────────────────────────────
  {
    label: 'Out Wide',
    emoji: '↔️',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    condition: (s) =>
      s.avg_crosses >= 3 &&
      s.avg_corners >= 3 &&
      s.avg_passes >= 115,
  },
  {
    label: 'Set-Piece Specialists',
    emoji: '📐',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    condition: (s) =>
      s.avg_corners >= 3 &&
      s.avg_free_kicks >= 2 &&
      s.avg_crosses >= 2,
  },
  {
    label: 'Shoot-on-Sight',
    emoji: '🎯',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    condition: (s) => {
      const sa = s.avg_shots > 0 ? s.avg_shots_on_target / s.avg_shots : 1
      return s.avg_possession >= 48 && s.avg_shots >= 9 && sa <= 0.55
    },
  },
  // ── Fallback — fires for any team that has played at least one game ────────
  {
    label: 'Pragmatic Stabilizers',
    emoji: '⚖️',
    color: 'bg-green-600/20 text-green-400 border-green-600/30',
    condition: (s) => s.avg_possession > 0,
  },
]

export function getTeamDNA(stats: TeamStats): DNAProfile[] {
  return DNA_PROFILES
    .filter((p) => p.condition(stats))
    .map(({ label, emoji, color }) => ({ label, emoji, color }))
}

type MatchStatsRow = {
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
  home_corners?: number | null
  away_corners?: number | null
  home_free_kicks?: number | null
  away_free_kicks?: number | null
  home_offsides?: number | null
  away_offsides?: number | null
}

// Primary builder — pass one entry per game with correct home/away context.
export function buildTeamStatsMixed(
  games: Array<{
    stats: MatchStatsRow
    isHome: boolean
    goalsAgainst: number
  }>
): TeamStats {
  const n = games.length || 1
  const pick = (game: typeof games[0], stat: string): number => {
    const key = `${game.isHome ? 'home' : 'away'}_${stat}` as keyof MatchStatsRow
    return (game.stats[key] as number) ?? 0
  }
  const avg = (stat: string) => games.reduce((acc, g) => acc + pick(g, stat), 0) / n

  return {
    avg_possession:        avg('possession'),
    avg_shots:             avg('shots'),
    avg_shots_on_target:   avg('shots_on_target'),
    avg_fouls:             avg('fouls'),
    avg_offsides:          avg('offsides'),
    avg_corners:           avg('corners'),
    avg_free_kicks:        avg('free_kicks'),
    avg_passes:            avg('passes'),
    avg_successful_passes: avg('successful_passes'),
    avg_crosses:           avg('crosses'),
    avg_interceptions:     avg('interceptions'),
    avg_tackles:           avg('tackles'),
    avg_saves:             avg('saves'),
    avg_goals_against:     games.reduce((acc, g) => acc + g.goalsAgainst, 0) / n,
  }
}

// Legacy helper — kept for any callers that pass a single isHome flag.
export function buildTeamStats(
  matchStats: MatchStatsRow[],
  isHome: boolean,
  goalsAgainstList: number[]
): TeamStats {
  return buildTeamStatsMixed(
    matchStats.map((stats, i) => ({
      stats,
      isHome,
      goalsAgainst: goalsAgainstList[i] ?? 0,
    }))
  )
}
