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
  level: string
  score: number
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
      return tally(
        // Primary: complete control + clean sheet
        hi(s.avg_possession,        40, 44, 62),    // 55%+
        hi(s.avg_passes,            40, 124, 164),  // 148+
        hi(s.avg_shots_on_target,   40, 3,  8),     // 6+
        lo(s.avg_saves,             35, 1,  5),     // 2↓ (GK rarely tested)
        gaLo(s.avg_goals_against,   35, 0,  1.6),   // 0.7↓
        // Secondary: technical quality + output
        hi(pa,                      25, 0.70, 0.87),// 79%+
        hi(s.avg_shots,             20, 7,  15),    // 10+
        hi(s.avg_corners,           20, 2,  7),     // 4+
        // Tertiary: context stats
        hi(s.avg_interceptions,     10, 18, 34),    // 25+
        mid(s.avg_fouls,            10, 2,  3),     // ~2
        mid(s.avg_offsides,         10, 1.5, 2),    // ~1-2
        mid(s.avg_crosses,          10, 2.5, 4),    // moderate
        mid(s.avg_free_kicks,       10, 1.5, 2),    // moderate
        hi(s.avg_tackles,           10, 3,  8),     // moderate+
      )
    },
  },

  {
    label: 'Tiki-Taka',
    emoji: '🎭',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: patient possession + accuracy + no crosses
        hi(s.avg_possession,        40, 48, 66),    // 56%+
        hi(s.avg_passes,            40, 132, 172),  // 152+
        hi(pa,                      40, 0.74, 0.90),// 81%+
        lo(s.avg_crosses,           35, 0,  4),     // 1↓ (central play only)
        // Secondary: clean and technical
        lo(s.avg_fouls,             25, 0,  3),     // 1↓
        gaLo(s.avg_goals_against,   20, 0,  1.8),   // 0.9↓
        hi(s.avg_shots,             20, 6,  13),    // 9
        hi(s.avg_shots_on_target,   20, 3,  7),     // 5
        // Tertiary
        lo(s.avg_saves,             10, 1,  5),     // 2↓
        lo(s.avg_free_kicks,        10, 0,  3),     // 1↓
        hi(s.avg_corners,           10, 1,  5),     // 3
        hi(s.avg_interceptions,     10, 18, 32),    // 24+
        mid(s.avg_tackles,          10, 5,  5),     // ~5
        mid(s.avg_offsides,         10, 1,  2),     // ~1
      )
    },
  },

  {
    label: 'Gegenpressing',
    emoji: '⚡',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: intense physical press (KEY: fouls are HIGH vs Disciplined Pressers)
        hi(s.avg_tackles,           40, 5,  11),    // 8+
        hi(s.avg_interceptions,     40, 22, 36),    // 30+
        hi(s.avg_fouls,             35, 1.5, 5.5),  // 3+ (physical, fouls more)
        mid(s.avg_possession,       30, 49, 12),    // ~49% moderate
        // Secondary: attacking threat from press
        hi(s.avg_shots,             20, 7,  14),    // 10
        hi(s.avg_offsides,          20, 0.5, 4),    // 2+ (high line)
        hi(s.avg_corners,           20, 2,  7),     // 4+
        // Tertiary
        hi(s.avg_shots_on_target,   10, 3,  7),     // 5
        mid(s.avg_passes,           10, 135, 25),   // ~135
        mid(pa,                     10, 0.75, 0.10),// ~75%
        gaLo(s.avg_goals_against,   10, 0,  2.0),   // ~1.0
        mid(s.avg_saves,            10, 3,  3),     // ~3
        mid(s.avg_crosses,          10, 2,  3),     // ~2
        mid(s.avg_free_kicks,       10, 2,  2),     // ~2
      )
    },
  },

  {
    label: 'Disciplined Pressers',
    emoji: '🧠',
    color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: high press wins WITHOUT fouling (KEY differentiator: lo fouls)
        hi(s.avg_interceptions,     40, 22, 36),    // 30+
        hi(s.avg_tackles,           40, 4,  10),    // 7+
        lo(s.avg_fouls,             40, 0,  3),     // 1↓ (smart, not dirty)
        // Secondary
        mid(s.avg_possession,       25, 48, 10),    // ~48%
        hi(s.avg_shots,             20, 7,  13),    // 9
        lo(s.avg_free_kicks,        20, 0,  3),     // 1↓ (few fouls = few FKs given)
        // Tertiary
        hi(s.avg_shots_on_target,   10, 3,  7),     // 5
        mid(pa,                     10, 0.76, 0.10),// ~76%
        mid(s.avg_passes,           10, 133, 25),   // ~133
        gaLo(s.avg_goals_against,   10, 0,  2.0),   // ~1.0
        mid(s.avg_saves,            10, 3,  3),     // ~3
        mid(s.avg_crosses,          10, 2,  3),     // ~2
        mid(s.avg_offsides,         10, 1,  2),     // ~1
        mid(s.avg_corners,          10, 3,  3),     // ~3
      )
    },
  },

  {
    label: 'Quick Counter',
    emoji: '🗡️',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: low possession + high output on the break
        lo(s.avg_possession,        40, 36, 54),    // 45%↓
        hi(s.avg_shots,             40, 7,  14),    // 10+
        hi(s.avg_offsides,          35, 0.5, 4),    // 2+ (forwards running in behind)
        hi(s.avg_saves,             30, 2,  6),     // 4+ (GK busy = they defend deep)
        // Secondary: direct play
        lo(s.avg_passes,            25, 100, 140),  // 122↓
        lo(pa,                      20, 0.64, 0.82),// 73%↓ (direct passes = lower acc)
        gaLo(s.avg_goals_against,   20, 0,  2.2),   // ~1.2
        // Tertiary
        hi(s.avg_shots_on_target,   10, 3,  7),     // 5
        mid(s.avg_fouls,            10, 2,  3),     // ~2
        hi(s.avg_interceptions,     10, 18, 32),    // 26
        hi(s.avg_tackles,           10, 3,  8),     // 6
        mid(s.avg_corners,          10, 3,  3),     // ~3
        mid(s.avg_free_kicks,       10, 2,  2),     // ~2
        mid(s.avg_crosses,          10, 2,  3),     // ~2
      )
    },
  },

  {
    label: 'Long Ball Counter',
    emoji: '🛡️',
    color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: very direct + GK under pressure
        lo(s.avg_possession,        40, 34, 52),    // 42%↓
        lo(s.avg_passes,            40, 96, 138),   // 115↓
        lo(pa,                      35, 0.60, 0.80),// 70%↓ (long balls = low accuracy)
        hi(s.avg_saves,             35, 3,  7),     // 5+ (GK very busy)
        // Secondary: passive + direct shape
        lo(s.avg_corners,           20, 0,  5),     // 2↓ (don't attack wide)
        lo(s.avg_offsides,          20, 0,  3),     // 1↓ (not timing runs)
        lo(s.avg_shots,             15, 4,  13),    // 8↓ (few chances)
        // Tertiary
        hi(s.avg_interceptions,     10, 18, 32),    // 27
        hi(s.avg_tackles,           10, 3,  8),     // 6
        mid(s.avg_fouls,            10, 2,  3),     // ~2
        gaLo(s.avg_goals_against,   10, 0,  3.0),   // ~1.4 (concede more)
        mid(s.avg_shots_on_target,  10, 4,  3),     // ~4
        mid(s.avg_crosses,          10, 2,  3),     // ~2
        mid(s.avg_free_kicks,       10, 2,  2),     // ~2
      )
    },
  },

  {
    label: 'The Grinders',
    emoji: '💪',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: physical + direct (KEY: high fouls AND high free kicks AND tackles)
        hi(s.avg_fouls,             40, 1.5, 5.5),  // 3+
        hi(s.avg_tackles,           40, 5,  11),    // 8+
        hi(s.avg_free_kicks,        35, 1.5, 5.5),  // 3+ (win AND give fouls)
        lo(s.avg_passes,            35, 100, 142),  // 120↓ (direct play)
        // Secondary: low possession + poor passing accuracy
        lo(s.avg_possession,        25, 38, 54),    // 46%↓
        lo(pa,                      25, 0.62, 0.80),// 71%↓
        hi(s.avg_saves,             20, 2,  6),     // 4
        // Tertiary
        hi(s.avg_shots,             10, 7,  13),    // 9
        hi(s.avg_shots_on_target,   10, 3,  7),     // 5
        hi(s.avg_interceptions,     10, 18, 30),    // 25
        mid(s.avg_offsides,         10, 1,  2),     // ~1
        mid(s.avg_corners,          10, 3,  3),     // ~3
        mid(s.avg_crosses,          10, 2,  3),     // ~2
        gaLo(s.avg_goals_against,   10, 0,  2.5),   // ~1.3
      )
    },
  },

  {
    label: 'Out Wide',
    emoji: '↔️',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: wide delivery volume (both corners AND crosses high)
        hi(s.avg_crosses,           45, 2,  7),     // 4+
        hi(s.avg_corners,           45, 3,  8),     // 5+
        // Secondary: attacking output from width
        hi(s.avg_shots,             25, 7,  14),    // 10
        hi(s.avg_shots_on_target,   20, 3,  7),     // 5
        mid(s.avg_passes,           20, 135, 25),   // ~135
        mid(s.avg_possession,       20, 50, 10),    // ~50%
        // Tertiary: context
        mid(pa,                     10, 0.75, 0.10),// ~75%
        mid(s.avg_fouls,            10, 2,  3),     // ~2
        mid(s.avg_offsides,         10, 1,  2),     // ~1
        mid(s.avg_free_kicks,       10, 2,  2),     // ~2
        hi(s.avg_interceptions,     10, 18, 30),    // 24
        hi(s.avg_tackles,           10, 3,  7),     // 5
        mid(s.avg_saves,            10, 3,  3),     // ~3
        gaLo(s.avg_goals_against,   10, 0,  2.0),   // ~1.1
      )
    },
  },

  {
    label: 'Set-Piece Specialists',
    emoji: '📐',
    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      return tally(
        // Primary: dead-ball volume (KEY: corners AND free kicks both high)
        hi(s.avg_corners,           45, 3,  8),     // 5+
        hi(s.avg_free_kicks,        45, 2,  6),     // 3+
        hi(s.avg_fouls,             35, 1.5, 5),    // 3 (win fouls in dangerous areas)
        hi(s.avg_crosses,           30, 1.5, 6),    // 3+ (dead-ball deliveries)
        // Secondary
        hi(s.avg_shots,             20, 7,  13),    // 10
        hi(s.avg_shots_on_target,   15, 3,  7),     // 5
        gaLo(s.avg_goals_against,   15, 0,  2.0),   // ~1.1
        // Tertiary
        mid(s.avg_possession,       10, 49, 10),    // ~49%
        mid(s.avg_passes,           10, 128, 25),   // ~128
        mid(pa,                     10, 0.73, 0.10),// ~73%
        mid(s.avg_offsides,         10, 1,  2),     // ~1
        hi(s.avg_interceptions,     10, 18, 30),    // 24
        hi(s.avg_tackles,           10, 3,  7),     // 5
        mid(s.avg_saves,            10, 3,  3),     // ~3
      )
    },
  },

  {
    label: 'Shoot-on-Sight',
    emoji: '🎯',
    color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    score: (s) => {
      const pa = s.avg_passes > 0 ? s.avg_successful_passes / s.avg_passes : 0
      // Shot accuracy: low ratio = shoot from anywhere. Computed from always-captured stats.
      const sa = s.avg_shots > 0 ? s.avg_shots_on_target / s.avg_shots : 0.5
      return tally(
        // Primary: shoot often + accept low conversion rate
        hi(s.avg_shots,             45, 9,  18),    // 13+
        lo(sa,                      40, 0.28, 0.64),// low SoT/shots ratio
        // Secondary
        hi(s.avg_offsides,          25, 0.5, 4),    // 2+ (aggressive forward intent)
        hi(s.avg_shots_on_target,   20, 3,  8),     // 5 (SoT ok, just ratio is low)
        mid(s.avg_possession,       20, 50, 10),    // ~50%
        hi(s.avg_corners,           20, 2,  7),     // 4 (shots generate corners)
        // Tertiary
        mid(s.avg_passes,           10, 130, 25),   // ~130
        mid(pa,                     10, 0.74, 0.10),// ~74%
        mid(s.avg_fouls,            10, 2,  3),     // ~2
        hi(s.avg_interceptions,     10, 18, 30),    // 24
        hi(s.avg_tackles,           10, 3,  7),     // 5
        mid(s.avg_saves,            10, 3,  3),     // ~3
        gaLo(s.avg_goals_against,   10, 0,  2.0),   // ~1.0
        mid(s.avg_free_kicks,       10, 2,  2),     // ~2
        mid(s.avg_crosses,          10, 2,  3),     // ~2
      )
    },
  },

  // Fallback — always scores 0.25, wins only if nothing else qualifies
  {
    label: 'Pragmatic Stabilizers',
    emoji: '⚖️',
    color: 'bg-green-600/20 text-green-400 border-green-600/30',
    score: () => 0.25,
  },
]

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

