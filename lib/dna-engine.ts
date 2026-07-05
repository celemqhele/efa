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
  iconName: string
  color: string
  level: string
  score: number
}

export interface MatchupCoachNote {
  approach: string
  key_threat: string
  exploit: string
  setup: string
}

export interface PersonalizedDescription {
  about: string
  tendencies: string[]
  coachNote: string
  weaknesses: string[]
  matchupCoachNotes?: Record<string, MatchupCoachNote>
}

// ── Threshold helpers ────────────────────────────────────────────────────────
function ramp(v: number, lo: number, hi: number): number {
  if (v <= lo) return 0
  if (v >= hi) return 1
  return (v - lo) / (hi - lo)
}
function rampDown(v: number, lo: number, hi: number): number {
  return 1 - ramp(v, lo, hi)
}

// ── Scoring primitives ───────────────────────────────────────────────────────
// All return [weighted_pts, weight]. Guarded variants return [0,0] when stat = 0
// (treats 0 as "not captured" — safe for passes/tackles/interceptions/etc.)
// Goals-against uses unguarded variants since 0 GA (clean sheet) is valid data.

type W = readonly [number, number]
const Z: W = [0, 0]

/** Higher is better. Skip if stat not captured. */
function hi(v: number, w: number, lo: number, hi_: number): W {
  if (v <= 0) return Z
  return [w * ramp(v, lo, hi_), w]
}
/** Lower is better. Skip if stat not captured. */
function lo(v: number, w: number, lo_: number, hi_: number): W {
  if (v <= 0) return Z
  return [w * rampDown(v, lo_, hi_), w]
}
/** Sweet-spot at center ± spread. Skip if stat not captured. */
function mid(v: number, w: number, center: number, spread: number): W {
  if (v <= 0) return Z
  return [w * Math.max(0, 1 - Math.abs(v - center) / spread), w]
}
/** Goals-against, lower better. Always scored (computed from match results). */
function gaLo(v: number, w: number, lo_: number, hi_: number): W {
  return [w * rampDown(v, lo_, hi_), w]
}

function tally(...ws: W[]): number {
  let pts = 0, wt = 0
  for (const [p, w] of ws) { pts += p; wt += w }
  return wt > 0 ? pts / wt : 0
}

