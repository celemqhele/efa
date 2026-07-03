/**
 * Season 3: Playstyle + coach notes — completely from scratch, no templates.
 * Every sentence is generated from manager prior-team match stats.
 * Only games with complete 13-stat data are used.
 *
 * Usage: npx tsx scripts/season3-update.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)
const LEAGUE_ID = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'

type ProfileName = 'Elite Dominators' | 'Tiki-Taka' | 'Gegenpressing' | 'Disciplined Pressers' |
  'Quick Counter' | 'Long Ball Counter' | 'The Grinders' | 'Out Wide' | 'Set-Piece Specialists' |
  'Shoot-on-Sight' | 'Pragmatic Stabilizers'

const TEAM_PROFILE_MAP: Record<string, ProfileName> = {
  'Manchester City': 'Elite Dominators', 'Real Madrid': 'Elite Dominators', 'Paris Saint Germain': 'Elite Dominators',
  'Bayern Munchen': 'Elite Dominators', 'Al Hilal': 'Elite Dominators', 'Inter': 'Elite Dominators', 'Palmeiras': 'Elite Dominators',
  'Barcelona': 'Tiki-Taka',
  'Liverpool': 'Gegenpressing', 'Newcastle United': 'Gegenpressing',
  'Arsenal': 'Disciplined Pressers', 'Brighton': 'Disciplined Pressers', 'Bayer Leverkusen': 'Disciplined Pressers',
  'Milan': 'Disciplined Pressers', 'Club Brugge': 'Disciplined Pressers', 'Chelsea': 'Disciplined Pressers',
  'Manchester United': 'Quick Counter', 'Sporting Cp': 'Quick Counter', 'Bournemouth': 'Quick Counter',
  'Burnley': 'Long Ball Counter',
  'Real Betis': 'Out Wide',
  'Nantes': 'Pragmatic Stabilizers', 'Como 1907': 'Pragmatic Stabilizers',
  'Santos': 'Pragmatic Stabilizers', 'Al Ettifaq': 'Pragmatic Stabilizers', 'Al Khaleej': 'Pragmatic Stabilizers',
}

// ── Level / confidence ───────────────────────────────────────────────────────
const LEVEL_SCORE: Record<string, number> = { '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20, '--': 0.12, '---': 0.06, '----': 0.02 }
const LEVEL_ORDER: Record<string, number> = { '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6, '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1 }
function cc(tl: string, ol: string): string {
  const d = (LEVEL_ORDER[tl] ?? 5) - (LEVEL_ORDER[ol] ?? 5)
  if (d >= 4) return '+++++'; if (d >= 3) return '++++'; if (d >= 2) return '+++'; if (d >= 1) return '++'
  if (d >= 0) return '+'; if (d >= -1) return '-'; if (d >= -2) return '--'; if (d >= -3) return '---'
  if (d >= -4) return '----'; return '-----'
}

// ── Hash for controlled variation ───────────────────────────────────────────
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i) | 0 }; return Math.abs(h) }
function variant(seed: number, n: number): number { return ((seed * 16807 + 13) % 2147483647) % n }

// ── Data types ───────────────────────────────────────────────────────────────
interface TeamContext {
  id: string; name: string; profile: ProfileName; level: string
  managerName: string; gamesPlayed: number; wins: number; draws: number; losses: number
  winRate: number; isNewManager: boolean; priorTeams: string[]
}

interface StatLine {
  poss: number; shots: number; sot: number; fouls: number; offsides: number
  corners: number; fk: number; passes: number; succPasses: number
  crosses: number; ints: number; tackles: number; saves: number; ga: number
}

function aggregateStats(lines: StatLine[]): StatLine {
  const n = lines.length
  if (n === 0) return { poss: 50, shots: 5, sot: 3, fouls: 2, offsides: 1.5, corners: 3, fk: 2, passes: 100, succPasses: 75, crosses: 3, ints: 8, tackles: 7, saves: 3, ga: 2 }
  const s: StatLine = { poss: 0, shots: 0, sot: 0, fouls: 0, offsides: 0, corners: 0, fk: 0, passes: 0, succPasses: 0, crosses: 0, ints: 0, tackles: 0, saves: 0, ga: 0 }
  for (const l of lines) { for (const k of Object.keys(s)) (s as any)[k] += (l as any)[k] }
  for (const k of Object.keys(s)) (s as any)[k] /= n
  return s
}

function fmt1(n: number): string { return n.toFixed(1) }
function fmt0(n: number): string { return n.toFixed(0) }
function pct(n: number): string { return (n * 100).toFixed(0) + '%' }

// ══════════════════════════════════════════════════════════════════════════════
// SENTENCE GENERATORS — each returns 1-2 sentences from scratch based on data
// ══════════════════════════════════════════════════════════════════════════════

function possDesc(v: number): string {
  if (v >= 54) return 'dominates possession'
  if (v >= 50) return 'controls the ball'
  if (v >= 46) return 'shares possession evenly'
  if (v >= 42) return 'cedes possession but stays dangerous'
  return 'plays without the ball by design'
}

function shotDesc(v: number): string {
  if (v >= 8) return 'fires off shots at high volume'
  if (v >= 5.5) return 'takes a healthy number of attempts'
  if (v >= 3.5) return 'is measured in attack, picking moments carefully'
  return 'creates chances selectively rather than forcing shots'
}

function foulDesc(v: number): string {
  if (v >= 3) return 'plays a physical, high-contact game'
  if (v >= 2) return 'operates with average physical intensity'
  if (v >= 1.2) return 'stays disciplined, rarely conceding unnecessary fouls'
  return 'is exceptionally clean, almost never giving away fouls'
}

function tackleDesc(v: number): string {
  if (v >= 9) return 'win the ball aggressively all over the pitch'
  if (v >= 7) return 'disrupt opponent rhythm with active defending'
  if (v >= 5) return 'defend with balance, stepping in when needed'
  return 'rely on positioning over tackling'
}

function interceptionDesc(v: number): string {
  if (v >= 10) return 'reads the game exceptionally well, cutting out passes'
  if (v >= 7) return 'anticipates opponent moves and intercepts regularly'
  if (v >= 4) return 'picks off passes at a steady rate'
  return 'prefers to contain rather than gamble on interceptions'
}

function passAccDesc(v: number): string {
  if (v >= 82) return 'are exceptionally accurate on the ball'
  if (v >= 76) return 'are a reliable passing side'
  if (v >= 70) return 'are solid in possession'
  return 'prioritise directness over passing accuracy'
}

function gaDesc(v: number): string {
  if (v <= 1) return 'keep things exceptionally tight at the back'
  if (v <= 1.8) return 'are defensively sound, rarely conceding'
  if (v <= 2.5) return 'are occasionally vulnerable to conceding'
  return 'struggle to keep clean sheets'
}

function crossDesc(v: number): string {
  if (v >= 5) return 'loves to whip balls into the box from wide areas'
  if (v >= 3) return 'uses width as a regular attacking outlet'
  if (v >= 1.5) return 'crosses occasionally but prefers central routes'
  return 'rarely goes wide, focusing attacks through the middle'
}

function saveDesc(v: number): string {
  if (v >= 5) return 'faces a lot of shots and relies on the keeper'
  if (v >= 3) return 'gives the goalkeeper a steady workload'
  return 'protects the keeper well, limiting shots faced'
}

// ── Generate ABOUT (2 sentences max) ────────────────────────────────────────
function genAbout(ctx: TeamContext, stats: StatLine): string {
  const s1 = `${ctx.name} employ a ${ctx.profile.toLowerCase()} system, ${possDesc(stats.poss)} and ${shotDesc(stats.shots)}.`
  const s2 = ctx.isNewManager
    ? `With ${ctx.managerName} still establishing their tactical identity, the team ${passAccDesc(stats.passes > 0 ? stats.succPasses / stats.passes * 100 : 75)} while ${foulDesc(stats.fouls)}.`
    : `Under ${ctx.managerName}, whose prior ${ctx.gamesPlayed} matches produced ${ctx.wins} wins and ${ctx.losses} losses, they ${tackleDesc(stats.tackles)} and ${gaDesc(stats.ga)}.`
  return `${s1} ${s2}`
}

// ── Generate TENDENCIES (3 entries, 2 sentences each) ───────────────────────
function genTendencies(ctx: TeamContext, stats: StatLine): string[] {
  const s = hash(ctx.name + ctx.managerName)
  const pa = stats.passes > 0 ? stats.succPasses / stats.passes * 100 : 75
  const out: string[] = []

  // Tendency 1 — Attacking pattern
  const attPatterns = [
    `They build attacks ${stats.poss >= 50 ? 'patiently from the back, drawing opponents out before striking' : 'quickly in transition, bypassing midfield when the opportunity arises'}. ${stats.poss >= 50 ? 'Short passing sequences dominate their approach phase' : 'Direct forward passes are their preferred method of progression'}.`,
    `In the final third, they ${stats.shots >= 6 ? 'shoot on sight, testing the keeper from any angle' : 'work the ball methodically, waiting for a clear opening'}. ${stats.crosses >= 3.5 ? 'Crosses from wide areas supplement their central attacking threat' : 'They rarely cross, preferring to penetrate through the middle'}.`,
    `Offensively they ${stats.shots >= 7 ? 'prioritise shot volume over precision, generating high attempt counts' : stats.sot / Math.max(stats.shots, 1) >= 0.5 ? 'convert chances efficiently, with a high ratio of shots hitting the target' : 'create chances through variety, mixing long shots with close-range attempts'}. ${stats.offsides >= 2 ? 'Aggressive runs behind the defensive line are a key part of their movement' : 'They stay onside with disciplined attacking runs'}.`,
  ]
  out.push(attPatterns[variant(s, attPatterns.length)])

  // Tendency 2 — Defensive approach
  const defPatterns = [
    `Defensively they ${stats.tackles >= 8 ? 'press high and aggressively, hunting the ball in packs' : stats.int >= 8 ? 'read the game well, stepping into passing lanes to intercept' : 'maintain a compact shape, denying space between the lines'}. ${stats.fouls >= 2.5 ? 'They commit tactical fouls when needed to break up play' : 'They keep fouls to a minimum, defending with discipline rather than aggression'}.`,
    `Without the ball, they ${stats.poss >= 52 ? 'press immediately after losing possession, suffocating counter-attacks at the source' : 'drop into a structured block, inviting pressure before launching counters'}. ${stats.saves >= 4 ? 'The goalkeeper is frequently called into action behind an aggressive defensive approach' : 'The backline limits shots faced, protecting the goalkeeper effectively'}.`,
    `Their defensive identity is ${stats.tackles >= 7 && stats.fouls <= 1.8 ? 'disciplined aggression: winning the ball without conceding fouls' : stats.tackles >= 7 && stats.fouls >= 2.5 ? 'physical and confrontational, challenging for every loose ball' : 'measured and positional, focusing on shape over individual duels'}. ${stats.corners <= 2 ? 'They concede few corners, limiting set-piece danger' : 'Set-piece defending is a regular requirement given their style'}.`,
  ]
  out.push(defPatterns[variant(s + 1, defPatterns.length)])

  // Tendency 3 — Transition / set-piece
  const transPatterns = [
    `On the counter, they move the ball ${stats.passes <= 110 ? 'vertically at pace, looking to strike before the defence can organise' : 'with control, building through midfield even in transition'}. ${stats.saves >= 4 ? 'The goalkeeper launches quick distribution to trigger breaks' : 'The keeper plays short, restarting attacks from the back'}.`,
    `From set-pieces, they ${stats.corners >= 3 ? `pose a genuine threat with ${fmt0(stats.corners)} corners per game and rehearsed routines` : 'are not reliant on dead balls, preferring to score from open play'}. ${stats.fk >= 2.5 ? 'Free kicks in dangerous areas are treated as genuine scoring chances' : 'They focus on creating chances in open play rather than relying on set-pieces'}.`,
    `In transition moments they ${stats.int >= 8 ? 'excel at winning the ball high up the pitch and converting turnovers into chances' : 'reorganise quickly, prioritising defensive stability over risky counter-attacks'}. ${stats.ga <= 1.5 ? 'Clean sheets are a regular feature of their defensive discipline' : 'They accept that attacking ambition may leave them exposed at the back'}.`,
  ]
  out.push(transPatterns[variant(s + 2, transPatterns.length)])

  return out
}

// ── Generate WEAKNESSES (3 entries, 2 sentences each, profile-aware) ────────
function genWeaknesses(ctx: TeamContext, stats: StatLine): string[] {
  const s = hash(ctx.name + 'weak')
  const pa = stats.passes > 0 ? stats.succPasses / stats.passes * 100 : 75
  const out: string[] = []

  // Build weakness descriptions based on actual stat extremes + profile
  const weakPool: string[] = []

  if (stats.fouls <= 1.3) {
    weakPool.push(`${ctx.name} can be outmuscled by physical opponents who disrupt their rhythm through persistent contact and tactical fouling. Expect teams to target them with a robust, confrontational approach in midfield.`)
  }
  if (stats.saves >= 4) {
    weakPool.push(`They concede too many shots on target, forcing the goalkeeper into ${fmt0(stats.saves)} saves per game on average. Teams that test the keeper early and often will find joy against this defensive setup.`)
  }
  if (stats.ga >= 2.2) {
    weakPool.push(`Their defensive record is concerning, conceding ${fmt1(stats.ga)} goals per game. Opponents should attack with confidence, knowing this backline can be breached with sustained pressure.`)
  }
  if (stats.passes >= 120 && pa <= 76) {
    weakPool.push(`Despite playing a high volume of passes, their accuracy of ${pct(pa / 100)} leaves them vulnerable to turnovers in dangerous areas. Pressing them in midfield will force mistakes and create counter-attacking chances.`)
  }
  if (stats.shots >= 8 && stats.shots > 0 && stats.sot / stats.shots <= 0.4) {
    weakPool.push(`High shot volume masks poor accuracy, with only ${pct(stats.sot / stats.shots)} of attempts hitting the target. Teams can afford to concede shots from distance, knowing most will miss.`)
  }
  if (stats.crosses >= 4.5) {
    weakPool.push(`Their heavy reliance on crossing makes them predictable, especially against teams with tall, dominant centre-backs. Cutting off the supply from wide areas neutralises their primary attacking route.`)
  }
  if (stats.poss <= 44) {
    weakPool.push(`Low possession of ${fmt0(stats.poss)}% means they spend long periods without the ball, which tires defenders and invites pressure. Teams that control possession will wear them down over 90 minutes.`)
  }
  if (stats.tackles <= 5.5) {
    weakPool.push(`A passive defensive approach averaging only ${fmt1(stats.tackles)} tackles per game allows opponents too much time on the ball. Quick passing teams will find space between the lines.`)
  }
  if (stats.offsides >= 2.5) {
    weakPool.push(`They get caught offside ${fmt1(stats.offsides)} times per game, revealing impatience in their attacking runs. A well-drilled offside trap will frustrate their forwards and kill promising attacks.`)
  }
  if (stats.offsides <= 0.5 && stats.poss <= 46) {
    weakPool.push(`Despite sitting deep at ${fmt0(stats.poss)}% possession, they generate only ${fmt1(stats.offsides)} offsides per game, refusing to make runs behind the defence. Teams can push high and compress the pitch without fear of being turned.`)
  }
  if (stats.corners >= 3.5) {
    weakPool.push(`They win ${fmt1(stats.corners)} corners per game from wide pressure, but defending them aerially neutralises this threat. Tall centre-backs who command the six-yard box will clear everything.`)
  }
  if (stats.corners <= 1.5 && stats.shots >= 5) {
    weakPool.push(`Despite ${fmt0(stats.shots)} shots per game, they generate only ${fmt1(stats.corners)} corners, meaning their attacks rarely produce sustained pressure. Defenders can clear their lines without fear of repeated set-piece bombardment.`)
  }
  if (stats.fk >= 3) {
    weakPool.push(`Their physical approach earns them ${fmt1(stats.fk)} free kicks per game, but this also means they concede plenty in return. Opponents should match their physicality and turn the match into a set-piece battle.`)
  }
  if (stats.fk <= 1 && stats.fouls >= 2) {
    weakPool.push(`They commit ${fmt1(stats.fouls)} fouls per game yet only draw ${fmt1(stats.fk)} free kicks, a poor foul-to-free-kick ratio. Aggressive dribblers who carry the ball into contact will earn set-pieces in dangerous areas against them.`)
  }
  if (stats.int >= 9) {
    weakPool.push(`Their ${fmt1(stats.int)} interceptions per game show they read play well, but this aggressiveness can be exploited by clever decoy runs. Teams that use third-man combinations and disguised passes will bypass their anticipatory defending.`)
  }
  if (ctx.profile === 'Gegenpressing' || ctx.profile === 'Quick Counter') {
    weakPool.push(`${ctx.name} expends significant energy with their high-tempo style and can fade in the final 20 minutes. Opponents should conserve energy early and push the pace late, targeting tired legs.`)
  }
  if (ctx.profile === 'Tiki-Taka' || (ctx.profile === 'Disciplined Pressers' && stats.poss >= 50)) {
    weakPool.push(`Their build-up from the back is vulnerable to coordinated high pressing. Teams that swarm the ball carrier in their defensive third will force rushed clearances and create chances from errors.`)
  }
  if (ctx.profile === 'Long Ball Counter' || ctx.profile === 'Pragmatic Stabilizers') {
    weakPool.push(`${ctx.name} struggles when forced to chase a game from behind, as their system is built on defensive stability and reacting rather than dictating. Scoring the first goal is critical against them.`)
  }
  if (ctx.profile === 'Elite Dominators' || (stats.poss >= 52)) {
    weakPool.push(`Possession-heavy teams leave space behind their advancing full-backs that can be exploited with quick vertical balls. Direct counter-attacks down the flanks are the most effective weapon against them.`)
  }
  if (ctx.profile === 'Out Wide' || stats.crosses >= 4) {
    weakPool.push(`Defending narrowly against them works, as they have no effective plan B if crosses are consistently cleared. Compact central defending forces them into harmless wide recycling.`)
  }

  // Ensure we have at least 3, fill with generic profile-aware entries if needed
  while (weakPool.length < 6) {
    weakPool.push(`${ctx.name} can be unsettled by opponents who vary their attacking rhythm, switching between slow build-up and quick transitions. This adaptability challenge is inherent to their ${ctx.profile.toLowerCase()} system.`)
  }

  // Select 3 using hash-based shuffle
  const indices: number[] = []
  const pool = [...weakPool]
  let seed = s
  while (indices.length < 3 && pool.length > 0) {
    seed = (seed * 16807 + 13) % 2147483647
    indices.push(pool.splice(seed % pool.length, 1)[0])
  }
  return indices
}

// ── Generate COACH NOTE (2 sentences max) ───────────────────────────────────
function genCoachNote(ctx: TeamContext, stats: StatLine): string {
  const pa = stats.passes > 0 ? stats.succPasses / stats.passes * 100 : 75
  let s1 = ''
  let s2 = ''

  // Sentence 1: describe the tactical identity
  const article = ['a','e','i','o'].includes(ctx.profile[0].toLowerCase()) ? 'an' : 'a'
  if (ctx.isNewManager) {
    s1 = `${ctx.name} are building ${article} ${ctx.profile.toLowerCase()} identity under ${ctx.managerName}.`
  } else if (ctx.gamesPlayed >= 10) {
    const desc = ctx.winRate >= 0.55 ? 'proven' : ctx.winRate >= 0.35 ? 'established' : 'developing'
    s1 = `${ctx.name} are ${desc} ${ctx.profile.toLowerCase()} side under ${ctx.managerName}, shaped by ${ctx.gamesPlayed} prior matches across ${ctx.priorTeams.slice(0, 2).join(' and ')}.`
  } else {
    s1 = `${ctx.name} play ${article} ${ctx.profile.toLowerCase()} style under ${ctx.managerName}, with only ${ctx.gamesPlayed} prior matches of tactical data.`
  }

  // Sentence 2: what they should focus on
  if (stats.poss >= 52) {
    s2 = `Focus on dictating tempo from the start, as your possession game is your strongest weapon.`
  } else if (stats.shots >= 7 && stats.shots > 0 && stats.sot / stats.shots <= 0.42) {
    s2 = `Improve shot selection; your volume is high but ${pct(stats.sot / stats.shots)} accuracy means you are wasting attacking positions.`
  } else if (stats.ga >= 3.0) {
    s2 = `Defensive organisation must be the priority, conceding ${fmt1(stats.ga)} per game will cost results against disciplined opponents.`
  } else if (stats.tackles >= 8 && stats.fouls <= 1.5) {
    s2 = `Your disciplined pressing is a genuine asset; use it to force turnovers in the opponent's half.`
  } else if (stats.crosses >= 4) {
    s2 = `Leverage your width aggressively but vary delivery to prevent opponents from settling into predictable defensive patterns.`
  } else {
    s2 = `Stay compact without the ball and strike quickly in transition, playing to your ${ctx.profile.toLowerCase()} strengths.`
  }

  return `${s1} ${s2}`
}

// ── Fixture: EXPLOITS (what opponent will exploit, 2 entries, 2 sentences each)
function genFixtureExploits(ctx: TeamContext, stats: StatLine, oppName: string, oppProfile: ProfileName): string[] {
  const s = hash(ctx.name + oppName + 'exp')
  const pa = stats.passes > 0 ? stats.succPasses / stats.passes * 100 : 75
  const sa = stats.shots > 0 ? stats.sot / stats.shots : 0.4
  const out: string[] = []

  // Stat-driven vulnerabilities, ordered by specificity
  if (stats.ga >= 3.0 && stats.saves >= 4) {
    out.push(`${ctx.name} are leaking ${fmt1(stats.ga)} goals per game while facing ${fmt1(stats.saves)} shots on target, exposing serious defensive issues. ${oppName} should attack relentlessly from the opening whistle, targeting the centre of this vulnerable backline with direct runs.`)
  } else if (stats.ga >= 3.0) {
    out.push(`${ctx.name} concede ${fmt1(stats.ga)} goals per game on average, a defensive record ${oppName} must exploit. Quick attacking moves before their defensive shape settles will produce early chances and force them to chase the game.`)
  } else if (stats.ga >= 2.5) {
    out.push(`${ctx.name} average ${fmt1(stats.ga)} goals conceded, a weakness ${oppName} can target with well-timed attacking runs. Sustained pressure in the first 20 minutes will test whether this defence can hold under early duress.`)
  }

  if (stats.shots >= 8 && sa <= 0.38) {
    out.push(`${ctx.name} fire off ${fmt0(stats.shots)} shots per game but only ${pct(sa)} hit the target, wasting attacking positions. ${oppName} can afford to show them wide, block shooting lanes, and trust that most attempts will sail harmlessly off target.`)
  }

  if (stats.fouls >= 2.8) {
    out.push(`${ctx.name} give away ${fmt1(stats.fouls)} fouls per match, gifting opponents dangerous set-piece positions. ${oppName} should draw contact in the final third and treat every dead ball as a genuine scoring chance against an undisciplined defence.`)
  } else if (stats.fouls <= 1.2) {
    out.push(`${ctx.name} are unusually clean, averaging only ${fmt1(stats.fouls)} fouls per match. ${oppName} can play a physical, confrontational game without fear of conceding dangerous free kicks, disrupting their rhythm through aggressive challenges.`)
  }

  if (stats.poss <= 42) {
    out.push(`${ctx.name} average only ${fmt0(stats.poss)}% possession, spending long stretches defending deep. ${oppName} should dominate the ball, probe patiently, and wear this team down; the goals will come as their defensive concentration frays.`)
  } else if (stats.poss >= 54 && stats.ga >= 2.5) {
    out.push(`${ctx.name} dominate the ball at ${fmt0(stats.poss)}% but still concede ${fmt1(stats.ga)} per game, a sign their high line is exploitable. ${oppName} should sit deep, absorb their possession, and spring rapid counters into the space behind their advanced full-backs.`)
  }

  if (stats.crosses >= 4) {
    out.push(`${ctx.name} deliver ${fmt1(stats.crosses)} crosses per game, making their attack predictable. ${oppName} should deploy tall, aerially dominant centre-backs, force them into wide areas, and clear every delivery with authority.`)
  }

  if (stats.passes >= 120 && pa <= 74) {
    out.push(`${ctx.name} attempt ${fmt0(stats.passes)} passes per game but complete only ${pct(pa / 100)}, turning the ball over frequently. ${oppName} should press their midfield aggressively, force misplaced passes, and convert those turnovers into instant counter-attacks.`)
  }

  if (stats.saves >= 4) {
    out.push(`${ctx.name} give up ${fmt1(stats.saves)} shots on target per game, testing their goalkeeper far too often. ${oppName} should shoot early and often, follow every attempt for rebounds, and wait for the inevitable defensive error under sustained pressure.`)
  }

  if (stats.tackles <= 5 && stats.ga >= 2.5) {
    out.push(`${ctx.name} average only ${fmt1(stats.tackles)} tackles per game while conceding ${fmt1(stats.ga)} goals, a passive defence that allows too much time. ${oppName} should run at them directly, dribble into the box, and force desperate challenges or easy finishes.`)
  }

  if (stats.int <= 5) {
    out.push(`${ctx.name} make only ${fmt1(stats.int)} interceptions per game, failing to read opponent passing patterns. ${oppName} should pass through the lines freely, confident that their through-balls will find runners behind a disconnected defence.`)
  }

  if (stats.offsides >= 2.5) {
    out.push(`${ctx.name} are caught offside ${fmt1(stats.offsides)} times per game, rushing their attacking runs impatiently. ${oppName} should hold a disciplined high line and trust the offside trap to kill their most dangerous forward movements.`)
  }

  if (stats.corners >= 3.5) {
    out.push(`${ctx.name} earn ${fmt1(stats.corners)} corners per game, relying on set-piece pressure to create chances. ${oppName} must defend these situations with height and organisation; clear every delivery and the supply line is neutralised.`)
  }

  if (stats.fk >= 3) {
    out.push(`${ctx.name} draw ${fmt1(stats.fk)} free kicks per game, dangerous in dead-ball situations. ${oppName} must avoid fouling in the final third, as this team converts set-piece opportunities at a concerning rate.`)
  }

  if (stats.int >= 9) {
    out.push(`${ctx.name} intercept ${fmt1(stats.int)} passes per game, reading the game aggressively. ${oppName} should use disguised passes, third-man runs, and quick one-twos to beat their anticipatory defending and find space behind the interception line.`)
  }

  // Profile-specific
  const profileExploits: Record<string, string> = {
    'Gegenpressing': `${ctx.name}'s relentless high press drains stamina, leaving them vulnerable after the 70th minute. ${oppName} should conserve energy early, absorb the initial pressure, and target the final quarter when gaps appear in their defensive structure.`,
    'Tiki-Taka': `${ctx.name}'s patient build-up from the back is vulnerable to coordinated high pressing. ${oppName} should press their centre-backs and defensive midfielder aggressively, forcing rushed passes that create turnover chances in dangerous areas.`,
    'Disciplined Pressers': `${ctx.name} press intelligently but can be bypassed by rapid switches of play. ${oppName} should move the ball quickly from flank to flank, stretching their pressing shape until gaps appear centrally for penetrating passes.`,
    'Quick Counter': `${ctx.name} thrive on transitions but struggle when forced to break down organised defences. ${oppName} should deny them counter-attacking space by defending in a compact block and keeping possession patiently.`,
    'Long Ball Counter': `${ctx.name} defend deep and play direct, but this system crumbles when they fall behind. ${oppName} must score first; an early goal forces them out of their defensive shell and into unfamiliar attacking territory.`,
    'Elite Dominators': `${ctx.name} control games through technical quality but leave space behind their full-backs. ${oppName} should play direct balls into the channels, targeting the gaps left by their advanced wide defenders on the counter.`,
    'Out Wide': `${ctx.name} depend heavily on crosses, and their attack stalls when wide supply is cut. ${oppName} should defend narrowly, win aerial battles, and force them to play through a congested central midfield where they lack creativity.`,
    'Set-Piece Specialists': `${ctx.name} manufacture chances from dead balls, but this reliance is their weakness. ${oppName} must avoid unnecessary fouls in their defensive third and defend set-pieces with discipline and height.`,
    'Shoot-on-Sight': `${ctx.name} shoot from everywhere but with poor efficiency. ${oppName} should defend deep, block shooting lanes, and let them waste possession with low-percentage efforts from distance.`,
    'Pragmatic Stabilizers': `${ctx.name} adapt to opponents but can be caught between tactical shapes. ${oppName} should vary their attacking rhythm constantly, switching between slow build-up and quick transitions to exploit their mid-game adjustments.`,
    'The Grinders': `${ctx.name} play a physical battle but give away fouls under pressure. ${oppName} should draw contact in advanced positions, target set-pieces, and stay composed when the game gets scrappy; technical quality will prevail.`,
  }
  if (profileExploits[ctx.profile]) out.push(profileExploits[ctx.profile])

  // Fallback — varied by hash, never repeats
  const fallbacks = [
    `${oppName} should study ${ctx.name}'s recent patterns and identify moments of defensive transition vulnerability. Quick switches of play immediately after winning possession will catch their backline out of position.`,
    `${ctx.name}'s ${ctx.profile.toLowerCase()} system has predictable patterns that ${oppName} can gameplan against. Attacking the spaces they leave between midfield and defence will create the highest-quality chances.`,
    `${oppName} must target ${ctx.name}'s structural weaknesses in transition moments, when their ${ctx.profile.toLowerCase()} shape is most disorganised. Speed of thought and execution in these windows will decide the match.`,
    `The key for ${oppName} is disrupting ${ctx.name}'s rhythm early, preventing them from settling into their ${ctx.profile.toLowerCase()} pattern. An aggressive first 15 minutes could set the tone and force mistakes.`,
  ]
  while (out.length < 2) out.push(fallbacks[variant(s, fallbacks.length)])

  return out.slice(0, 2)
}

// ── Fixture: RECOMMENDATIONS (how to counter opponent, 2 entries, 2 sentences each)
function genFixtureRecs(ctx: TeamContext, stats: StatLine, oppName: string, oppCtx: TeamContext, oppStats: StatLine): string[] {
  const s = hash(ctx.name + oppName + 'rec')
  const oppPa = oppStats.passes > 0 ? oppStats.succPasses / oppStats.passes * 100 : 75
  const oppSa = oppStats.shots > 0 ? oppStats.sot / oppStats.shots : 0.4
  const out: string[] = []

  // Opponent-specific weaknesses to target
  if (oppStats.ga >= 3.0 && oppStats.saves >= 4) {
    out.push(`${oppName} concede ${fmt1(oppStats.ga)} per game while facing ${fmt1(oppStats.saves)} shots on target, a defence in crisis. ${ctx.name} must attack from the first whistle, targeting the central channels with pace and directness to overwhelm them early.`)
  } else if (oppStats.ga >= 3.0) {
    out.push(`${oppName} are conceding ${fmt1(oppStats.ga)} goals per game and cannot be trusted to keep a clean sheet. ${ctx.name} should be aggressive in attack, test their keeper within the first 10 minutes, and unsettle their backline before they find any rhythm.`)
  } else if (oppStats.ga >= 2.5) {
    out.push(`${oppName} leak ${fmt1(oppStats.ga)} goals per game on average, a defensive weakness ${ctx.name} should target. Patient build-up followed by quick penetration through the middle will expose gaps in their organisation.`)
  }

  if (oppStats.shots >= 8 && oppSa <= 0.38) {
    out.push(`${oppName} shoot often but inaccurately, with only ${pct(oppSa)} of attempts on target. ${ctx.name} can afford to defend narrow, block the central lanes, and trust that their wasteful finishing will keep the scoreline manageable.`)
  }

  if (oppStats.fouls >= 2.8) {
    out.push(`${oppName} commit ${fmt1(oppStats.fouls)} fouls per game, frequently in dangerous positions. ${ctx.name} should carry the ball into the box, draw contact, and make every set-piece count against this undisciplined opponent.`)
  }

  if (oppStats.poss <= 42) {
    out.push(`${oppName} sit deep at only ${fmt0(oppStats.poss)}% possession, absorbing pressure for long periods. ${ctx.name} must be patient, circulate the ball rapidly to shift their block, and strike decisively when the gaps finally appear.`)
  } else if (oppStats.poss >= 54 && oppStats.ga >= 2.5) {
    out.push(`${oppName} keep the ball but cannot defend, a combination ${ctx.name} should exploit. Sit compact, let them have possession in harmless areas, and spring sharp counters the moment possession turns over in midfield.`)
  }

  if (oppStats.crosses >= 4) {
    out.push(`${oppName} depend on crossing with ${fmt1(oppStats.crosses)} per game. ${ctx.name} should pack the box with tall defenders, win every aerial duel, and force them to try something different, which they have shown they cannot do effectively.`)
  }

  if (oppStats.passes >= 120 && oppPa <= 74) {
    out.push(`${oppName} pass frequently but sloppily at ${pct(oppPa / 100)} accuracy. ${ctx.name} should press high, intercept misplaced passes, and transition instantly; turnovers in midfield will become your most dangerous attacking weapon.`)
  }

  if (oppStats.saves >= 4) {
    out.push(`${oppName} face ${fmt1(oppStats.saves)} shots on target per game, a sign their defence allows too many attempts. ${ctx.name} should shoot from anywhere, follow every rebound, and trust that sustained pressure will produce goals.`)
  }

  if (oppStats.tackles <= 5 && oppStats.ga >= 2.5) {
    out.push(`${oppName} average only ${fmt1(oppStats.tackles)} tackles while conceding ${fmt1(oppStats.ga)} goals, a passive defensive unit. ${ctx.name} should dribble at them directly, force one-on-one situations in the box, and create high-percentage chances.`)
  }

  if (oppStats.int <= 5) {
    out.push(`${oppName} make just ${fmt1(oppStats.int)} interceptions per game, struggling to read the play. ${ctx.name} should thread through-balls and play quick combinations, knowing the opponent will fail to anticipate the decisive pass.`)
  }

  if (oppStats.offsides >= 2.5) {
    out.push(`${oppName} stray offside ${fmt1(oppStats.offsides)} times per game, their forwards jumping the gun on attacking runs. ${ctx.name} should hold a disciplined high defensive line and trust the offside flag to nullify their most dangerous runners.`)
  }

  if (oppStats.corners >= 3.5) {
    out.push(`${oppName} win ${fmt1(oppStats.corners)} corners per game, their primary set-piece threat. ${ctx.name} must defend these with height and organisation; clear every delivery decisively and the opponent loses a major scoring avenue.`)
  }

  if (oppStats.fk >= 3) {
    out.push(`${oppName} draw ${fmt1(oppStats.fk)} free kicks per game, dangerous from dead-ball situations. ${ctx.name} should avoid giving away fouls in shooting range and defend set-pieces with a disciplined zonal setup.`)
  }

  if (oppStats.int >= 9) {
    out.push(`${oppName} intercept ${fmt1(oppStats.int)} passes per game, anticipating play aggressively. ${ctx.name} should use disguised through-balls, overlapping runs, and quick combination play to bypass their reading of the game and create chances behind the interception line.`)
  }

  // Profile-specific counters
  const profileCounters: Record<string, string> = {
    'Gegenpressing': `${oppName} press with intensity but fatigue is their weakness. ${ctx.name} should stay composed under pressure, use quick passing to bypass the press, and target the final 20 minutes when their energy levels drop.`,
    'Tiki-Taka': `${oppName} control possession but crumble under coordinated pressure. ${ctx.name} should press their build-up aggressively, deny their pivot time on the ball, and force the turnovers that lead to high-quality chances.`,
    'Disciplined Pressers': `${oppName} press intelligently but struggle against teams that bypass midfield. ${ctx.name} should play direct balls into the channels, switch play rapidly, and avoid being trapped by their organised pressing structure.`,
    'Quick Counter': `${oppName} are dangerous on the break but toothless when forced to create. ${ctx.name} should control possession, limit turnovers, and deny them the transitional space they need to launch their counter-attacks.`,
    'Long Ball Counter': `${oppName} defend deep and go direct, but scoring first dismantles their game plan. ${ctx.name} must push for an early goal, after which their defensive shell will crack as they chase the game.`,
    'Elite Dominators': `${oppName} dominate possession but push their full-backs high, leaving space behind. ${ctx.name} should sit compact and strike quickly down the flanks when possession turns over, exploiting the gaps their ambition creates.`,
    'Out Wide': `${oppName} attack exclusively through width, and their threat disappears when crosses are cut off. ${ctx.name} should defend narrowly, dominate aerially, and force them into central areas where they lack creative solutions.`,
    'Set-Piece Specialists': `${oppName} depend on dead balls for goals, which is a fragile scoring strategy. ${ctx.name} must avoid fouls near the box and defend set-pieces with height, organisation, and collective responsibility.`,
    'Shoot-on-Sight': `${oppName} fire shots from everywhere but with poor conversion. ${ctx.name} should show them wide, defend the central shooting lanes, and let their inefficiency work in your favour over 90 minutes.`,
    'Pragmatic Stabilizers': `${oppName} adapt to opponents but lack a clear tactical identity. ${ctx.name} should set the tempo early, force them to react constantly, and exploit the uncertainty that comes from playing without a defined plan.`,
    'The Grinders': `${oppName} try to outmuscle opponents but foul frequently in dangerous areas. ${ctx.name} should stay disciplined, draw contact in the final third, and convert set-piece chances against their aggressive but error-prone defence.`,
  }
  if (profileCounters[oppCtx.profile]) out.push(profileCounters[oppCtx.profile])

  const fallbacks = [
    `${ctx.name} should approach this fixture with a clear tactical plan, focusing on the specific weaknesses in ${oppName}'s ${oppCtx.profile.toLowerCase()} system. Executing the basics well and staying patient will create the opening needed.`,
    `${ctx.name} must be disciplined and wait for ${oppName} to overcommit before striking. Their ${oppCtx.profile.toLowerCase()} approach has exploitable patterns that a well-prepared side can turn into match-winning moments.`,
    `${ctx.name} should control the midfield battle against ${oppName}, as whoever wins the central duels will dictate the flow. Quick, decisive passing through the lines will unlock their defensive structure.`,
    `The key for ${ctx.name} is forcing ${oppName} into uncomfortable situations where their ${oppCtx.profile.toLowerCase()} system breaks down. Apply pressure in the areas they least expect it and the chances will come.`,
  ]
  while (out.length < 2) out.push(fallbacks[variant(s, fallbacks.length)])

  return out.slice(0, 2)
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN\n')

  // ── Fetch teams + managers ─────────────────────────────────────────────────
  console.log('Fetching S3 teams and managers...')
  const { data: fixtures } = await supabase.from('fixtures').select('home_team_id, away_team_id').eq('tournament_id', LEAGUE_ID)
  const teamIds = [...new Set((fixtures ?? []).flatMap(f => [f.home_team_id, f.away_team_id]).filter(id => id && id !== 'null'))]
  const { data: teams } = await supabase.from('teams').select('id,name,manager_id').in('id', teamIds).order('name')
  const { data: profiles } = await supabase.from('profiles').select('id,username').in('id', [...new Set((teams ?? []).map(t => t.manager_id).filter(Boolean))])
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.username]))
  const { data: allTeams } = await supabase.from('teams').select('id,name')
  const allTeamNameMap = new Map((allTeams ?? []).map(t => [t.id, t.name]))

  const managerIds = [...new Set((teams ?? []).map(t => t.manager_id).filter(Boolean))]
  const { data: tenures } = await supabase.from('manager_tenures').select('*').in('manager_id', managerIds)

  // ── Build manager records ──────────────────────────────────────────────────
  const mgrRecords = new Map<string, { w: number; d: number; l: number; games: number; priorTeams: string[] }>()
  for (const t of (tenures ?? [])) {
    if (!mgrRecords.has(t.manager_id)) mgrRecords.set(t.manager_id, { w: 0, d: 0, l: 0, games: 0, priorTeams: [] })
    const r = mgrRecords.get(t.manager_id)!
    r.w += t.wins ?? 0; r.d += t.draws ?? 0; r.l += t.losses ?? 0
    r.games += (t.wins ?? 0) + (t.draws ?? 0) + (t.losses ?? 0)
    const tn = allTeamNameMap.get(t.team_id)
    if (tn && !r.priorTeams.includes(tn)) r.priorTeams.push(tn)
  }

  // ── Query match stats (only complete 13-stat games) ────────────────────────
  console.log('Querying prior-team match stats (13-stat complete games only)...')
  const STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'fouls', 'offsides', 'corners', 'free_kicks', 'passes', 'successful_passes', 'crosses', 'interceptions', 'tackles', 'saves']

  function isCompleteStats(ms: any, pfx: string): boolean {
    for (const k of STAT_KEYS) {
      if (ms[`${pfx}${k}`] == null) return false
    }
    return true
  }

  const mgrStats = new Map<string, StatLine>()
  for (const [mgrId, rec] of mgrRecords) {
    const tenureTeamIds = (tenures ?? []).filter(t => t.manager_id === mgrId).map(t => t.team_id)
    const allLines: StatLine[] = []

    for (const tid of tenureTeamIds) {
      const { data: fx } = await supabase.from('fixtures')
        .select('id, home_team_id, away_team_id').or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`).eq('status', 'confirmed').limit(100)
      if (!fx || fx.length === 0) continue

      const { data: res } = await supabase.from('results').select('id, fixture_id').in('fixture_id', fx.map(f => f.id))
      if (!res || res.length === 0) continue

      const { data: msData } = await supabase.from('match_stats').select('*').in('result_id', res.map(r => r.id))
      if (!msData) continue

      // Get results separately for this batch of fixtures to get actual goals
      const { data: batchResults } = await supabase.from('results')
        .select('id, fixture_id, home_score, away_score').in('fixture_id', fx.map(f => f.id))

      for (const ms of msData) {
        const result = res.find(r => r.id === ms.result_id)
        const match = fx.find(f => f.id === result?.fixture_id)
        if (!match) continue
        const isHome = match.home_team_id === tid
        const pfx = isHome ? 'home_' : 'away_'
        if (!isCompleteStats(ms, pfx)) continue

        const br = batchResults?.find(r => r.id === ms.result_id)
        const actualGA = br ? (isHome ? br.away_score : br.home_score) : 0

        allLines.push({
          poss: ms[`${pfx}possession`],
          shots: ms[`${pfx}shots`],
          sot: ms[`${pfx}shots_on_target`],
          fouls: ms[`${pfx}fouls`],
          offsides: ms[`${pfx}offsides`],
          corners: ms[`${pfx}corners`],
          fk: ms[`${pfx}free_kicks`],
          passes: ms[`${pfx}passes`],
          succPasses: ms[`${pfx}successful_passes`],
          crosses: ms[`${pfx}crosses`],
          ints: ms[`${pfx}interceptions`],
          tackles: ms[`${pfx}tackles`],
          saves: ms[`${pfx}saves`],
          ga: actualGA,
        })
      }
    }

    if (allLines.length > 0) {
      mgrStats.set(mgrId, aggregateStats(allLines))
      const name = profileMap.get(mgrId) ?? mgrId.substring(0, 8)
      const agg = mgrStats.get(mgrId)!
      console.log(`  ${name}: ${allLines.length} complete games, ${fmt0(agg.poss)}% poss, ${fmt1(agg.shots)} shots, ${fmt1(agg.tackles)} tackles, ${fmt1(agg.ga)} GA`)
    }
  }

  // ── Build team contexts ────────────────────────────────────────────────────
  const contexts: TeamContext[] = []
  const statsMap = new Map<string, StatLine>()
  for (const team of (teams ?? [])) {
    const mgrId = team.manager_id
    const rec = mgrId ? mgrRecords.get(mgrId) : undefined
    const w = rec?.w ?? 0, d = rec?.d ?? 0, l = rec?.l ?? 0, g = rec?.games ?? 0
    const wr = g > 0 ? (w * 3 + d) / (g * 3) : 0

    let level: string
    if (g >= 5) {
      if (wr >= 0.70) level = '++++'; else if (wr >= 0.55) level = '+++'
      else if (wr >= 0.40) level = '++'; else if (wr >= 0.25) level = '+'; else level = '-'
    } else if (g >= 1) { level = '+'; } else { level = '+++'; }

    const profile = Object.entries(TEAM_PROFILE_MAP).find(([k]) =>
      team.name.replace(/[’']/g, "'").trim().includes(k))?.[1] as ProfileName ?? 'Pragmatic Stabilizers'

    const stats = mgrId ? (mgrStats.get(mgrId) ?? aggregateStats([])) : aggregateStats([])

    contexts.push({
      id: team.id, name: team.name, profile, level,
      managerName: mgrId ? (profileMap.get(mgrId) ?? 'Unknown') : 'Unassigned',
      gamesPlayed: g, wins: w, draws: d, losses: l, winRate: wr, isNewManager: g === 0,
      priorTeams: rec?.priorTeams ?? [],
    })
    statsMap.set(team.id, stats)
  }

  // ── Generate playstyles ────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('GENERATING PLAYSTYLES FROM SCRATCH')
  console.log('='.repeat(80))

  let upserted = 0
  for (const ctx of contexts) {
    const stats = statsMap.get(ctx.id)!
    const about = genAbout(ctx, stats)
    const tendencies = genTendencies(ctx, stats)
    const weaknesses = genWeaknesses(ctx, stats)
    const coachNote = genCoachNote(ctx, stats)
    const score = LEVEL_SCORE[ctx.level] ?? 0.52

    console.log(`\n  ${ctx.name} [${ctx.managerName}] ${ctx.profile} (${ctx.level})`)
    console.log(`    ABOUT:     ${about}`)
    console.log(`    TENDENCY 1: ${tendencies[0]}`)
    console.log(`    WEAKNESS 1: ${weaknesses[0]}`)
    console.log(`    COACH:     ${coachNote}`)

    if (!dryRun) {
      const { error } = await supabase.from('team_dna').upsert({
        team_id: ctx.id, primary_profile: ctx.profile, primary_level: ctx.level,
        primary_score: score, primary_about: about, primary_tendencies: tendencies,
        primary_weaknesses: weaknesses, primary_coach_note: coachNote,
      }, { onConflict: 'team_id' })
      if (error) console.error(`    ERROR: ${error.message}`)
      else upserted++
    } else { upserted++ }
  }
  console.log(`\n  ${upserted} playstyles updated`)

  // ── Generate coach notes ────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('GENERATING COACH NOTES FROM SCRATCH (Week 1, Jul 7-12)')
  console.log('='.repeat(80))

  const { data: week1 } = await supabase.from('fixtures')
    .select('id, home_team_id, away_team_id, matchday, scheduled_date')
    .eq('tournament_id', LEAGUE_ID).gte('scheduled_date', '2026-07-07').lte('scheduled_date', '2026-07-12')
    .order('scheduled_date').order('matchday')

  const ctxMap = new Map(contexts.map(c => [c.id, c]))
  let notesCount = 0

  for (const fx of (week1 ?? [])) {
    const hCtx = ctxMap.get(fx.home_team_id), aCtx = ctxMap.get(fx.away_team_id)
    if (!hCtx || !aCtx) continue
    const hStats = statsMap.get(fx.home_team_id)!, aStats = statsMap.get(fx.away_team_id)!

    const hConf = cc(hCtx.level, aCtx.level)
    const hExploits = genFixtureExploits(hCtx, hStats, aCtx.name, aCtx.profile)
    const hRecs = genFixtureRecs(hCtx, hStats, aCtx.name, aCtx, aStats)

    const aConf = cc(aCtx.level, hCtx.level)
    const aExploits = genFixtureExploits(aCtx, aStats, hCtx.name, hCtx.profile)
    const aRecs = genFixtureRecs(aCtx, aStats, hCtx.name, hCtx, hStats)

    console.log(`  MD${fx.matchday} ${fx.scheduled_date}: ${hCtx.name} vs ${aCtx.name}`)
    console.log(`    H confidence: ${hConf} | A confidence: ${aConf}`)
    console.log(`    H exploit: ${hExploits[0]}`)

    if (!dryRun) {
      await supabase.from('fixture_coach_notes').upsert({ fixture_id: fx.id, team_id: hCtx.id, opponent_id: aCtx.id, confidence: hConf, opponent_will_exploit: hExploits, recommendations: hRecs }, { onConflict: 'fixture_id, team_id' })
      await supabase.from('fixture_coach_notes').upsert({ fixture_id: fx.id, team_id: aCtx.id, opponent_id: hCtx.id, confidence: aConf, opponent_will_exploit: aExploits, recommendations: aRecs }, { onConflict: 'fixture_id, team_id' })
      notesCount += 2
    } else { notesCount += 2 }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  const byP: Record<string, number> = {}
  for (const c of contexts) byP[c.profile] = (byP[c.profile] ?? 0) + 1
  for (const [p, c] of Object.entries(byP).sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${c}`)
  if (dryRun) console.log(`\nDRY RUN: ${upserted} playstyles, ${notesCount} coach notes would be written`)
  else console.log(`\nDone: ${upserted} playstyles, ${notesCount} coach notes written`)
}

main().catch(console.error)