// ── Combination system ───────────────────────────────────────────────────────
// Keys are profile labels sorted alphabetically and joined by '|'

export interface DNACombination {
  name: string
  level: string
  score: number
}

const COMBINATION_MAP: Record<string, string> = {
  // ── 2-way (45) ───────────────────────────────────────────────────────────
  'Disciplined Pressers|Elite Dominators':                        'Tactical Perfection',
  'Disciplined Pressers|Gegenpressing':                           'Complete Press',
  'Disciplined Pressers|Long Ball Counter':                       'Structured Pragmatism',
  'Disciplined Pressers|Out Wide':                                'Wide Intelligence',
  'Disciplined Pressers|Quick Counter':                           'Calculated Counter',
  'Disciplined Pressers|Set-Piece Specialists':                   'Dead Ball Tacticians',
  'Disciplined Pressers|Shoot-on-Sight':                          'Press & Strike',
  'Disciplined Pressers|The Grinders':                            'Iron Midfield',
  'Disciplined Pressers|Tiki-Taka':                               'Positional Play',
  'Elite Dominators|Gegenpressing':                               'Suffocating Elite',
  'Elite Dominators|Long Ball Counter':                           'Calculated Directness',
  'Elite Dominators|Out Wide':                                    'Expansive Elite',
  'Elite Dominators|Quick Counter':                               'Dual Threat',
  'Elite Dominators|Set-Piece Specialists':                       'Every Angle',
  'Elite Dominators|Shoot-on-Sight':                             'Relentless',
  'Elite Dominators|The Grinders':                                'Ruthless Machine',
  'Elite Dominators|Tiki-Taka':                                   'Orchestral Control',
  'Gegenpressing|Long Ball Counter':                              'Chaotic Directness',
  'Gegenpressing|Out Wide':                                       'Wing Press',
  'Gegenpressing|Quick Counter':                                  'Vertical Press',
  'Gegenpressing|Set-Piece Specialists':                          'Press & Pounce',
  'Gegenpressing|Shoot-on-Sight':                                 'Trigger-Happy Presser',
  'Gegenpressing|The Grinders':                                   'Heavy Metal',
  'Gegenpressing|Tiki-Taka':                                      'Total Football',
  'Long Ball Counter|Out Wide':                                   'Long Ball Wide',
  'Long Ball Counter|Quick Counter':                              'Direct Transition',
  'Long Ball Counter|Set-Piece Specialists':                      'Old School Direct',
  'Long Ball Counter|Shoot-on-Sight':                             'Route One Chaos',
  'Long Ball Counter|The Grinders':                               'Park the Bus',
  'Long Ball Counter|Tiki-Taka':                                  'False Patience',
  'Out Wide|Quick Counter':                                       'Flying Wingers',
  'Out Wide|Set-Piece Specialists':                               'Cross & Corner',
  'Out Wide|Shoot-on-Sight':                                      'Wide & Ruthless',
  'Out Wide|The Grinders':                                        'Physical Width',
  'Out Wide|Tiki-Taka':                                           'Expansive Possession',
  'Quick Counter|Set-Piece Specialists':                          'Counter & Dead Ball',
  'Quick Counter|Shoot-on-Sight':                                 'Shock & Awe',
  'Quick Counter|The Grinders':                                   'Combative Counter',
  'Quick Counter|Tiki-Taka':                                      'Fluid Attack',
  'Set-Piece Specialists|Shoot-on-Sight':                         'Dead Ball Shooters',
  'Set-Piece Specialists|The Grinders':                           'Set-Piece Machine',
  'Set-Piece Specialists|Tiki-Taka':                              'Complete Technicians',
  'Shoot-on-Sight|The Grinders':                                  'Brute Force',
  'Shoot-on-Sight|Tiki-Taka':                                     'Rondo & Fire',
  'The Grinders|Tiki-Taka':                                       'Beautiful Brutality',

  // ── 3-way (120) ──────────────────────────────────────────────────────────
  // Anchor: Disciplined Pressers (36)
  'Disciplined Pressers|Elite Dominators|Gegenpressing':          'Total Press',
  'Disciplined Pressers|Elite Dominators|Long Ball Counter':      'Controlled Directness',
  'Disciplined Pressers|Elite Dominators|Out Wide':               'Structured Width',
  'Disciplined Pressers|Elite Dominators|Quick Counter':          'Smart Predators',
  'Disciplined Pressers|Elite Dominators|Set-Piece Specialists':  'Precision Dead Ball',
  'Disciplined Pressers|Elite Dominators|Shoot-on-Sight':         'Intelligent Marksmen',
  'Disciplined Pressers|Elite Dominators|The Grinders':           'Calculated Warriors',
  'Disciplined Pressers|Elite Dominators|Tiki-Taka':              'Surgical Dominance',
  'Disciplined Pressers|Gegenpressing|Long Ball Counter':         'Press & Go Long',
  'Disciplined Pressers|Gegenpressing|Out Wide':                  'Pressing Width',
  'Disciplined Pressers|Gegenpressing|Quick Counter':             'High Press Machine',
  'Disciplined Pressers|Gegenpressing|Set-Piece Specialists':     'Complete Defensive Press',
  'Disciplined Pressers|Gegenpressing|Shoot-on-Sight':            'Press & Fire',
  'Disciplined Pressers|Gegenpressing|The Grinders':              'Total Intensity',
  'Disciplined Pressers|Gegenpressing|Tiki-Taka':                 'Total Control',
  'Disciplined Pressers|Long Ball Counter|Out Wide':              'Wide Pragmatism',
  'Disciplined Pressers|Long Ball Counter|Quick Counter':         'Triple Counter',
  'Disciplined Pressers|Long Ball Counter|Set-Piece Specialists': 'Dead Ball Pragmatism',
  'Disciplined Pressers|Long Ball Counter|Shoot-on-Sight':        'Shooting Pragmatism',
  'Disciplined Pressers|Long Ball Counter|The Grinders':          'Physical Pragmatism',
  'Disciplined Pressers|Long Ball Counter|Tiki-Taka':             'Intelligent Directness',
  'Disciplined Pressers|Out Wide|Quick Counter':                  'Wide Calculated Counter',
  'Disciplined Pressers|Out Wide|Set-Piece Specialists':          'Complete Wide Intelligence',
  'Disciplined Pressers|Out Wide|Shoot-on-Sight':                 'Intelligent Wide Shooters',
  'Disciplined Pressers|Out Wide|The Grinders':                   'Wide Iron Midfield',
  'Disciplined Pressers|Out Wide|Tiki-Taka':                      'Wide Positional Play',
  'Disciplined Pressers|Quick Counter|Set-Piece Specialists':     'Tactical Counter Dead Ball',
  'Disciplined Pressers|Quick Counter|Shoot-on-Sight':            'Calculated Fire',
  'Disciplined Pressers|Quick Counter|The Grinders':              'Physical Calculated Counter',
  'Disciplined Pressers|Quick Counter|Tiki-Taka':                 'The Complete System',
  'Disciplined Pressers|Set-Piece Specialists|Shoot-on-Sight':    'Disciplined Chaos',
  'Disciplined Pressers|Set-Piece Specialists|The Grinders':      'Physical Dead Ball Midfield',
  'Disciplined Pressers|Set-Piece Specialists|Tiki-Taka':         'Tactical Dead Ball',
  'Disciplined Pressers|Shoot-on-Sight|The Grinders':             'Iron Fire',
  'Disciplined Pressers|Shoot-on-Sight|Tiki-Taka':                'Structured Shooting',
  'Disciplined Pressers|The Grinders|Tiki-Taka':                  'Tactical Muscle',
  // Anchor: Elite Dominators (28)
  'Elite Dominators|Gegenpressing|Long Ball Counter':             'Pragmatic Elite',
  'Elite Dominators|Gegenpressing|Out Wide':                      'Elite Pressing Width',
  'Elite Dominators|Gegenpressing|Quick Counter':                 'High Press Predators',
  'Elite Dominators|Gegenpressing|Set-Piece Specialists':         'Total Domination',
  'Elite Dominators|Gegenpressing|Shoot-on-Sight':                'High Press Marksmen',
  'Elite Dominators|Gegenpressing|The Grinders':                  'Iron Fist',
  'Elite Dominators|Gegenpressing|Tiki-Taka':                     'The Pep System',
  'Elite Dominators|Long Ball Counter|Out Wide':                  'Direct Wide Elite',
  'Elite Dominators|Long Ball Counter|Quick Counter':             'Transition Masters',
  'Elite Dominators|Long Ball Counter|Set-Piece Specialists':     'The Colossus',
  'Elite Dominators|Long Ball Counter|Shoot-on-Sight':            'Direct Fire',
  'Elite Dominators|Long Ball Counter|The Grinders':              'Impenetrable',
  'Elite Dominators|Long Ball Counter|Tiki-Taka':                 'Velvet Directness',
  'Elite Dominators|Out Wide|Quick Counter':                      'Wide Elite Counter',
  'Elite Dominators|Out Wide|Set-Piece Specialists':              'Wing Specialists',
  'Elite Dominators|Out Wide|Shoot-on-Sight':                     'Wide Fire',
  'Elite Dominators|Out Wide|The Grinders':                       'Wide Warriors',
  'Elite Dominators|Out Wide|Tiki-Taka':                          'The Full Field',
  'Elite Dominators|Quick Counter|Set-Piece Specialists':         'Complete Counter',
  'Elite Dominators|Quick Counter|Shoot-on-Sight':                'Lightning',
  'Elite Dominators|Quick Counter|The Grinders':                  'Physical Elite Counter',
  'Elite Dominators|Quick Counter|Tiki-Taka':                     'False Security',
  'Elite Dominators|Set-Piece Specialists|Shoot-on-Sight':        'Elite Dead Ball Shooters',
  'Elite Dominators|Set-Piece Specialists|The Grinders':          'Aerial Dominators',
  'Elite Dominators|Set-Piece Specialists|Tiki-Taka':             'Gold Standard',
  'Elite Dominators|Shoot-on-Sight|The Grinders':                 'Overwhelming Force',
  'Elite Dominators|Shoot-on-Sight|Tiki-Taka':                    'No Mercy',
  'Elite Dominators|The Grinders|Tiki-Taka':                      'Velvet Hammer',
  // Anchor: Gegenpressing (21)
  'Gegenpressing|Long Ball Counter|Out Wide':                     'Chaotic Width',
  'Gegenpressing|Long Ball Counter|Quick Counter':                'Counter Chaos',
  'Gegenpressing|Long Ball Counter|Set-Piece Specialists':        'Chaotic Dead Ball',
  'Gegenpressing|Long Ball Counter|Shoot-on-Sight':               'Route One Presser',
  'Gegenpressing|Long Ball Counter|The Grinders':                 'Pure Chaos',
  'Gegenpressing|Long Ball Counter|Tiki-Taka':                    'Desperate Measures',
  'Gegenpressing|Out Wide|Quick Counter':                         'Wide Vertical Press',
  'Gegenpressing|Out Wide|Set-Piece Specialists':                 'Wide Press Dead Ball',
  'Gegenpressing|Out Wide|Shoot-on-Sight':                        'Wide Press Fire',
  'Gegenpressing|Out Wide|The Grinders':                          'Physical Wide Presser',
  'Gegenpressing|Out Wide|Tiki-Taka':                             'Modern Masterclass',
  'Gegenpressing|Quick Counter|Set-Piece Specialists':            'Pressing Dead Ball',
  'Gegenpressing|Quick Counter|Shoot-on-Sight':                   'Vertical Fire',
  'Gegenpressing|Quick Counter|The Grinders':                     'Physical Vertical Press',
  'Gegenpressing|Quick Counter|Tiki-Taka':                        'Pressing Transition',
  'Gegenpressing|Set-Piece Specialists|Shoot-on-Sight':           'Press, Pounce & Fire',
  'Gegenpressing|Set-Piece Specialists|The Grinders':             'Aerial Heavy Metal',
  'Gegenpressing|Set-Piece Specialists|Tiki-Taka':                'Flawless Pressing',
  'Gegenpressing|Shoot-on-Sight|The Grinders':                    'Heavy Metal Fire',
  'Gegenpressing|Shoot-on-Sight|Tiki-Taka':                       'Press & Blast',
  'Gegenpressing|The Grinders|Tiki-Taka':                         'Intense Total Football',
  // Anchor: Long Ball Counter (15)
  'Long Ball Counter|Out Wide|Quick Counter':                     'Wide Direct Transition',
  'Long Ball Counter|Out Wide|Set-Piece Specialists':             'Wide Direct Dead Ball',
  'Long Ball Counter|Out Wide|Shoot-on-Sight':                    'Long Ball Wide Fire',
  'Long Ball Counter|Out Wide|The Grinders':                      'Wide Park the Bus',
  'Long Ball Counter|Out Wide|Tiki-Taka':                         'Patient Width',
  'Long Ball Counter|Quick Counter|Set-Piece Specialists':        'Dead Ball Direct Transition',
  'Long Ball Counter|Quick Counter|Shoot-on-Sight':               'Chaotic Transition',
  'Long Ball Counter|Quick Counter|The Grinders':                 'Physical Direct Transition',
  'Long Ball Counter|Quick Counter|Tiki-Taka':                    'Multi-Dimensional Attack',
  'Long Ball Counter|Set-Piece Specialists|Shoot-on-Sight':       'Direct Dead Ball Fire',
  'Long Ball Counter|Set-Piece Specialists|The Grinders':         'Fort Knox',
  'Long Ball Counter|Set-Piece Specialists|Tiki-Taka':            'Patient Set Pieces',
  'Long Ball Counter|Shoot-on-Sight|The Grinders':                'Chaos Bus',
  'Long Ball Counter|Shoot-on-Sight|Tiki-Taka':                   'Patient Fire',
  'Long Ball Counter|The Grinders|Tiki-Taka':                     'Deceptive Muscle',
  // Anchor: Out Wide (10)
  'Out Wide|Quick Counter|Set-Piece Specialists':                 'Flying Dead Ball Wingers',
  'Out Wide|Quick Counter|Shoot-on-Sight':                        'Flying Fire',
  'Out Wide|Quick Counter|The Grinders':                          'Wide Combative Counter',
  'Out Wide|Quick Counter|Tiki-Taka':                             'Wide Fluid Attack',
  'Out Wide|Set-Piece Specialists|Shoot-on-Sight':                'Maximum Attack',
  'Out Wide|Set-Piece Specialists|The Grinders':                  'Physical Wide Dead Ball',
  'Out Wide|Set-Piece Specialists|Tiki-Taka':                     'Complete Possession Attack',
  'Out Wide|Shoot-on-Sight|The Grinders':                         'Physical Wide Fire',
  'Out Wide|Shoot-on-Sight|Tiki-Taka':                            'Wide Possession Fire',
  'Out Wide|The Grinders|Tiki-Taka':                              'Expansive Brutality',
  // Anchor: Quick Counter (6)
  'Quick Counter|Set-Piece Specialists|Shoot-on-Sight':           'Counter Dead Ball Fire',
  'Quick Counter|Set-Piece Specialists|The Grinders':             'Physical Counter Dead Ball',
  'Quick Counter|Set-Piece Specialists|Tiki-Taka':                'Creative Dead Ball',
  'Quick Counter|Shoot-on-Sight|The Grinders':                    'Combative Fire',
  'Quick Counter|Shoot-on-Sight|Tiki-Taka':                       'Possess & Blast',
  'Quick Counter|The Grinders|Tiki-Taka':                         'Physical Fluid Attack',
  // Anchor: Set-Piece Specialists (3)
  'Set-Piece Specialists|Shoot-on-Sight|The Grinders':            'Brute Force Dead Ball',
  'Set-Piece Specialists|Shoot-on-Sight|Tiki-Taka':               'Technical Total',
  'Set-Piece Specialists|The Grinders|Tiki-Taka':                 'Technical Muscle',
  // Anchor: Shoot-on-Sight (1)
  'Shoot-on-Sight|The Grinders|Tiki-Taka':                        'Beautiful Chaos',
}

export function getTeamCombination(profiles: DNAProfile[]): DNACombination | null {
  if (profiles.length < 2) return null
  const key = profiles.map((p) => p.label).sort().join('|')
  const name = COMBINATION_MAP[key]
  if (!name) return null
  const avgScore = profiles.reduce((sum, p) => sum + p.score, 0) / profiles.length
  return { name, level: scoreToLevel(avgScore), score: avgScore }
}

// ── Public API ───────────────────────────────────────────────────────────────
export function getTeamDNA(stats: TeamStats): DNAProfile[] {
  const scored = DNA_PROFILES
    .map((p) => ({ ...p, s: p.score(stats) }))
    .sort((a, b) => b.s - a.s)

  // Return all profiles scoring >= 0.45, up to 3 labels; always at least 1
  const strong = scored.filter((p) => p.s >= 0.45).slice(0, 3)
  const result = strong.length > 0 ? strong : [scored[0]]

  return result.map(({ label, emoji, color, s }) => ({
    label,
    emoji,
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