// ── Profile definitions ──────────────────────────────────────────────────────
export const DNA_PROFILES: Array<{
  label: string
  iconName: string
  color: string
  score: (s: TeamStats) => number
}> = [
  {
    label: 'Elite Dominators',
    iconName: 'crown',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: complete control + clean sheet
        hi(s.avg_possession,        40, 44, 62),
        hi(s.avg_passes,            40, 124, 164),
        hi(s.avg_shots_on_target,   40, 3,  8),
        lo(s.avg_saves,             35, 1,  5),
        gaLo(s.avg_goals_against,   35, 0,  1.6),
        // Secondary: technical quality + output
        hi(pa,                      25, 0.70, 0.87),
        hi(s.avg_shots,             20, 7,  15),
        hi(s.avg_corners,           20, 2,  7),
        // Tertiary: context stats
        hi(s.avg_interceptions,      5, 18, 34),
        mid(s.avg_fouls,             5, 2,  3),
        mid(s.avg_offsides,          5, 1.5, 2),
        mid(s.avg_crosses,           5, 2.5, 4),
        mid(s.avg_free_kicks,        5, 1.5, 2),
        hi(s.avg_tackles,            5, 3,  8),
      )
    },
  },

  {
    label: 'Tiki-Taka',
    iconName: 'theater',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: patient possession + accuracy + no crosses
        hi(s.avg_possession,        40, 48, 66),
        hi(s.avg_passes,            40, 132, 172),
        hi(pa,                      40, 0.74, 0.90),
        lo(s.avg_crosses,           35, 0,  4),
        // Secondary: clean and technical
        lo(s.avg_fouls,             25, 0,  3),
        gaLo(s.avg_goals_against,   20, 0,  1.8),
        hi(s.avg_shots,             20, 6,  13),
        hi(s.avg_shots_on_target,   20, 3,  7),
        // Tertiary
        lo(s.avg_saves,              5, 1,  5),
        lo(s.avg_free_kicks,         5, 0,  3),
        hi(s.avg_corners,            5, 1,  5),
        hi(s.avg_interceptions,      5, 18, 32),
        mid(s.avg_tackles,           5, 5,  5),
        mid(s.avg_offsides,          5, 1,  2),
      )
    },
  },

  {
    label: 'Gegenpressing',
    iconName: 'zap',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: intense physical press (KEY: fouls are HIGH vs Disciplined Pressers)
        hi(s.avg_tackles,           40, 5,  11),
        hi(s.avg_interceptions,     40, 22, 36),
        hi(s.avg_fouls,             40, 2.0, 5.5),
        mid(s.avg_possession,       30, 49, 12),
        // Secondary: attacking threat from press
        hi(s.avg_shots,             20, 7,  14),
        hi(s.avg_offsides,          20, 0.5, 4),
        hi(s.avg_corners,           20, 2,  7),
        // Tertiary
        hi(s.avg_shots_on_target,   10, 3,  7),
        mid(s.avg_passes,           10, 135, 25),
        mid(pa,                     10, 0.75, 0.10),
        gaLo(s.avg_goals_against,   10, 0,  2.0),
        mid(s.avg_saves,            10, 3,  3),
        mid(s.avg_crosses,          10, 2,  3),
        mid(s.avg_free_kicks,       10, 2,  2),
      )
    },
  },

  {
    label: 'Disciplined Pressers',
    iconName: 'brain',
    color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: high press wins WITHOUT fouling (KEY differentiator: lo fouls)
        hi(s.avg_interceptions,     40, 22, 36),
        hi(s.avg_tackles,           40, 4,  10),
        lo(s.avg_fouls,             40, 0,  2.5),
        // Secondary
        mid(s.avg_possession,       25, 48, 10),
        hi(s.avg_shots,             25, 7,  13),
        lo(s.avg_free_kicks,        25, 0,  3),
        // Tertiary
        hi(s.avg_shots_on_target,   15, 3,  7),
        mid(pa,                     10, 0.76, 0.10),
        mid(s.avg_passes,           10, 133, 25),
        gaLo(s.avg_goals_against,   10, 0,  2.0),
        mid(s.avg_saves,            10, 3,  3),
        mid(s.avg_crosses,          10, 2,  3),
        mid(s.avg_offsides,         10, 1,  2),
        mid(s.avg_corners,          10, 3,  3),
      )
    },
  },

  {
    label: 'Quick Counter',
    iconName: 'dagger',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: low possession + high output on the break
        lo(s.avg_possession,        40, 36, 54),
        hi(s.avg_shots,             40, 7,  14),
        hi(s.avg_offsides,          40, 0.3, 4),
        hi(s.avg_saves,             30, 2,  6),
        // Secondary: direct play
        lo(s.avg_passes,            25, 100, 140),
        lo(pa,                      25, 0.64, 0.82),
        gaLo(s.avg_goals_against,   25, 0,  2.2),
        // Tertiary
        hi(s.avg_shots_on_target,   10, 3,  7),
        mid(s.avg_fouls,            10, 2,  3),
        hi(s.avg_interceptions,     10, 18, 32),
        hi(s.avg_tackles,           10, 3,  8),
        mid(s.avg_corners,          10, 3,  3),
        mid(s.avg_free_kicks,       10, 2,  2),
        mid(s.avg_crosses,          10, 2,  3),
      )
    },
  },

  {
    label: 'Long Ball Counter',
    iconName: 'shield',
    color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: very direct + GK under pressure
        lo(s.avg_possession,        40, 34, 52),
        lo(s.avg_passes,            40, 96, 138),
        lo(pa,                      35, 0.60, 0.80),
        hi(s.avg_saves,             35, 3,  7),
        // Secondary: passive + direct shape
        lo(s.avg_corners,           20, 0,  5),
        lo(s.avg_offsides,          20, 0,  3),
        lo(s.avg_shots,             15, 4,  13),
        // Tertiary
        hi(s.avg_interceptions,     10, 18, 32),
        hi(s.avg_tackles,           10, 3,  8),
        mid(s.avg_fouls,            10, 2,  3),
        gaLo(s.avg_goals_against,   10, 0,  3.0),
        mid(s.avg_shots_on_target,  10, 4,  3),
        mid(s.avg_crosses,          10, 2,  3),
        mid(s.avg_free_kicks,       10, 2,  2),
      )
    },
  },

  {
    label: 'The Grinders',
    iconName: 'muscle',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: physical + direct (KEY: high fouls AND high free kicks AND tackles)
        hi(s.avg_fouls,             40, 1.5, 5.5),
        hi(s.avg_tackles,           40, 5,  11),
        hi(s.avg_free_kicks,        35, 1.5, 5.5),
        lo(s.avg_passes,            35, 100, 142),
        // Secondary: low possession + poor passing accuracy
        lo(s.avg_possession,        25, 38, 54),
        lo(pa,                      25, 0.62, 0.80),
        hi(s.avg_saves,             20, 2,  6),
        // Tertiary
        hi(s.avg_shots,             10, 7,  13),
        hi(s.avg_shots_on_target,   10, 3,  7),
        hi(s.avg_interceptions,     10, 18, 30),
        mid(s.avg_offsides,         10, 1,  2),
        mid(s.avg_corners,          10, 3,  3),
        mid(s.avg_crosses,          10, 2,  3),
        gaLo(s.avg_goals_against,   10, 0,  2.5),
      )
    },
  },

  {
    label: 'Out Wide',
    iconName: 'arrows_horizontal',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: wide delivery volume (both corners AND crosses high)
        hi(s.avg_crosses,           45, 2,  7),
        hi(s.avg_corners,           45, 3,  8),
        // Secondary: attacking output from width
        hi(s.avg_shots,             25, 7,  14),
        hi(s.avg_shots_on_target,   25, 3,  7),
        mid(s.avg_passes,           20, 135, 25),
        mid(s.avg_possession,       20, 50, 10),
        // Tertiary: context
        mid(pa,                     15, 0.75, 0.10),
        mid(s.avg_fouls,            15, 2,  3),
        mid(s.avg_offsides,         10, 1,  2),
        mid(s.avg_free_kicks,       10, 2,  2),
        hi(s.avg_interceptions,     10, 18, 30),
        hi(s.avg_tackles,           10, 3,  7),
        mid(s.avg_saves,            10, 3,  3),
        gaLo(s.avg_goals_against,   10, 0,  2.0),
      )
    },
  },

  {
    label: 'Set-Piece Specialists',
    iconName: 'triangle',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: dead-ball volume (KEY: corners AND free kicks both high)
        hi(s.avg_corners,           45, 3,  8),
        hi(s.avg_free_kicks,        50, 2,  6),
        hi(s.avg_fouls,             35, 1.5, 5),
        hi(s.avg_crosses,           20, 1.5, 6),
        // Secondary
        hi(s.avg_shots,             20, 7,  13),
        hi(s.avg_shots_on_target,   15, 3,  7),
        gaLo(s.avg_goals_against,   15, 0,  2.0),
        // Tertiary
        mid(s.avg_possession,       15, 49, 10),
        mid(s.avg_passes,           10, 128, 25),
        mid(pa,                     10, 0.73, 0.10),
        mid(s.avg_offsides,         10, 1,  2),
        hi(s.avg_interceptions,     10, 18, 30),
        hi(s.avg_tackles,           10, 3,  7),
        mid(s.avg_saves,            10, 3,  3),
      )
    },
  },

  {
    label: 'Shoot-on-Sight',
    iconName: 'target',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      const sa = s.avg_shots > 0 ? s.avg_shots_on_target / s.avg_shots : 0.5
      return tally(
        // Primary: shoot often + accept low conversion rate
        hi(s.avg_shots,             45, 9,  18),
        lo(sa,                      40, 0.28, 0.64),
        // Secondary
        hi(s.avg_offsides,          25, 0.5, 4),
        hi(s.avg_shots_on_target,   20, 3,  8),
        mid(s.avg_possession,       20, 50, 10),
        hi(s.avg_corners,           20, 2,  7),
        // Tertiary
        mid(s.avg_passes,           10, 130, 25),
        mid(pa,                     10, 0.74, 0.10),
        mid(s.avg_fouls,            15, 2,  3),
        hi(s.avg_interceptions,     15, 18, 30),
        hi(s.avg_tackles,           10, 3,  7),
        mid(s.avg_saves,            10, 3,  3),
        gaLo(s.avg_goals_against,   10, 0,  2.0),
        mid(s.avg_free_kicks,       10, 2,  2),
        mid(s.avg_crosses,          10, 2,  3),
      )
    },
  },

  // Fallback — always scores 0.25, wins only if nothing else qualifies
  {
    label: 'Pragmatic Stabilizers',
    iconName: 'scale',
    color: 'bg-green-600/20 text-green-400 border-green-600/30',
    score: () => 0.25,
  },
]

