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
  const out: string[] = []

  // Find specific vulnerabilities based on this team's stats
  if (stats.saves >= 4) {
    out.push(`${oppName} will target ${ctx.name}'s tendency to concede shots, averaging ${fmt1(stats.saves)} saves faced per game. Constant pressure on goal will eventually force errors from a defence that gives up too many attempts.`)
  }
  if (stats.ga >= 3.0) {
    out.push(`${ctx.name} concede ${fmt1(stats.ga)} goals per game on average, a clear weakness ${oppName} must exploit. Quick early attacks before the defence settles will produce chances against this vulnerable backline.`)
  }
  if (stats.fouls >= 2.8) {
    out.push(`${ctx.name} commit ${fmt1(stats.fouls)} fouls per game, gifting opponents dangerous set-piece positions. ${oppName} should draw contact in advanced areas and target dead-ball situations as a primary scoring route.`)
  }
  if (stats.poss <= 44) {
    out.push(`${ctx.name} average only ${fmt0(stats.poss)}% possession, meaning they defend for long stretches. ${oppName} should control the ball, move it quickly, and wear this team down with sustained pressure.`)
  }
  if (stats.fouls <= 1.2) {
    out.push(`${ctx.name} are unusually clean defensively, averaging only ${fmt1(stats.fouls)} fouls per match. ${oppName} can play physically without fear of dangerous free kicks, disrupting their rhythm through aggressive challenges.`)
  }
  if (stats.crosses >= 4) {
    out.push(`${ctx.name} rely heavily on crossing with ${fmt1(stats.crosses)} per game. ${oppName} should deploy tall centre-backs and defend the box aerially; cut off the wide supply and this attack has no alternative.`)
  }

  // Profile-specific
  if (ctx.profile === 'Gegenpressing') {
    out.push(`${ctx.name}'s high-intensity pressing will tire by the 70th minute. ${oppName} should conserve energy, absorb the early pressure, and push hard in the final quarter when gaps appear in their defensive shape.`)
  }
  if (ctx.profile === 'Tiki-Taka') {
    out.push(`${ctx.name}'s possession-based build-up is vulnerable to coordinated high pressing. ${oppName} should press their defenders and pivot player aggressively, forcing turnovers in the most dangerous areas.`)
  }

  // Fill to at least 2
  while (out.length < 2) {
    out.push(`${oppName} should study ${ctx.name}'s ${ctx.profile.toLowerCase()} system for structural weaknesses. Capitalising on moments of transition when they lose their defensive shape will create the best scoring opportunities.`)
  }

  return out.slice(0, 2)
}

// ── Fixture: RECOMMENDATIONS (how to counter opponent, 2 entries, 2 sentences each)
function genFixtureRecs(ctx: TeamContext, stats: StatLine, oppName: string, oppCtx: TeamContext, oppStats: StatLine): string[] {
  const s = hash(ctx.name + oppName + 'rec')
  const out: string[] = []

  // Recommendations based on opponent weaknesses
  if (oppStats.saves >= 4) {
    out.push(`${ctx.name} should test ${oppName}'s goalkeeper early and often, as they face ${fmt1(oppStats.saves)} shots on target per game. Building pressure through sustained attacking waves will crack this defence.`)
  }
  if (oppStats.ga >= 3.0) {
    out.push(`${oppName} concede ${fmt1(oppStats.ga)} goals per game, so ${ctx.name} must be aggressive from kickoff. An early goal will force the opponent out of their comfort zone and into mistakes.`)
  }
  if (oppStats.fouls >= 2.8) {
    out.push(`${oppName} give away ${fmt1(oppStats.fouls)} fouls per match, often in dangerous areas. ${ctx.name} should draw contact near the box and treat every free kick as a genuine scoring opportunity.`)
  }
  if (oppStats.crosses >= 4) {
    out.push(`${oppName} are overly reliant on crosses, averaging ${fmt1(oppStats.crosses)} per game. ${ctx.name} should defend narrow, win aerial duels, and force them to play through a congested central area.`)
  }
  if (oppStats.poss <= 44) {
    out.push(`${oppName} sit deep with only ${fmt0(oppStats.poss)}% possession, absorbing pressure. ${ctx.name} should be patient in build-up, move the ball quickly to shift their block, and strike when gaps appear.`)
  }
  if (oppCtx.profile === 'Gegenpressing') {
    out.push(`${oppName} press relentlessly but tire late. ${ctx.name} should stay composed under pressure, use quick one-touch passing to bypass the press, and target the final 20 minutes for the decisive push.`)
  }
  if (oppCtx.profile === 'Tiki-Taka') {
    out.push(`${oppName} control games through possession but struggle when pressed. ${ctx.name} should press their build-up aggressively, deny time on the ball, and force hurried passes that create turnover chances.`)
  }
  if (oppCtx.profile === 'Pragmatic Stabilizers') {
    out.push(`${oppName} adapt their approach but lack a dominant identity. ${ctx.name} should impose a clear game plan early, forcing constant adaptation that leads to defensive uncertainty and gaps.`)
  }
  if (oppCtx.profile === 'Elite Dominators') {
    out.push(`${oppName} dominate through quality but leave space behind their high line. ${ctx.name} should sit deep, absorb pressure, and spring quick vertical counters targeting the channels behind their full-backs.`)
  }
  if (oppCtx.profile === 'Quick Counter') {
    out.push(`${oppName} thrive on transitions but struggle when forced to create from possession. ${ctx.name} should deny them counter-attacking space by defending with a compact block and controlling the tempo.`)
  }

  while (out.length < 2) {
    out.push(`${ctx.name} should prepare for ${oppName}'s ${oppCtx.profile.toLowerCase()} approach by studying their recent patterns. Disciplined execution of their own tactical identity will create opportunities throughout the match.`)
  }

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
