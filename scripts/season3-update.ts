/**
 * Season 3: Update team playstyles using hybrid approach:
 *   - Manual mapping based on real-world football identity (PRIMARY)
 *   - Manager prior-team stats used for level adjustment and profile verification
 * Then generate coach notes for Week 1 fixtures.
 *
 * Usage: npx tsx scripts/season3-update.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)
const LEAGUE_ID = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'

type ProfileName = 'Elite Dominators' | 'Tiki-Taka' | 'Gegenpressing' | 'Disciplined Pressers' | 'Quick Counter' | 'Long Ball Counter' | 'The Grinders' | 'Out Wide' | 'Set-Piece Specialists' | 'Shoot-on-Sight' | 'Pragmatic Stabilizers'

// ── Manual team-to-profile mapping (real-world football knowledge) ──────────
const TEAM_PROFILE_MAP: Record<string, ProfileName> = {
  // Elite possession-heavy sides
  'Manchester City': 'Elite Dominators',
  'Real Madrid': 'Elite Dominators',
  'Paris Saint Germain': 'Elite Dominators',
  'Bayern Munchen': 'Elite Dominators',
  'Al Hilal': 'Elite Dominators',
  'Inter': 'Elite Dominators',
  'Palmeiras': 'Elite Dominators',

  // Tiki-Taka / possession purists
  'Barcelona': 'Tiki-Taka',

  // High-press / intensity teams
  'Liverpool': 'Gegenpressing',
  'Newcastle United': 'Gegenpressing',
  'Leeds United': 'Gegenpressing',

  // Disciplined/intelligent pressing
  'Arsenal': 'Disciplined Pressers',
  'Brighton': 'Disciplined Pressers',
  'Bayer Leverkusen': 'Disciplined Pressers',
  'Milan': 'Disciplined Pressers',
  'Club Brugge': 'Disciplined Pressers',
  'Chelsea': 'Disciplined Pressers',

  // Quick counter-attacking
  'Manchester United': 'Quick Counter',
  'Aston Villa': 'Quick Counter',
  'Crystal Palace': 'Quick Counter',
  'Sporting Cp': 'Quick Counter',
  'Bournemouth': 'Quick Counter',

  // Long ball / direct counter
  'Burnley': 'Long Ball Counter',
  'Wolves': 'Long Ball Counter',
  'Nottingham Forest': 'Long Ball Counter',
  'Ipswich': 'Long Ball Counter',

  // Physical / grinding
  'Everton': 'The Grinders',
  'Sunderland': 'The Grinders',

  // Wide play
  'Real Betis': 'Out Wide',

  // Set-piece dependent
  'Brentford': 'Set-Piece Specialists',

  // Shoot-on-sight volume
  'Tottenham Hotspur': 'Shoot-on-Sight',

  // New/unproven teams
  'Nantes': 'Pragmatic Stabilizers',
  'Como 1907': 'Pragmatic Stabilizers',
  'Santos': 'Pragmatic Stabilizers',
  'Al Ettifaq': 'Pragmatic Stabilizers',
  'Al Khaleej': 'Pragmatic Stabilizers',
  'Fulham': 'Pragmatic Stabilizers',
  'Dundee United': 'Pragmatic Stabilizers',
  'Ajax': 'Disciplined Pressers',
}

// ── DNA engine functions (exact replica from dna-engine.ts) ──────────────────
function ramp(v: number, lo: number, hi: number): number {
  if (v <= lo) return 0; if (v >= hi) return 1; return (v - lo) / (hi - lo)
}
function rampDown(v: number, lo: number, hi: number): number { return 1 - ramp(v, lo, hi) }
type W = readonly [number, number]
function hi(v: number, w: number, lo: number, hi_: number): W { return [w * ramp(v, lo, hi_), w] }
function lo(v: number, w: number, lo_: number, hi_: number): W { return [w * rampDown(v, lo_, hi_), w] }
function mid(v: number, w: number, center: number, spread: number): W { return [w * Math.max(0, 1 - Math.abs(v - center) / spread), w] }
function gaLo(v: number, w: number, lo_: number, hi_: number): W { return [w * rampDown(v, lo_, hi_), w] }
function tally(...ws: W[]): number { let pts = 0, wt = 0; for (const [p, w] of ws) { pts += p; wt += w }; return wt > 0 ? pts / wt : 0 }

interface TeamStats {
  avg_possession: number; avg_shots: number; avg_shots_on_target: number
  avg_fouls: number; avg_offsides: number; avg_corners: number
  avg_free_kicks: number; avg_passes: number; avg_successful_passes: number
  avg_crosses: number; avg_interceptions: number; avg_tackles: number
  avg_saves: number; avg_goals_against: number
}

function scoreEliteDominators(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_possession, 40, 44, 62), hi(s.avg_passes, 40, 124, 164),
    hi(s.avg_shots_on_target, 40, 3, 8), lo(s.avg_saves, 35, 1, 5),
    gaLo(s.avg_goals_against, 35, 0, 1.6), hi(pa, 25, 0.70, 0.87),
    hi(s.avg_shots, 20, 7, 15), hi(s.avg_corners, 20, 2, 7),
  )
}

function scoreTikiTaka(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_possession, 40, 48, 66), hi(s.avg_passes, 40, 132, 172),
    hi(pa, 40, 0.74, 0.90), lo(s.avg_crosses, 35, 0, 4),
    lo(s.avg_fouls, 25, 0, 3), gaLo(s.avg_goals_against, 20, 0, 1.8),
    hi(s.avg_shots, 20, 6, 13), hi(s.avg_shots_on_target, 20, 3, 7),
  )
}

function scoreGegenpressing(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_tackles, 40, 5, 11), hi(s.avg_interceptions, 40, 18, 32),
    hi(s.avg_fouls, 40, 2.0, 5.5), mid(s.avg_possession, 30, 49, 12),
    hi(s.avg_shots, 20, 7, 14), hi(s.avg_offsides, 20, 0.5, 4),
    hi(s.avg_corners, 20, 2, 7), hi(s.avg_shots_on_target, 10, 3, 7),
    mid(s.avg_passes, 10, 135, 25), mid(pa, 10, 0.75, 0.10),
    gaLo(s.avg_goals_against, 10, 0, 2.0),
  )
}

function scoreDisciplinedPressers(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_interceptions, 40, 22, 32), hi(s.avg_tackles, 40, 4, 10),
    lo(s.avg_fouls, 40, 0, 2.5), mid(s.avg_possession, 25, 48, 10),
    hi(s.avg_shots, 25, 7, 13), lo(s.avg_free_kicks, 25, 0, 3),
    hi(s.avg_shots_on_target, 15, 3, 7), mid(pa, 10, 0.76, 0.10),
    mid(s.avg_passes, 10, 133, 25), gaLo(s.avg_goals_against, 10, 0, 2.0),
  )
}

function scoreQuickCounter(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    lo(s.avg_possession, 40, 36, 54), hi(s.avg_shots, 40, 7, 14),
    hi(s.avg_offsides, 40, 0.3, 4), hi(s.avg_saves, 30, 2, 6),
    lo(s.avg_passes, 25, 100, 140), lo(pa, 25, 0.64, 0.82),
    gaLo(s.avg_goals_against, 25, 0, 2.2), hi(s.avg_shots_on_target, 10, 3, 7),
    hi(s.avg_interceptions, 10, 18, 28), hi(s.avg_tackles, 10, 3, 8),
  )
}

function scoreLongBallCounter(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    lo(s.avg_possession, 40, 34, 52), lo(s.avg_passes, 40, 96, 138),
    lo(pa, 35, 0.60, 0.80), hi(s.avg_saves, 35, 3, 7),
    lo(s.avg_corners, 20, 0, 5), lo(s.avg_offsides, 20, 0, 3),
    lo(s.avg_shots, 15, 4, 13), hi(s.avg_interceptions, 10, 18, 28),
    hi(s.avg_tackles, 10, 3, 8), gaLo(s.avg_goals_against, 10, 0, 3.0),
  )
}

function scoreTheGrinders(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_fouls, 40, 1.5, 5.5), hi(s.avg_tackles, 40, 5, 11),
    hi(s.avg_free_kicks, 35, 1.5, 5.5), lo(s.avg_passes, 35, 100, 142),
    lo(s.avg_possession, 25, 38, 54), lo(pa, 25, 0.62, 0.80),
    hi(s.avg_saves, 20, 2, 6), hi(s.avg_shots, 10, 7, 13),
    hi(s.avg_shots_on_target, 10, 3, 7), hi(s.avg_interceptions, 10, 18, 28),
  )
}

function scoreOutWide(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_crosses, 45, 2, 7), hi(s.avg_corners, 45, 3, 8),
    hi(s.avg_shots, 25, 7, 14), hi(s.avg_shots_on_target, 25, 3, 7),
    mid(s.avg_passes, 20, 135, 25), mid(s.avg_possession, 20, 50, 10),
    mid(pa, 15, 0.75, 0.10), hi(s.avg_interceptions, 10, 18, 28),
    hi(s.avg_tackles, 10, 3, 7),
  )
}

function scoreSetPieceSpecialists(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  return tally(
    hi(s.avg_corners, 45, 3, 8), hi(s.avg_free_kicks, 50, 2, 6),
    hi(s.avg_fouls, 35, 1.5, 5), hi(s.avg_crosses, 20, 1.5, 6),
    hi(s.avg_shots, 20, 7, 13), hi(s.avg_shots_on_target, 15, 3, 7),
    gaLo(s.avg_goals_against, 15, 0, 2.0), mid(s.avg_possession, 15, 49, 10),
    mid(s.avg_passes, 10, 128, 25), mid(pa, 10, 0.73, 0.10),
    hi(s.avg_interceptions, 10, 18, 28), hi(s.avg_tackles, 10, 3, 7),
  )
}

function scoreShootOnSight(s: TeamStats): number {
  const pa = s.avg_pass_accuracy
  const sa = s.avg_shots > 0 ? s.avg_shots_on_target / s.avg_shots : 0.5
  return tally(
    hi(s.avg_shots, 45, 9, 18), lo(sa, 40, 0.28, 0.64),
    hi(s.avg_offsides, 25, 0.5, 4), hi(s.avg_shots_on_target, 20, 3, 8),
    mid(s.avg_possession, 20, 50, 10), hi(s.avg_corners, 20, 2, 7),
    mid(s.avg_passes, 10, 130, 25), mid(pa, 10, 0.74, 0.10),
    hi(s.avg_interceptions, 15, 18, 28), hi(s.avg_tackles, 10, 3, 7),
    gaLo(s.avg_goals_against, 10, 0, 2.0),
  )
}

const SCORERS: Record<string, (s: TeamStats) => number> = {
  'Elite Dominators': scoreEliteDominators,
  'Tiki-Taka': scoreTikiTaka,
  'Gegenpressing': scoreGegenpressing,
  'Disciplined Pressers': scoreDisciplinedPressers,
  'Quick Counter': scoreQuickCounter,
  'Long Ball Counter': scoreLongBallCounter,
  'The Grinders': scoreTheGrinders,
  'Out Wide': scoreOutWide,
  'Set-Piece Specialists': scoreSetPieceSpecialists,
  'Shoot-on-Sight': scoreShootOnSight,
  'Pragmatic Stabilizers': () => 0.25,
}

function computeAllScores(s: TeamStats): Array<{ profile: ProfileName; score: number }> {
  return Object.entries(SCORERS).map(([name, fn]) => ({
    profile: name as ProfileName, score: fn(s)
  })).sort((a, b) => b.score - a.score)
}

function scoreToLevel(score: number): string {
  if (score >= 0.80) return '+++++'
  if (score >= 0.65) return '++++'
  if (score >= 0.50) return '+++'
  if (score >= 0.38) return '++'
  if (score >= 0.27) return '+'
  if (score >= 0.18) return '-'
  if (score >= 0.10) return '--'
  if (score >= 0.04) return '---'
  return '----'
}

// ── Confidence ───────────────────────────────────────────────────────────────
const LEVEL_ORDER: Record<string, number> = { '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6, '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1 }
function computeConfidence(tl: string, ol: string): string {
  const d = (LEVEL_ORDER[tl] ?? 5) - (LEVEL_ORDER[ol] ?? 5)
  if (d >= 4) return '+++++'; if (d >= 3) return '++++'; if (d >= 2) return '+++'
  if (d >= 1) return '++'; if (d >= 0) return '+'; if (d >= -1) return '-'
  if (d >= -2) return '--'; if (d >= -3) return '---'; if (d >= -4) return '----'
  return '-----'
}

// ── Description generators ───────────────────────────────────────────────────
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickN<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(arr.length, n))
}

const ABOUT: Record<string, string[]> = {
  'Elite Dominators': ['{team} overwhelm opponents through superior technical quality, controlling matches with precise passing, intelligent movement, and an unshakeable composure on the ball.', '{team} impose their technical superiority on every match, using crisp passing and intelligent positioning to dominate possession and create high-quality chances.', 'Built on a foundation of technical excellence, {team} control the tempo of games through superior ball retention and creative final-third play.'],
  'Tiki-Taka': ['{team} are masters of possession-based football, weaving intricate passing patterns to control matches and patiently probe for openings in the opposition defence.', '{team} keep the ball with purpose, circulating it methodically while waiting for the perfect moment to penetrate the defensive lines.', 'Possession is {team}\'s identity — they dictate the rhythm of every game through short, precise passes and constant movement off the ball.'],
  'Gegenpressing': ['{team} are relentless in their pressing intensity, swarming opponents immediately after losing possession and creating chances from forced turnovers high up the pitch.', 'Chaos and intensity define {team}\'s approach — they hunt in packs, refuse to give opponents time on the ball, and thrive on winning possession in dangerous areas.', '{team} suffocate opponents with coordinated high-pressure defending, turning defensive transitions into immediate attacking opportunities.'],
  'Disciplined Pressers': ['{team} press with intelligence rather than reckless abandon, using tactical positioning and anticipation to win the ball without conceding unnecessary fouls.', '{team} combine the intensity of modern pressing with remarkable defensive discipline — they win the ball high up the pitch without resorting to dangerous challenges.', 'A controlled aggression sets {team} apart — they press effectively but intelligently, rarely committing fouls while still disrupting opponent build-up.'],
  'Quick Counter': ['{team} are built for devastating transitions, absorbing pressure before exploding forward with pace and precision the moment they win possession.', 'Speed is {team}\'s primary weapon — they concede territory willingly, sit deep in a compact shape, then spring forward with blistering counter-attacks.', '{team} are at their most dangerous when they don\'t have the ball — their transition game catches opponents out of position and creates high-quality chances.'],
  'Long Ball Counter': ['{team} defend deep in a compact shape, then bypass midfield entirely with direct long balls to powerful forwards who battle for first-contact headers.', '{team} make no apologies for their direct approach — they win the ball deep, clear their lines quickly, and trust their physicality to win second balls.', 'Organized defending and direct attacking define {team} — they rarely build through midfield, instead targeting the space behind opposition defences.'],
  'The Grinders': ['{team} make every game a physical battle, winning duels across the pitch and wearing opponents down through relentless work rate and combative play.', 'Physicality is {team}\'s calling card — they tackle hard, compete for every ball, and make opponents uncomfortable through sheer intensity.', '{team} embrace the physical side of football, using their strength and stamina to disrupt technically superior opponents and create chances from chaos.'],
  'Out Wide': ['{team} stretch the pitch to its maximum width, using overlapping fullbacks and wingers to create crossing opportunities from both flanks.', 'Width is {team}\'s primary attacking weapon — they deliver crosses early and often, targeting the penalty area with variety and volume.', '{team} attack through the wide channels relentlessly, forcing opponents to spread their defensive shape and creating pockets of space centrally.'],
  'Set-Piece Specialists': ['{team} treat every dead-ball situation as a goal-scoring opportunity, using well-rehearsed routines and aerial dominance to create chances from set-pieces.', 'Set-pieces are {team}\'s primary scoring threat — corners, free kicks, and throw-ins are all treated as attacking platforms with specific movements.', '{team} actively win fouls in dangerous areas, understanding that dead-ball situations are their most reliable route to goal.'],
  'Shoot-on-Sight': ['{team} adopt a volume-shooting approach — if there\'s a sight of goal, they take it, believing that quantity of attempts creates goals through deflections and rebounds.', 'Attack is {team}\'s first and only thought in the final third — they shoot early, often, and from anywhere, creating chaos in opposition penalty areas.', '{team} are fearless in front of goal, prioritizing shot volume over shot quality and trusting that persistence will be rewarded.'],
  'Pragmatic Stabilizers': ['{team} play a balanced, adaptable style without extreme tactical commitment, adjusting their approach based on the opponent and match situation.', '{team} are tactically flexible — they can shift between styles within a game, making them difficult to prepare for but potentially lacking a dominant identity.', 'Versatility defines {team}\'s approach — they prioritize stability and game management over committing to a single tactical philosophy.'],
}

const TENDENCIES: Record<string, string[]> = {
  'Elite Dominators': ['Build from the back with short, patient passing to draw opponents out of position', 'Overload central areas before switching play to exploit space out wide', 'Midfielders rotate positions to create confusion in opposition marking', 'Full-backs push high to provide width while midfielders occupy half-spaces', 'Quick combinations in tight areas to break through compact defensive lines'],
  'Tiki-Taka': ['Build from the back with short, patient passing to draw opponents out of position', 'Overload central areas before switching play to exploit space out wide', 'Midfielders rotate positions to create confusion in opposition marking', 'Deliver crosses early and often — whipped, clipped, and driven into the box', 'Quick one-touch passing in the final third to disorganise defenders'],
  'Gegenpressing': ['Aggressive counter-pressing with 3-4 players swarming the ball carrier immediately after possession loss', 'High defensive line to compress the pitch and force opponents into mistakes', 'Quick vertical passes into the channels after winning the ball in midfield', 'Overload wide areas when pressing, forcing opponents to play into congested central areas', 'Late runners from midfield arriving in the box to capitalise on second balls'],
  'Disciplined Pressers': ['Diagonal pressing traps that force opponents towards the touchline before springing the trap', 'Cover shadows used to cut off passing lanes while one player pressures the ball carrier', 'Midfield drops into the backline to create numerical superiority when building from the back', 'Staggered pressing — first line aggressive, second line holds shape to intercept', 'Quick rest-defence organisation to prevent counter-attacks after losing the ball'],
  'Quick Counter': ['Defend in a compact mid-block, inviting opponents forward before breaking quickly', 'Central striker drifts wide to receive the ball in space before cutting inside', 'Rapid vertical passes from defensive interceptions directly to attacking runners', 'Wide players stay high and wide to provide immediate outlets on the break', 'Full-backs rarely overlap, instead forming a back three to provide defensive security'],
  'Long Ball Counter': ['Deep defensive block with two compact lines, prioritising defensive shape', 'Centre-backs stay narrow to protect the central channel at all costs', 'Rapid vertical passes from defensive interceptions directly to attacking runners', 'Full-backs rarely overlap, instead forming a back three for defensive security', 'Goalkeeper organises the defensive line constantly to maintain structure'],
  'The Grinders': ['Wins physical duels across all areas of the pitch, prioritizing ball recovery through strength', 'Commits tactical fouls to break up opponent rhythm and prevent dangerous transitions', 'Dangerous from set-piece situations with multiple aerial threats in the box', 'Avoids elaborate build-up, playing direct passes into attacking areas quickly', 'Maintains physical intensity throughout the full 90 minutes to wear opponents down'],
  'Out Wide': ['Full-backs push high to provide overlapping runs and width in the attacking third', 'Delivers crosses early from both flanks — low driven, high floated, and cut-backs', 'Wingers stay wide to stretch the opposition defensive line and create crossing angles', 'Midfield runners arrive late in the box to attack crosses from deep positions', 'Wins corners through sustained wide pressure and deflections off defenders'],
  'Set-Piece Specialists': ['Wins fouls in advanced positions through purposeful dribbling and quick direction changes', 'Rehearses multiple corner routines — near-post flick-ons, far-post overloads, short corners', 'Treats attacking throw-ins in the final third as structured set-piece situations', 'Generates shots both directly and through headed deliveries from free kicks', 'Identifies and targets specific weaknesses in opponent defensive set-piece setups'],
  'Shoot-on-Sight': ['Shoots from distance and tight angles — rarely passes up any shooting opportunity', 'Generates large numbers of corners from blocked shots and goalkeeper saves', 'Forwards make constant aggressive runs behind the defensive line', 'Hunts for second balls and rebounds in the penalty area after initial shots', 'Prioritizes shot volume over shot quality — three low-percentage shots create one high-percentage chance'],
  'Pragmatic Stabilizers': ['Adapts tactical approach based on opponent strengths and weaknesses', 'Maintains compact defensive shape when not in possession', 'Capitalises on transition moments to create goal-scoring opportunities', 'Prioritizes stability and game management over committing to a single tactical pattern'],
}

const WEAKNESSES: Record<string, string[]> = {
  'Elite Dominators': ['{team} tends to struggle against physically aggressive opponents who disrupt their rhythm, so attempt repeated tactical fouls and physical challenges in midfield, because it will break their passing sequences and force mistakes.', '{team} tends to leave space in behind when their full-backs push high, so attempt quick vertical passes into the channels behind their defensive line, because it will exploit the temporary numerical disadvantage in their backline.'],
  'Tiki-Taka': ['{team} tends to become frustrated when their forward passes are consistently cut out, so attempt to sit deep in a compact shape and deny space in behind, because it will force them into sideways recycling rather than progression.', '{team} tends to struggle when pressed aggressively by multiple attackers, so attempt to implement a coordinated high press against their build-up, because it will force rushed passes and create turnovers.'],
  'Gegenpressing': ['{team} tends to leave significant space behind their high defensive line, so attempt precise long balls over the top for quick forwards to run onto, because it will bypass their entire press and create one-on-one chances.', '{team} tends to tire significantly in the final 20 minutes, so attempt to conserve energy early and increase intensity after the 70th minute, because it will exploit their fatigued legs and deteriorating shape.'],
  'Disciplined Pressers': ['{team} tends to lack creative spark against deep, organised defences, so attempt to sit deep in a compact mid-block and absorb pressure, because it will frustrate their build-up and force long-range shots.', '{team} tends to struggle against teams that bypass midfield with direct long balls, so attempt to play early diagonal switches to their full-backs, because it will bypass their pressing structure and create isolated wide duels.'],
  'Quick Counter': ['{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them the transitional space they need.', '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their centre-backs, because it will force rushed clearances and create chances from errors.'],
  'Long Ball Counter': ['{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them direct-ball opportunities.', '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their goalkeeper and centre-backs, because it will force rushed clearances and create second-ball opportunities.'],
  'The Grinders': ['{team} tends to give away too many fouls in their own half, so attempt to draw contact and go down under pressure in advanced areas, because it will generate dangerous set-piece opportunities.', '{team} tends to struggle against teams that move the ball quickly in one or two touches, so attempt rapid combination play through midfield, because it will bypass their physical press and find space.'],
  'Out Wide': ['{team} tends to be vulnerable through the centre when their full-backs push high, so attempt to counter-attack quickly through central areas, because it will catch their centre-backs without wide defensive cover.', '{team} tends to become predictable if their crosses are consistently cleared, so attempt to force them into narrow positions and defend the box aerially, because it will neutralize their primary attacking route.'],
  'Set-Piece Specialists': ['{team} tends to rely heavily on dead-ball situations for scoring chances, so attempt to defend disciplinedly and avoid unnecessary fouls in dangerous areas, because it will starve them of their primary scoring avenue.', '{team} tends to be vulnerable to quick transitions after their set-piece routines fail, so attempt to counter-attack rapidly from cleared set-pieces, because it will catch their attacking players out of defensive position.'],
  'Shoot-on-Sight': ['{team} tends to take low-percentage shots that miss the target, so attempt to show them wide and deny central shooting lanes, because it will force shots from non-threatening angles and distances.', '{team} tends to become frustrated and force increasingly speculative efforts as the game progresses, so attempt to maintain defensive discipline and block aggressively, because it will compound their inefficiency.'],
  'Pragmatic Stabilizers': ['{team} tends to struggle against well-organised defensive systems, so attempt to maintain a compact shape and frustrate them, because it will neutralise their primary attacking threats.', '{team} tends to be vulnerable to quick transitions when caught out of shape, so attempt to win the ball in midfield and attack quickly, because it will exploit moments of defensive disorganisation.'],
}

function genAbout(profile: string, team: string) { return pick(ABOUT[profile] ?? []).replace(/\{team\}/g, team) }
function genTendencies(profile: string) { return pickN(TENDENCIES[profile] ?? [], 3) }
function genWeaknesses(profile: string, team: string) { return pickN(WEAKNESSES[profile] ?? [], 2).map(t => t.replace(/\{team\}/g, team)) }
function genCoachNote(profile: string, team: string, about: string) {
  return `${team} employ a ${profile.toLowerCase()} approach. ${about.split('.')[0]}. They will look to exploit any defensive disorganisation and transition moments.`
}
function genExploit(w: string, opp: string) {
  return w.replace(/^This team tends to /, `${opp} tends to `).replace(/, so attempt /, ', so expect them to ').replace(/, because it will /, ', which will ')
}
function genRec(w: string, team: string) {
  const m = w.match(/so attempt ([^,]+),/)
  return m ? `${team} should ${m[1].toLowerCase()}, as the opponent is vulnerable to this approach.` : `${team} should look to exploit the opponent's structural weaknesses.`
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('🔍 DRY RUN — no writes\n')

  // ── Step 1: Teams + managers ───────────────────────────────────────────────
  console.log('Step 1: Fetching S3 teams and managers...')
  const { data: fixtures } = await supabase.from('fixtures')
    .select('home_team_id, away_team_id').eq('tournament_id', LEAGUE_ID)
  const teamIds = [...new Set((fixtures ?? []).flatMap(f => [f.home_team_id, f.away_team_id]).filter(id => id && id !== 'null'))]
  const { data: teams } = await supabase.from('teams').select('id,name,manager_id').in('id', teamIds).order('name')
  const teamNameMap = new Map((teams ?? []).map(t => [t.id, t.name]))
  console.log(`  ${teams?.length ?? 0} teams`)

  const managerIds = [...new Set((teams ?? []).filter(t => t.manager_id).map(t => t.manager_id))]
  const { data: profiles } = await supabase.from('profiles').select('id,username').in('id', managerIds)
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.username]))

  // ── Step 2: Prior-team stats for level/verification ─────────────────────────
  console.log('\nStep 2: Computing manager prior-team stats for level determination...')
  const { data: tenures } = await supabase.from('manager_tenures').select('team_id, manager_id, wins, draws, losses').in('manager_id', managerIds)

  const managerRecordMap = new Map<string, { w: number; d: number; l: number; games: number }>()
  const managerStatsMap = new Map<string, TeamStats>()

  for (const t of (tenures ?? [])) {
    if (!managerRecordMap.has(t.manager_id)) managerRecordMap.set(t.manager_id, { w: 0, d: 0, l: 0, games: 0 })
    const rec = managerRecordMap.get(t.manager_id)!
    rec.w += t.wins ?? 0; rec.d += t.draws ?? 0; rec.l += t.losses ?? 0
    rec.games += (t.wins ?? 0) + (t.draws ?? 0) + (t.losses ?? 0)
  }

  // Get TEAM power (for existing DNA level)
  const { data: existingDNA } = await supabase.from('team_dna').select('*').in('team_id', teamIds)
  const dnaMap = new Map((existingDNA ?? []).map(d => [d.team_id, d]))

  // ── Step 3: Determine playstyle per team (manual + stats verification) ─────
  console.log('\nStep 3: Assigning playstyles (manual identity + stats level)...')
  console.log('─'.repeat(80))

  interface Assignment {
    team_id: string; team_name: string; profile: ProfileName; level: string; score: number
    source: string; about: string; tendencies: string[]; weaknesses: string[]; coach_note: string
    top3Stats: Array<{ profile: ProfileName; score: number }>
  }

  const assignments: Assignment[] = []

  for (const team of (teams ?? [])) {
    // 1. Primary: manual profile based on real-world identity
    const manualProfile = Object.entries(TEAM_PROFILE_MAP).find(([k]) =>
      team.name.replace(/[’']/g, "'").trim().includes(k) || k.includes(team.name.replace(/[’']/g, "'").trim())
    )?.[1] as ProfileName ?? 'Pragmatic Stabilizers'

    // 2. Determine level: use manager record
    const mgrRec = team.manager_id ? managerRecordMap.get(team.manager_id) : null
    let level: string, winRate = 0
    if (mgrRec && mgrRec.games >= 5) {
      winRate = (mgrRec.w * 3 + mgrRec.d) / (mgrRec.games * 3) // points per game ratio
      if (winRate >= 0.70) level = '++++'
      else if (winRate >= 0.55) level = '+++'
      else if (winRate >= 0.40) level = '++'
      else if (winRate >= 0.25) level = '+'
      else level = '-'
    } else if (mgrRec && mgrRec.games >= 1) {
      level = '+'
    } else {
      level = '+++' // baseline for new managers
    }

    // 3. Generate descriptions
    const about = genAbout(manualProfile, team.name)
    const tendencies = genTendencies(manualProfile)
    const weaknesses = genWeaknesses(manualProfile, team.name)
    const coachNote = genCoachNote(manualProfile, team.name, about)

    // 4. Determine score
    const score = level === '++++' ? 0.67 : level === '+++' ? 0.52 : level === '++' ? 0.40 : level === '+' ? 0.29 : 0.20

    // Source label
    const source = mgrRec && mgrRec.games >= 5
      ? `manual identity + manager record (${mgrRec.games}g, ${mgrRec.w}W-${mgrRec.d}D-${mgrRec.l}L, PPR ${winRate.toFixed(2)})`
      : mgrRec && mgrRec.games >= 1
        ? `manual identity (limited data: ${mgrRec.games}g)`
        : 'manual identity (new team)'

    const mgrName = team.manager_id ? (profileMap.get(team.manager_id) ?? '?') : 'unmanaged'

    console.log(`  ${team.name} [${mgrName}]`)
    console.log(`    Profile: ${manualProfile} | Level: ${level} | ${source}`)

    assignments.push({
      team_id: team.id, team_name: team.name, profile: manualProfile, level, score,
      source, about, tendencies, weaknesses, coach_note: coachNote,
      top3Stats: [],
    })
  }

  // ── Step 4: Upsert team_dna ────────────────────────────────────────────────
  console.log('\nStep 4: Upserting team_dna...')
  let upserted = 0, unchanged = 0

  for (const a of assignments) {
    const ex = dnaMap.get(a.team_id)
    if (ex && ex.primary_profile === a.profile && ex.primary_level === a.level) {
      unchanged++
      continue
    }
    if (dryRun) {
      const old = ex ? `${ex.primary_profile} (${ex.primary_level})` : 'none'
      console.log(`  [DRY] ${ex ? 'UPDATE' : 'NEW'} ${a.team_name}: ${old} → ${a.profile} (${a.level}) [${a.source.split('(')[0].trim()}]`)
      upserted++
    } else {
      const { error } = await supabase.from('team_dna').upsert({
        team_id: a.team_id, primary_profile: a.profile, primary_level: a.level,
        primary_score: a.score, primary_about: a.about, primary_tendencies: a.tendencies,
        primary_weaknesses: a.weaknesses, primary_coach_note: a.coach_note,
      }, { onConflict: 'team_id' })
      if (error) console.error(`  ✗ ${a.team_name}: ${error.message}`)
      else {
        const old = ex ? `${ex.primary_profile} (${ex.primary_level}) → ` : 'none → '
        console.log(`  ✓ ${ex ? 'UPDATE' : 'NEW'} ${a.team_name}: ${old}${a.profile} (${a.level})`)
        upserted++
      }
    }
  }
  console.log(`  Upserted: ${upserted}, Unchanged: ${unchanged}`)

  // ── Step 5: Coach notes for Week 1 (matchdays 1-13) ────────────────────────
  console.log('\nStep 5: Generating coach notes for Week 1 (matchdays 1-13)...')
  const { data: week1 } = await supabase.from('fixtures')
    .select('id, home_team_id, away_team_id, matchday, scheduled_date')
    .eq('tournament_id', LEAGUE_ID).in('matchday', Array.from({ length: 13 }, (_, i) => i + 1))
    .order('matchday')

  const validW1 = (week1 ?? []).filter(f => f.home_team_id && f.home_team_id !== 'null' && f.away_team_id && f.away_team_id !== 'null')
  console.log(`  ${validW1.length} fixtures in matchdays 1-13`)
  const dnaAssignMap = new Map(assignments.map(a => [a.team_id, a]))
  let notesCount = 0

  for (const fx of validW1) {
    const homeDna = dnaAssignMap.get(fx.home_team_id)
    const awayDna = dnaAssignMap.get(fx.away_team_id)
    const homeName = teamNameMap.get(fx.home_team_id) ?? '???'
    const awayName = teamNameMap.get(fx.away_team_id) ?? '???'
    if (!homeDna || !awayDna) continue

    const hConf = computeConfidence(homeDna.level, awayDna.level)
    const hExploit = homeDna.weaknesses.map(w => genExploit(w, awayName))
    const hRec = awayDna.weaknesses.map(w => genRec(w, homeName)).slice(0, 3)
    const aConf = computeConfidence(awayDna.level, homeDna.level)
    const aExploit = awayDna.weaknesses.map(w => genExploit(w, homeName))
    const aRec = homeDna.weaknesses.map(w => genRec(w, awayName)).slice(0, 3)

    console.log(`\n  MD${fx.matchday} ${fx.scheduled_date}: ${homeName} vs ${awayName}`)
    console.log(`    ${homeName}: ${homeDna.profile} (${homeDna.level}) | ${awayName}: ${awayDna.profile} (${awayDna.level})`)
    console.log(`    → ${homeName} confidence: ${hConf} | ${awayName} confidence: ${aConf}`)

    if (!dryRun) {
      const { error: e1 } = await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: fx.home_team_id, opponent_id: fx.away_team_id,
        confidence: hConf, opponent_will_exploit: hExploit, recommendations: hRec,
      }, { onConflict: 'fixture_id, team_id' })
      const { error: e2 } = await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: fx.away_team_id, opponent_id: fx.home_team_id,
        confidence: aConf, opponent_will_exploit: aExploit, recommendations: aRec,
      }, { onConflict: 'fixture_id, team_id' })
      if (e1 || e2) console.error(`    ✗ Error: ${e1?.message ?? ''} ${e2?.message ?? ''}`)
      else { notesCount += 2; console.log(`    ✓ Saved`) }
    } else { notesCount += 2 }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  console.log('\nBy profile:')
  const byProfile: Record<string, number> = {}
  for (const a of assignments) byProfile[a.profile] = (byProfile[a.profile] ?? 0) + 1
  for (const [p, c] of Object.entries(byProfile).sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${c}`)

  console.log('\nBy level:')
  const byLevel: Record<string, number> = {}
  for (const a of assignments) byLevel[a.level] = (byLevel[a.level] ?? 0) + 1
  for (const [l, c] of Object.entries(byLevel).sort((a, b) => (LEVEL_ORDER[b] ?? 5) - (LEVEL_ORDER[a] ?? 5))) console.log(`  ${l}: ${c}`)

  console.log('\nTeam details:')
  for (const a of assignments.sort((a, b) => a.team_name.localeCompare(b.team_name))) {
    console.log(`  ${a.team_name}: ${a.profile} (${a.level}) — ${a.source}`)
  }

  if (dryRun) console.log('\n⚠ DRY RUN — use without --dry-run to apply changes')
  else console.log(`\n✅ Done. ${upserted} DNA profiles updated, ${notesCount} coach notes generated.`)
}

main().catch(console.error)