// ── Overlap Penalty System (Refinement A) ────────────────────────────────────
// Mutual exclusivity pairs: when both profiles score well, each is penalized
// proportionally to the overlap (score_a * score_b * factor).
const OVERLAP_PAIRS: Array<[string, string, number]> = [
  ['Gegenpressing', 'Disciplined Pressers', 0.4],
  ['Elite Dominators', 'Tiki-Taka', 0.3],
  ['Quick Counter', 'Long Ball Counter', 0.35],
  ['The Grinders', 'Set-Piece Specialists', 0.3],
  ['Out Wide', 'Set-Piece Specialists', 0.25],
  ['Quick Counter', 'Shoot-on-Sight', 0.2],
  ['The Grinders', 'Gegenpressing', 0.2],
]

function applyOverlapPenalties<T extends { label: string; s: number }>(scored: T[]): T[] {
  const map = new Map(scored.map(p => [p.label, p]))
  for (const [a, b, factor] of OVERLAP_PAIRS) {
    const pA = map.get(a)
    const pB = map.get(b)
    if (pA && pB && pA.s > 0 && pB.s > 0) {
      const total = pA.s + pB.s
      if (total <= 0) continue
      const overlap = pA.s * pB.s * factor
      pA.s = Math.max(0, pA.s - overlap * (pA.s / total))
      pB.s = Math.max(0, pB.s - overlap * (pB.s / total))
    }
  }
  return scored
}

