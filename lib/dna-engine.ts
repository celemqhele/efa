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

// ── Soft-threshold helpers ───────────────────────────────────────────────────
// ramp: 0 at/below `lo`, 1 at/above `hi`, linear between
function ramp(v: number, lo: number, hi: number): number {
  if (v <= lo) return 0
  if (v >= hi) return 1
  return (v - lo) / (hi - lo)
}
// rampDown: 1 at/below `lo`, 0 at/above `hi`
function rampDown(v: number, lo: number, hi: number): number {
  return 1 - ramp(v, lo, hi)
}
// Add a stat contribution only when the stat was actually captured (> 0)
function available(stat: number, weight: number, scoreFn: () => number): { pts: number; w: number } {
  if (stat <= 0) return { pts: 0, w: 0 }
  return { pts: weight * scoreFn(), w: weight }
}

// ── Profile definitions (scoring-based, 0–1) ────────────────────────────────
const DNA_PROFILES: Array<{
  label: string
  emoji: string
  color: string
  score: (s: TeamStats) => number
}> = [
  {
    label: 'Elite Dominators',
    emoji: '👑',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      const items = [
        available(s.avg_possession,       40, () => ramp(s.avg_possession, 48, 60)),
        available(s.avg_shots_on_target,  30, () => ramp(s.avg_shots_on_target, 4, 7)),
        available(s.avg_goals_against,    30, () => rampDown(s.avg_goals_against, 0.6, 1.8)),
        available(s.avg_passes,           25, () => ramp(s.avg_passes, 135, 155)),
        available(s.avg_passes,           15, () => ramp(pa, 0.72, 0.82)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Tiki-Taka',
    emoji: '🎭',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      const items = [
        available(s.avg_possession, 45, () => ramp(s.avg_possession, 50, 62)),
        available(s.avg_passes,     40, () => ramp(s.avg_passes, 130, 155)),
        available(s.avg_passes,     25, () => ramp(pa, 0.72, 0.82)),
        available(s.avg_crosses,    20, () => rampDown(s.avg_crosses, 1, 4)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Gegenpressing',
    emoji: '⚡',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    score: (s) => {
      const items = [
        available(s.avg_tackles,        40, () => ramp(s.avg_tackles, 4, 8)),
        available(s.avg_interceptions,  40, () => ramp(s.avg_interceptions, 22, 32)),
        available(s.avg_possession,     20, () => ramp(s.avg_possession, 44, 54)),
        available(s.avg_fouls,          10, () => ramp(s.avg_fouls, 1, 4)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Disciplined Pressers',
    emoji: '🧠',
    color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    score: (s) => {
      const items = [
        available(s.avg_interceptions, 45, () => ramp(s.avg_interceptions, 22, 32)),
        available(s.avg_tackles,       35, () => ramp(s.avg_tackles, 4, 8)),
        available(s.avg_fouls,         20, () => rampDown(s.avg_fouls, 0, 3)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Quick Counter',
    emoji: '🗡️',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    score: (s) => {
      const items = [
        available(s.avg_possession, 35, () => ramp(rampDown(s.avg_possession, 44, 56) + ramp(s.avg_possession, 42, 52), 0.5, 1.5)),
        available(s.avg_shots,      40, () => ramp(s.avg_shots, 7, 12)),
        available(s.avg_offsides,   25, () => ramp(s.avg_offsides, 0.5, 2.5)),
      ]
      // Simpler: mid-possession + high shots
      const posScore = ramp(s.avg_possession, 40, 50) * rampDown(s.avg_possession, 52, 62)
      const shotScore = ramp(s.avg_shots, 7, 13)
      const offScore = s.avg_offsides > 0 ? ramp(s.avg_offsides, 0.5, 2.5) : 0.5
      const wPoss = 35, wShot = 40, wOff = s.avg_offsides > 0 ? 25 : 0
      const total = wPoss * posScore + wShot * shotScore + wOff * offScore
      return total / (wPoss + wShot + wOff || 1)
    },
  },
  {
    label: 'Long Ball Counter',
    emoji: '🛡️',
    color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    score: (s) => {
      const items = [
        available(s.avg_possession,    40, () => rampDown(s.avg_possession, 40, 52)),
        available(s.avg_saves,         35, () => ramp(s.avg_saves, 3, 6)),
        available(s.avg_interceptions, 25, () => ramp(s.avg_interceptions, 22, 32)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'The Grinders',
    emoji: '💪',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      const items = [
        available(s.avg_tackles,  40, () => ramp(s.avg_tackles, 4, 8)),
        available(s.avg_fouls,    30, () => ramp(s.avg_fouls, 1, 4)),
        available(s.avg_passes,   30, () => rampDown(s.avg_passes, 110, 140)),
        available(s.avg_passes,   20, () => rampDown(pa, 0.60, 0.76)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Out Wide',
    emoji: '↔️',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    score: (s) => {
      const items = [
        available(s.avg_crosses,  45, () => ramp(s.avg_crosses, 2, 5)),
        available(s.avg_corners,  35, () => ramp(s.avg_corners, 2, 5)),
        available(s.avg_passes,   20, () => ramp(s.avg_passes, 110, 140)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Set-Piece Specialists',
    emoji: '📐',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    score: (s) => {
      const items = [
        available(s.avg_corners,    40, () => ramp(s.avg_corners, 2, 5)),
        available(s.avg_free_kicks, 40, () => ramp(s.avg_free_kicks, 1, 3)),
        available(s.avg_crosses,    20, () => ramp(s.avg_crosses, 1, 4)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  {
    label: 'Shoot-on-Sight',
    emoji: '🎯',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    score: (s) => {
      const sa = s.avg_shots > 0 ? s.avg_shots_on_target / s.avg_shots : 1
      const items = [
        available(s.avg_shots,           50, () => ramp(s.avg_shots, 8, 14)),
        available(s.avg_shots_on_target, 30, () => rampDown(sa * 100, 40, 60)),
        available(s.avg_possession,      20, () => ramp(s.avg_possession, 44, 56)),
      ]
      const totPts = items.reduce((a, i) => a + i.pts, 0)
      const totW  = items.reduce((a, i) => a + i.w, 0)
      return totW > 0 ? totPts / totW : 0
    },
  },
  // ── Fallback — always scores 0.25 as a floor ────────────────────────────────
  {
    label: 'Pragmatic Stabilizers',
    emoji: '⚖️',
    color: 'bg-green-600/20 text-green-400 border-green-600/30',
    score: () => 0.25,
  },
]

export function getTeamDNA(stats: TeamStats): DNAProfile[] {
  const scored = DNA_PROFILES
    .map((p) => ({ ...p, s: p.score(stats) }))
    .sort((a, b) => b.s - a.s)

  // Return all profiles scoring >= 0.45, up to 3, always at least 1
  const strong = scored.filter((p) => p.s >= 0.45).slice(0, 3)
  const result = strong.length > 0 ? strong : [scored[0]]

  return result.map(({ label, emoji, color }) => ({ label, emoji, color }))
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