// ── Score → level ────────────────────────────────────────────────────────────
export function scoreToLevel(s: number): string {
  if (s >= 0.80) return '+++++'
  if (s >= 0.65) return '++++'
  if (s >= 0.50) return '+++'
  if (s >= 0.38) return '++'
  if (s >= 0.27) return '+'
  if (s >= 0.18) return '-'
  if (s >= 0.10) return '--'
  if (s >= 0.04) return '---'
  return '----'
}

export const LEVEL_LABELS: Record<string, { short: string; detail: string }> = {
  '+++++': { short: 'Pure Expression',  detail: 'Textbook execution — this team is the definitive version of this style.' },
  '++++':  { short: 'Strong Match',     detail: 'Clearly plays this way with high consistency across games.' },
  '+++':   { short: 'Solid Match',      detail: 'Consistent traits of this style visible across most games.' },
  '++':    { short: 'Moderate Match',   detail: 'Clear tendencies toward this style, but not yet dominant.' },
  '+':     { short: 'Developing',       detail: 'Early signs of this style emerging — becoming more consistent.' },
  '-':     { short: 'Marginal',         detail: 'Closest available match, but only a slight lean toward this style.' },
  '--':    { short: 'Weak Match',       detail: 'Minimal traits — may shift to a different style with more data.' },
  '---':   { short: 'Very Weak',        detail: 'Barely matches this style — likely limited data available.' },
  '----':  { short: 'Forced Match',     detail: 'Closest available with current data — not a strong fit yet.' },
}

// ── Legacy combination system — kept for reference but no longer rendered.
// Team playstyles now use a single combined profile stored in primary_* columns.

export const MIN_DNA_GAMES = 3

// ── Public API ───────────────────────────────────────────────────────────────
export function getTeamDNA(stats: TeamStats): DNAProfile[] {
  const scored = applyOverlapPenalties(
    DNA_PROFILES.map((p) => ({ ...p, s: p.score(stats) }))
  ).sort((a, b) => b.s - a.s)

  // Always show the top profile; add any secondaries >= 0.30 (soft tier)
  const primary = scored[0]
  const secondaries = scored.slice(1).filter((p) => p.s >= 0.30)
  const result = [primary, ...secondaries].slice(0, 3)

  return result.map(({ label, iconName, color, s }) => ({
    label,
    iconName,
    color,
    level: scoreToLevel(s),
    score: s,
  }))
}

// ── Stats builders ───────────────────────────────────────────────────────────
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

export function buildTeamStatsMixed(
  games: Array<{ stats: MatchStatsRow; isHome: boolean; goalsAgainst: number }>
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

// ── Manual (DB-driven) DNA API ────────────────────────────────────────────
// Replaces the auto-calculation approach. Playstyles are assigned manually
// by the AI assistant after reviewing team match stats each matchday.

const PROFILE_COLOR_MAP: Record<string, string> = {}
const PROFILE_ICON_MAP: Record<string, string> = {}
for (const p of DNA_PROFILES) {
  PROFILE_COLOR_MAP[p.label] = p.color
  PROFILE_ICON_MAP[p.label] = p.iconName
}

async function getTeamDNARow(
  supabase: any,
  teamId: string
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('team_dna')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle()
  return data
}

function buildDescription(
  row: Record<string, any>,
  prefix: 'primary' | 'secondary' | 'tertiary'
): PersonalizedDescription | null {
  const about = row[`${prefix}_about`]
  if (!about) return null
  return {
    about,
    tendencies: row[`${prefix}_tendencies`] ?? [],
    coachNote: row[`${prefix}_coach_note`] ?? '',
    weaknesses: row[`${prefix}_weaknesses`] ?? [],
    matchupCoachNotes: row.matchup_coach_notes ?? undefined,
  }
}

export async function getTeamDNAFromDB(
  supabase: any,
  teamId: string
): Promise<{
  profiles: DNAProfile[]
  descriptionMap: Record<string, PersonalizedDescription>
}> {
  const row = await getTeamDNARow(supabase, teamId)
  if (!row || !row.primary_profile) return { profiles: [], descriptionMap: {} }

  const profiles: DNAProfile[] = [{
    label: row.primary_profile,
    iconName: PROFILE_ICON_MAP[row.primary_profile] ?? 'scale',
    color: PROFILE_COLOR_MAP[row.primary_profile] ?? 'bg-slate-500/20 text-slate-400',
    level: row.primary_level ?? '-',
    score: row.primary_score ?? 0,
  }]

  const descriptionMap: Record<string, PersonalizedDescription> = {}
  const desc = buildDescription(row, 'primary')
  if (desc) descriptionMap[row.primary_profile] = desc

  return { profiles, descriptionMap }
}
