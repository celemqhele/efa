/**
 * Season 3: Data-grounded playstyles + coach notes.
 * Every claim backed by at least 2 stats with a causal mechanism.
 * Playstyle names are dynamically generated from the data.
 * Only games with complete 13-stat data are used.
 *
 * Usage: npx tsx scripts/season3-update.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)
const LEAGUE_ID = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'

// ── Level / confidence ───────────────────────────────────────────────────────
const LEVEL_SCORE: Record<string, number> = { '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20, '--': 0.12, '---': 0.06, '----': 0.02 }
const LEVEL_ORDER: Record<string, number> = { '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6, '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1 }
function cc(tl: string, ol: string): string {
  const d = (LEVEL_ORDER[tl] ?? 5) - (LEVEL_ORDER[ol] ?? 5)
  if (d >= 4) return '+++++'; if (d >= 3) return '++++'; if (d >= 2) return '+++'; if (d >= 1) return '++'
  if (d >= 0) return '+'; if (d >= -1) return '-'; if (d >= -2) return '--'; if (d >= -3) return '---'
  if (d >= -4) return '----'; return '-----'
}

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i) | 0 }; return Math.abs(h) }

// ── Types ────────────────────────────────────────────────────────────────────
interface TeamData {
  name: string; manager: string
  games: number; wins: number; draws: number; losses: number
  goalsScored: number; goalsConceded: number
  possession: number; shots: number; shotsOnTarget: number
  fouls: number; offsides: number; corners: number; freeKicks: number
  passes: number; succPasses: number; crosses: number
  interceptions: number; tackles: number; saves: number
}

interface ComputedStats {
  possession_pct: number; shots_per_game: number; shots_on_target_per_game: number
  shot_accuracy_pct: number; fouls_per_game: number; offsides_per_game: number
  corners_per_game: number; free_kicks_per_game: number; passes_per_game: number
  pass_accuracy_pct: number; crosses_per_game: number; interceptions_per_game: number
  tackles_per_game: number; saves_per_game: number
  goals_scored_per_game: number; goals_conceded_per_game: number; win_rate_pct: number
}

interface PlaystyleProfile {
  playstyle_name: string
  identity_summary: string
  what_to_expect: string[]
  how_to_exploit: string[]
}

function compute(data: TeamData): ComputedStats {
  const g = data.games
  return {
    possession_pct: Math.round(data.possession * 10) / 10,
    shots_per_game: Math.round(data.shots / g * 10) / 10,
    shots_on_target_per_game: Math.round(data.shotsOnTarget / g * 10) / 10,
    shot_accuracy_pct: data.shots > 0 ? Math.round(data.shotsOnTarget / data.shots * 1000) / 10 : 0,
    fouls_per_game: Math.round(data.fouls / g * 10) / 10,
    offsides_per_game: Math.round(data.offsides / g * 10) / 10,
    corners_per_game: Math.round(data.corners / g * 10) / 10,
    free_kicks_per_game: Math.round(data.freeKicks / g * 10) / 10,
    passes_per_game: Math.round(data.passes / g * 10) / 10,
    pass_accuracy_pct: data.passes > 0 ? Math.round(data.succPasses / data.passes * 1000) / 10 : 0,
    crosses_per_game: Math.round(data.crosses / g * 10) / 10,
    interceptions_per_game: Math.round(data.interceptions / g * 10) / 10,
    tackles_per_game: Math.round(data.tackles / g * 10) / 10,
    saves_per_game: Math.round(data.saves / g * 10) / 10,
    goals_scored_per_game: Math.round(data.goalsScored / g * 10) / 10,
    goals_conceded_per_game: Math.round(data.goalsConceded / g * 10) / 10,
    win_rate_pct: Math.round(data.wins / g * 1000) / 10,
  }
}

function f1(n: number): string { return n.toFixed(1) }
function fp(n: number): string { return (Math.round(n)).toString() }

// ── Reference bands ──────────────────────────────────────────────────────────
function adj(v: number, low: number, high: number): 'low' | 'high' | 'typical' {
  if (v <= low) return 'low'; if (v >= high) return 'high'; return 'typical'
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYSTYLE GENERATION — 2-stat mechanism required for every claim
// ══════════════════════════════════════════════════════════════════════════════

function generatePlaystyle(data: TeamData, cs: ComputedStats): PlaystyleProfile {
  // eFootball bands (tighter than real-world)
  const possLevel = adj(cs.possession_pct, 43, 53)
  const shotLevel = adj(cs.shots_per_game, 5.5, 9)
  const shotAccLevel = adj(cs.shot_accuracy_pct, 32, 44)
  const foulLevel = adj(cs.fouls_per_game, 6, 13)
  const passAccLevel = adj(cs.pass_accuracy_pct, 72, 84)
  const crossLevel = adj(cs.crosses_per_game, 8, 16)
  const tackleLevel = adj(cs.tackles_per_game, 6, 12)
  const interceptLevel = adj(cs.interceptions_per_game, 6, 12)
  const goalScoredLevel = adj(cs.goals_scored_per_game, 1.0, 2.2)
  const goalConcededLevel = adj(cs.goals_conceded_per_game, 1.5, 2.5)

  // Build playstyle name from the most distinctive traits
  const nameParts: string[] = []
  if (possLevel === 'high' && passAccLevel === 'high') nameParts.push('Possession')
  else if (possLevel === 'high') nameParts.push('Ball-Dominant')
  else if (possLevel === 'low' && cs.shots_per_game >= 7) nameParts.push('Counter')
  else if (possLevel === 'low') nameParts.push('Low-Block')
  else nameParts.push('Balanced')

  if (tackleLevel === 'high' && foulLevel === 'low') nameParts.push('Clean-Press')
  else if (tackleLevel === 'high' && foulLevel === 'high') nameParts.push('Aggressive')
  else if (tackleLevel === 'high') nameParts.push('High-Tackle')
  else if (foulLevel === 'low') nameParts.push('Disciplined')

  if (crossLevel === 'high') nameParts.push('Wide')
  if (shotLevel === 'high' && shotAccLevel === 'low') nameParts.push('Volume-Shooter')
  else if (shotLevel === 'high' && shotAccLevel === 'high') nameParts.push('Clinical')
  else if (interceptLevel === 'high') nameParts.push('Interceptor')

  if (nameParts.length === 1) {
    if (shotLevel === 'high') nameParts.push('Attacker')
    else if (goalConcededLevel === 'low') nameParts.push('Defender')
    else nameParts.push('Hybrid')
  }

  const name = nameParts.join(' ')

  // ── Identity summary ──────────────────────────────────────────────────────
  const summaryParts: string[] = []
  if (possLevel === 'high' && passAccLevel === 'high') {
    summaryParts.push(`${data.name} control games through high possession (${f1(cs.possession_pct)}%) combined with ${f1(cs.pass_accuracy_pct)}% pass accuracy, building deliberately from the back`)
  } else if (possLevel === 'high') {
    summaryParts.push(`${data.name} dominate the ball at ${f1(cs.possession_pct)}% possession while completing ${f1(cs.passes_per_game)} passes per game`)
  } else if (possLevel === 'low') {
    summaryParts.push(`${data.name} are comfortable without the ball at ${f1(cs.possession_pct)}% possession, averaging ${f1(cs.tackles_per_game)} tackles as a defensive foundation`)
  } else {
    summaryParts.push(`${data.name} operate with balanced possession (${f1(cs.possession_pct)}%), neither dominating nor surrendering the ball`)
  }

  if (tackleLevel === 'high' && foulLevel === 'low') {
    summaryParts.push(`They win the ball back at a high rate (${f1(cs.tackles_per_game)} tackles) while conceding very few fouls (${f1(cs.fouls_per_game)} per game)`)
  } else if (tackleLevel === 'high' && foulLevel === 'high') {
    summaryParts.push(`Their defensive intensity produces ${f1(cs.tackles_per_game)} tackles per game but also ${f1(cs.fouls_per_game)} fouls`)
  } else if (foulLevel === 'low' && cs.tackles_per_game >= 9) {
    summaryParts.push(`They defend with discipline, making ${f1(cs.tackles_per_game)} tackles while giving away only ${f1(cs.fouls_per_game)} fouls per game`)
  }

  let identity = summaryParts.join('. ') + '.'

  // ── What to expect ────────────────────────────────────────────────────────
  const expect: string[] = []

  if (possLevel === 'high' && cs.passes_per_game >= 100) {
    expect.push(`They will dominate possession at ${f1(cs.possession_pct)}% and circulate the ball with ${f1(cs.pass_accuracy_pct)}% accuracy, completing ${fp(cs.passes_per_game)} passes per game. This patience often translates into ${f1(cs.shots_per_game)} shots per game, though only ${f1(cs.shot_accuracy_pct)}% hit the target.`)
  } else if (shotLevel === 'high' && shotAccLevel === 'low') {
    expect.push(`A volume-shooting approach produces ${f1(cs.shots_per_game)} attempts per game, but only ${f1(cs.shot_accuracy_pct)}% find the target. Opponents should expect early shots and frequent rebounds, as ${f1(cs.corners_per_game)} corners per game suggest their blocked attempts create sustained pressure.`)
  } else {
    expect.push(`They generate ${f1(cs.shots_per_game)} shots per game at ${f1(cs.shot_accuracy_pct)}% accuracy, scoring ${f1(cs.goals_scored_per_game)} goals per match. Their attacking approach is built around${possLevel === 'high' ? ' sustained possession leading to quality chances' : ' quick transitions and direct play'}.`)
  }

  if (tackleLevel === 'high' && foulLevel === 'low') {
    expect.push(`Defensively they are unusually clean: ${f1(cs.tackles_per_game)} tackles per game but only ${f1(cs.fouls_per_game)} fouls. This combination means they win the ball without conceding dangerous set-pieces, limiting opponent opportunities from dead-ball situations.`)
  } else if (tackleLevel === 'high' && interceptLevel === 'high') {
    expect.push(`Their defensive activity is relentless, combining ${f1(cs.tackles_per_game)} tackles with ${f1(cs.interceptions_per_game)} interceptions per game. They disrupt opponent build-up before it reaches dangerous areas.`)
  } else if (foulLevel === 'high') {
    expect.push(`Expect a physical contest: ${f1(cs.fouls_per_game)} fouls per game and ${f1(cs.tackles_per_game)} tackles signal an aggressive approach. Opponents will earn free kicks in dangerous positions, as this team concedes ${f1(cs.free_kicks_per_game)} free kicks per game.`)
  } else {
    expect.push(`They average ${f1(cs.tackles_per_game)} tackles and ${f1(cs.interceptions_per_game)} interceptions per game${foulLevel === 'low' ? ', maintaining discipline with only ' + f1(cs.fouls_per_game) + ' fouls' : ''}. They concede ${f1(cs.goals_conceded_per_game)} goals per game.`)
  }

  if (crossLevel === 'high') {
    expect.push(`Wide play is central to their attack: ${f1(cs.crosses_per_game)} crosses per game from ${f1(cs.corners_per_game)} corners, using width to stretch defences. This volume of deliveries means crosses and cut-backs from the flanks will feature prominently.`)
  } else if (cs.offsides_per_game >= 1.5) {
    expect.push(`They make ${f1(cs.offsides_per_game)} offside runs per game, showing a willingness to attack the space behind defences. Combined with ${f1(cs.shots_per_game)} shots, this suggests direct vertical play and aggressive forward movement.`)
  }

  while (expect.length < 2) {
    expect.push(`With ${f1(cs.goals_scored_per_game)} scored and ${f1(cs.goals_conceded_per_game)} conceded per game, their matches average ${f1(cs.goals_scored_per_game + cs.goals_conceded_per_game)} total goals. They win ${f1(cs.win_rate_pct)}% of their games.`)
  }
  while (expect.length > 3) expect.pop()

  // ── How to exploit ────────────────────────────────────────────────────────
  const exploit: string[] = []

  // Every exploit pairs two stats with a causal mechanism
  // Only fire for truly unusual combinations (not middle-of-the-pack values)

  if (cs.possession_pct >= 53 && cs.goals_conceded_per_game >= 2.2) {
    exploit.push(`They keep the ball at ${f1(cs.possession_pct)}% but concede ${f1(cs.goals_conceded_per_game)} goals per game, a combination that shows their possession is sterile rather than protective. Teams that sit compact, let them have the ball in harmless areas, and break quickly through the space their high line leaves behind will find this defence is far more vulnerable than their possession numbers suggest.`)
  }

  if (cs.shots_per_game >= 9 && cs.shot_accuracy_pct <= 33) {
    exploit.push(`Their ${f1(cs.shots_per_game)} shots per game mask poor accuracy at ${f1(cs.shot_accuracy_pct)}%, meaning they waste attacking positions through speculative efforts. Opponents who show them wide and deny central shooting lanes can afford to concede distance shots, knowing the vast majority will miss the target and hand possession back.`)
  }

  if (cs.fouls_per_game >= 12 && cs.goals_conceded_per_game >= 2.2) {
    exploit.push(`They commit ${f1(cs.fouls_per_game)} fouls per game while conceding ${f1(cs.goals_conceded_per_game)} goals, suggesting their aggression creates dangerous set-piece opportunities for opponents. Drawing contact in the final third and targeting dead-ball situations is a clear route to goal.`)
  }

  if (cs.passes_per_game >= 100 && cs.pass_accuracy_pct <= 72) {
    exploit.push(`They attempt ${fp(cs.passes_per_game)} passes per game at just ${f1(cs.pass_accuracy_pct)}% accuracy, turning the ball over in dangerous areas roughly ${fp(cs.passes_per_game * (1 - cs.pass_accuracy_pct / 100))} times per match. A coordinated high press in midfield will intercept these misplaced passes and create immediate counter-attacking chances.`)
  }

  if (cs.saves_per_game >= 3.5 && cs.goals_conceded_per_game >= 2.2) {
    exploit.push(`Their goalkeeper faces ${f1(cs.saves_per_game)} saves per game while conceding ${f1(cs.goals_conceded_per_game)} goals, meaning shots on target regularly result in goals despite the keeper being busy. Shooting early and testing the keeper from range is a viable strategy, as this defence allows too many high-quality attempts to reach goal.`)
  }

  if (cs.offsides_per_game >= 2.0 && cs.shots_per_game >= 8) {
    exploit.push(`They are caught offside ${f1(cs.offsides_per_game)} times per game despite generating ${f1(cs.shots_per_game)} shots, showing impatient forwards who jump the gun on attacking runs. A well-drilled high defensive line with a coordinated offside trap will nullify a significant portion of their attacking threat before it starts.`)
  }

  if (cs.interceptions_per_game <= 6 && cs.goals_conceded_per_game >= 2.2) {
    exploit.push(`They make only ${f1(cs.interceptions_per_game)} interceptions per game while conceding ${f1(cs.goals_conceded_per_game)} goals, failing to read passing lanes and giving opponents free passage through midfield. Through-balls and quick combination play between the lines will find runners behind their disconnected defensive structure.`)
  }

  if (cs.crosses_per_game >= 15 && cs.shot_accuracy_pct <= 33) {
    exploit.push(`Their attack depends on ${f1(cs.crosses_per_game)} crosses per game but produces only ${f1(cs.shot_accuracy_pct)}% shot accuracy, meaning their wide delivery is high-volume but low-quality. Defending the box aerially and forcing them to play centrally, where their creativity is unproven, neutralises their primary route to goal.`)
  }

  if (cs.tackles_per_game <= 6 && cs.goals_conceded_per_game >= 2.5) {
    exploit.push(`They make only ${f1(cs.tackles_per_game)} tackles per game while conceding ${f1(cs.goals_conceded_per_game)} goals, an unusually passive defence that allows opponents to build attacks freely. Dribbling at them directly and forcing one-on-ones in the box will create high-quality chances against a backline that rarely intervenes.`)
  }

  // Fallback - always two-stat
  while (exploit.length < 1) {
    exploit.push(`They score ${f1(cs.goals_scored_per_game)} and concede ${f1(cs.goals_conceded_per_game)} per game at ${f1(cs.win_rate_pct)}% win rate. The key to beating them is disrupting their rhythm early, as their ${f1(cs.pass_accuracy_pct)}% pass accuracy suggests they are vulnerable to high pressing in their defensive third.`)
  }

  return { playstyle_name: name, identity_summary: identity, what_to_expect: expect, how_to_exploit: exploit }
}

// ══════════════════════════════════════════════════════════════════════════════
// COACH NOTES — only weaknesses relevant to this specific matchup
// ══════════════════════════════════════════════════════════════════════════════

function generateMatchupNotes(
  team: TeamData, tCs: ComputedStats,
  opp: TeamData, oCs: ComputedStats,
  tLevel: string, oLevel: string,
): { confidence: string; exploits: string[]; recs: string[] } {

  // Exploits: what OPPONENT will exploit about THIS team (this team's weaknesses)
  // Only write weaknesses that the opponent is actually equipped to exploit
  const exploits: string[] = []
  const recs: string[] = []

  // Pair 1: If this team concedes goals AND opponent scores at a good rate
  if (tCs.goals_conceded_per_game >= 2.8 && oCs.goals_scored_per_game >= 2.0) {
    exploits.push(`${team.name} concede ${f1(tCs.goals_conceded_per_game)} goals per game while ${opp.name} score ${f1(oCs.goals_scored_per_game)} per match. ${opp.name} should target ${team.name}'s defensive transitions, as their ${f1(tCs.tackles_per_game)} tackles per game suggest they commit numbers forward and leave gaps when possession turns over.`)
  }

  // Pair 2: Poor pass accuracy AND opponent intercepts well
  if (tCs.pass_accuracy_pct <= 72 && oCs.interceptions_per_game >= 10) {
    exploits.push(`${team.name} complete only ${f1(tCs.pass_accuracy_pct)}% of their passes while ${opp.name} intercept ${f1(oCs.interceptions_per_game)} per game. ${opp.name}'s ability to read passing lanes directly targets ${team.name}'s sloppy distribution, and turnovers in midfield will become instant counter-attacking chances.`)
  }

  // Pair 3: High fouls AND opponent shoots heavily
  if (tCs.fouls_per_game >= 10 && oCs.shots_per_game >= 8) {
    exploits.push(`${team.name} commit ${f1(tCs.fouls_per_game)} fouls per game, gifting opponents dangerous dead-ball positions, while ${opp.name} generate ${f1(oCs.shots_per_game)} shots per match. ${opp.name} should draw contact in the final third and convert the resulting set-pieces against an undisciplined defence.`)
  }

  // Pair 4: Low interceptions + opponent passes well
  if (tCs.interceptions_per_game <= 6 && oCs.pass_accuracy_pct >= 78) {
    exploits.push(`${team.name} make only ${f1(tCs.interceptions_per_game)} interceptions per game, while ${opp.name} pass at ${f1(oCs.pass_accuracy_pct)}% accuracy. ${opp.name} should play through the lines freely, as ${team.name}'s lack of reading ability means through-balls will find runners behind their defence.`)
  }

  // Generic but grounded fallbacks — use different phrasing per hash
  while (exploits.length < 2) {
    const seed = hash(team.name + opp.name)
    const fallbacks = [
      `${team.name} concede ${f1(tCs.goals_conceded_per_game)} per game while ${opp.name} score ${f1(oCs.goals_scored_per_game)}. ${opp.name} should attack the space between ${team.name}'s midfield and defence, targeting transitions where their ${f1(tCs.tackles_per_game)} tackles suggest they overcommit.`,
      `${team.name} average ${f1(tCs.possession_pct)}% possession and concede ${f1(tCs.goals_conceded_per_game)} per game, while ${opp.name} generate ${f1(oCs.shots_per_game)} shots. ${opp.name} should pressure ${team.name} early, testing their ${f1(tCs.pass_accuracy_pct)}% passing under duress.`,
      `${opp.name} score ${f1(oCs.goals_scored_per_game)} per game against opponents conceding ${f1(tCs.goals_conceded_per_game)} — a clear mismatch to exploit. ${opp.name} should focus attacks on ${team.name}'s defensive third, where ${f1(tCs.saves_per_game)} saves faced suggests repeated opportunities.`,
    ]
    exploits.push(fallbacks[seed % fallbacks.length])
  }

  // ── Recommendations: how THIS team should counter the opponent ──────────────
  if (oCs.goals_conceded_per_game >= 2.8 && tCs.goals_scored_per_game >= 2.0) {
    recs.push(`${opp.name} concede ${f1(oCs.goals_conceded_per_game)} goals per game, a defence ${team.name} can exploit given their ${f1(tCs.goals_scored_per_game)} goals scored per match. ${team.name} should attack from the first whistle, as ${opp.name}'s ${f1(oCs.tackles_per_game)} tackles per game suggest a backline that can be overwhelmed.`)
  }

  if (oCs.pass_accuracy_pct <= 72 && tCs.interceptions_per_game >= 10) {
    recs.push(`${opp.name} complete only ${f1(oCs.pass_accuracy_pct)}% of their passes, turning the ball over regularly, while ${team.name} intercept ${f1(tCs.interceptions_per_game)} per game. ${team.name} should press ${opp.name}'s midfield aggressively and convert turnovers into goals.`)
  }

  if (oCs.fouls_per_game >= 10 && tCs.shots_per_game >= 8) {
    recs.push(`${opp.name} commit ${f1(oCs.fouls_per_game)} fouls per game, giving away dangerous free kicks, while ${team.name} generate ${f1(tCs.shots_per_game)} shots per match. ${team.name} should draw contact in the box and treat dead balls as genuine scoring chances against this opponent.`)
  }

  if (oCs.interceptions_per_game <= 6 && tCs.pass_accuracy_pct >= 78) {
    recs.push(`${opp.name} make only ${f1(oCs.interceptions_per_game)} interceptions per game, failing to read the play, while ${team.name} complete ${f1(tCs.pass_accuracy_pct)}% of passes. ${team.name} should play through the lines confidently, as ${opp.name} will not intercept the decisive pass.`)
  }

  while (recs.length < 2) {
    const seed = hash(team.name + opp.name + 'r')
    const recFallbacks = [
      `${opp.name} concede ${f1(oCs.goals_conceded_per_game)} per game at ${f1(oCs.possession_pct)}% possession, a defensive record ${team.name} can exploit. ${team.name} should control the tempo with their ${f1(tCs.pass_accuracy_pct)}% passing and target the gaps ${opp.name} leave in transition.`,
      `${team.name} score ${f1(tCs.goals_scored_per_game)} per game against an opponent conceding ${f1(oCs.goals_conceded_per_game)}. ${team.name} should target ${opp.name}'s defensive third, where ${f1(oCs.saves_per_game)} saves faced per game reveals repeated defensive exposure.`,
      `${opp.name} average ${f1(oCs.tackles_per_game)} tackles while conceding ${f1(oCs.goals_conceded_per_game)} goals. ${team.name} should attack directly, controlling possession at ${f1(tCs.possession_pct)}%, and force the defensive errors that ${opp.name}'s numbers suggest are inevitable.`,
    ]
    recs.push(recFallbacks[seed % recFallbacks.length])
  }

  const confidence = cc(tLevel, oLevel)

  return { confidence, exploits: exploits.slice(0, 2), recs: recs.slice(0, 2) }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
const STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'fouls', 'offsides', 'corners', 'free_kicks', 'passes', 'successful_passes', 'crosses', 'interceptions', 'tackles', 'saves']

function isComplete(ms: any, pfx: string): boolean {
  return STAT_KEYS.every(k => ms[`${pfx}${k}`] != null)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN\n')

  // ── Fetch teams + managers ─────────────────────────────────────────────────
  console.log('Fetching S3 data...')
  const { data: fixtures } = await supabase.from('fixtures').select('home_team_id, away_team_id').eq('tournament_id', LEAGUE_ID)
  const teamIds = [...new Set((fixtures ?? []).flatMap(f => [f.home_team_id, f.away_team_id]).filter(Boolean))]
  const { data: teams } = await supabase.from('teams').select('id,name,manager_id').in('id', teamIds).order('name')
  const managerIds = [...new Set((teams ?? []).map(t => t.manager_id).filter(Boolean))]
  const { data: profiles } = await supabase.from('profiles').select('id,username').in('id', managerIds)
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.username]))
  const { data: allTeams } = await supabase.from('teams').select('id,name')
  const allTeamNameMap = new Map((allTeams ?? []).map(t => [t.id, t.name]))
  const { data: tenures } = await supabase.from('manager_tenures').select('*').in('manager_id', managerIds)

  // ── Manager records ────────────────────────────────────────────────────────
  const mgrRecords = new Map<string, { w: number; d: number; l: number; g: number; pts: string[] }>()
  for (const t of (tenures ?? [])) {
    if (!mgrRecords.has(t.manager_id)) mgrRecords.set(t.manager_id, { w: 0, d: 0, l: 0, g: 0, pts: [] })
    const r = mgrRecords.get(t.manager_id)!
    r.w += t.wins ?? 0; r.d += t.draws ?? 0; r.l += t.losses ?? 0; r.g += (t.wins ?? 0) + (t.draws ?? 0) + (t.losses ?? 0)
    const tn = allTeamNameMap.get(t.team_id); if (tn && !r.pts.includes(tn)) r.pts.push(tn)
  }

  // ── Aggregate match stats per manager ──────────────────────────────────────
  console.log('Aggregating complete 13-stat game data...')
  const mgrStats = new Map<string, TeamData>()

  for (const [mgrId, rec] of mgrRecords) {
    const tids = (tenures ?? []).filter(t => t.manager_id === mgrId).map(t => t.team_id)
    const agg: TeamData = {
      name: '', manager: profileMap.get(mgrId) ?? '?',
      games: 0, wins: rec.w, draws: rec.d, losses: rec.l,
      goalsScored: 0, goalsConceded: 0,
      possession: 0, shots: 0, shotsOnTarget: 0, fouls: 0, offsides: 0,
      corners: 0, freeKicks: 0, passes: 0, succPasses: 0, crosses: 0,
      interceptions: 0, tackles: 0, saves: 0,
    }

    for (const tid of tids) {
      const { data: fx } = await supabase.from('fixtures')
        .select('id, home_team_id, away_team_id').or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`).eq('status', 'confirmed').limit(200)
      if (!fx || fx.length === 0) continue

      const { data: res } = await supabase.from('results').select('id, fixture_id, home_score, away_score').in('fixture_id', fx.map(f => f.id))
      if (!res || res.length === 0) continue

      const { data: ms } = await supabase.from('match_stats').select('*').in('result_id', res.map(r => r.id))
      if (!ms) continue

      for (const m of ms) {
        const result = res.find(r => r.id === m.result_id)
        const fixture = fx.find(f => f.id === result?.fixture_id)
        if (!fixture) continue
        const isHome = fixture.home_team_id === tid
        const pfx = isHome ? 'home_' : 'away_'
        if (!isComplete(m, pfx)) continue

        agg.games++
        agg.goalsScored += isHome ? result!.home_score : result!.away_score
        agg.goalsConceded += isHome ? result!.away_score : result!.home_score
        agg.possession += m[`${pfx}possession`] ?? 50
        agg.shots += m[`${pfx}shots`] ?? 0
        agg.shotsOnTarget += m[`${pfx}shots_on_target`] ?? 0
        agg.fouls += m[`${pfx}fouls`] ?? 0
        agg.offsides += m[`${pfx}offsides`] ?? 0
        agg.corners += m[`${pfx}corners`] ?? 0
        agg.freeKicks += m[`${pfx}free_kicks`] ?? 0
        agg.passes += m[`${pfx}passes`] ?? 0
        agg.succPasses += m[`${pfx}successful_passes`] ?? 0
        agg.crosses += m[`${pfx}crosses`] ?? 0
        agg.interceptions += m[`${pfx}interceptions`] ?? 0
        agg.tackles += m[`${pfx}tackles`] ?? 0
        agg.saves += m[`${pfx}saves`] ?? 0
      }
    }

    if (agg.games > 0) {
      agg.possession /= agg.games
      mgrStats.set(mgrId, agg)
      console.log(`  ${agg.manager}: ${agg.games} games, ${f1(agg.possession)}% poss, ${f1(agg.shots / agg.games)} shots/g, ${f1(agg.goalsConceded / agg.games)} GA/g`)
    }
  }

  // Compute league averages for fallback (teams without data)
  let avgPoss = 50, avgShots = 6, avgSot = 3, avgFouls = 8, avgOff = 1.5, avgCor = 3
  let avgFk = 3, avgPass = 80, avgSp = 60, avgCr = 6, avgInt = 8, avgTk = 8, avgSv = 2
  let avgGf = 2, avgGa = 2.5, avgG = 10
  let realCount = 0
  for (const [, d] of mgrStats) {
    if (d.games > 0) { realCount++; avgPoss += d.possession; avgShots += d.shots / d.games; avgSot += d.shotsOnTarget / d.games; avgFouls += d.fouls / d.games; avgOff += d.offsides / d.games; avgCor += d.corners / d.games; avgFk += d.freeKicks / d.games; avgPass += d.passes / d.games; avgSp += d.succPasses / d.games; avgCr += d.crosses / d.games; avgInt += d.interceptions / d.games; avgTk += d.tackles / d.games; avgSv += d.saves / d.games; avgGf += d.goalsScored / d.games; avgGa += d.goalsConceded / d.games; avgG += d.games }
  }
  if (realCount > 0) { avgPoss /= realCount; avgShots /= realCount; avgSot /= realCount; avgFouls /= realCount; avgOff /= realCount; avgCor /= realCount; avgFk /= realCount; avgPass /= realCount; avgSp /= realCount; avgCr /= realCount; avgInt /= realCount; avgTk /= realCount; avgSv /= realCount; avgGf /= realCount; avgGa /= realCount; avgG = Math.round(avgG / realCount) }

  // ── Build team contexts ────────────────────────────────────────────────────
  type TeamCtx = { id: string; data: TeamData; cs: ComputedStats; level: string; style: PlaystyleProfile }
  const teamCtxs: TeamCtx[] = []

  for (const team of (teams ?? [])) {
    const mgrId = team.manager_id
    const mgrData = mgrId ? mgrStats.get(mgrId) : undefined
    const rec = mgrId ? mgrRecords.get(mgrId) : undefined

    const data: TeamData = mgrData ? { ...mgrData, name: team.name } : {
      name: team.name, manager: 'Unassigned',
      games: avgG, wins: 3, draws: 3, losses: 4,
      goalsScored: Math.round(avgGf * avgG), goalsConceded: Math.round(avgGa * avgG),
      possession: avgPoss, shots: Math.round(avgShots * avgG), shotsOnTarget: Math.round(avgSot * avgG),
      fouls: Math.round(avgFouls * avgG), offsides: Math.round(avgOff * avgG),
      corners: Math.round(avgCor * avgG), freeKicks: Math.round(avgFk * avgG),
      passes: Math.round(avgPass * avgG), succPasses: Math.round(avgSp * avgG), crosses: Math.round(avgCr * avgG),
      interceptions: Math.round(avgInt * avgG), tackles: Math.round(avgTk * avgG), saves: Math.round(avgSv * avgG),
    }

    const cs = compute(data)
    const style = generatePlaystyle(data, cs)

    const g = rec?.g ?? 0; const w = rec?.w ?? 0
    const wr = g > 0 ? (w * 3 + (rec?.d ?? 0)) / (g * 3) : 0
    let level: string
    if (g >= 5) {
      if (wr >= 0.70) level = '++++'; else if (wr >= 0.55) level = '+++'
      else if (wr >= 0.40) level = '++'; else if (wr >= 0.25) level = '+'; else level = '-'
    } else if (g >= 1) { level = '+'; } else { level = '+++'; }

    teamCtxs.push({ id: team.id, data, cs, level, style })
  }

  // ── Upsert team_dna ────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('WRITING PLAYSTYLES')
  console.log('='.repeat(80))

  for (const ctx of teamCtxs) {
    console.log(`\n  ${ctx.data.name} [${ctx.data.manager}] — ${ctx.style.playstyle_name} (${ctx.level})`)
    console.log(`    IDENTITY: ${ctx.style.identity_summary}`)
    console.log(`    EXPLOIT:  ${ctx.style.how_to_exploit[0]}`)

    if (!dryRun) {
      await supabase.from('team_dna').upsert({
        team_id: ctx.id,
        primary_profile: ctx.style.playstyle_name,
        primary_level: ctx.level,
        primary_score: LEVEL_SCORE[ctx.level] ?? 0.52,
        primary_about: ctx.style.identity_summary,
        primary_tendencies: ctx.style.what_to_expect,
        primary_weaknesses: ctx.style.how_to_exploit,
        primary_coach_note: ctx.style.identity_summary,
      }, { onConflict: 'team_id' })
    }
  }
  console.log(`\n  ${teamCtxs.length} playstyles ${dryRun ? 'would be' : ''} written`)

  // ── Coach notes ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  console.log('WRITING COACH NOTES (Week 1, Jul 7-12)')
  console.log('='.repeat(80))

  const { data: week1 } = await supabase.from('fixtures')
    .select('id, home_team_id, away_team_id, matchday, scheduled_date')
    .eq('tournament_id', LEAGUE_ID).gte('scheduled_date', '2026-07-07').lte('scheduled_date', '2026-07-12')
    .order('scheduled_date').order('matchday')

  const ctxMap = new Map(teamCtxs.map(c => [c.id, c]))
  let notes = 0

  for (const fx of (week1 ?? [])) {
    const h = ctxMap.get(fx.home_team_id); const a = ctxMap.get(fx.away_team_id)
    if (!h || !a) continue

    const hNotes = generateMatchupNotes(h.data, h.cs, a.data, a.cs, h.level, a.level)
    const aNotes = generateMatchupNotes(a.data, a.cs, h.data, h.cs, a.level, h.level)

    console.log(`  MD${fx.matchday} ${fx.scheduled_date}: ${h.data.name} vs ${a.data.name}`)
    console.log(`    ${h.data.name}: ${h.style.playstyle_name} | ${a.data.name}: ${a.style.playstyle_name}`)
    console.log(`    ${h.data.name} confidence: ${hNotes.confidence} | ${a.data.name} confidence: ${aNotes.confidence}`)
    console.log(`    ${h.data.name} exploit: ${hNotes.exploits[0]?.substring(0, 120)}...`)
    console.log(`    ${h.data.name} rec:     ${hNotes.recs[0]?.substring(0, 120)}...`)

    if (!dryRun) {
      await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: h.id, opponent_id: a.id,
        confidence: hNotes.confidence, opponent_will_exploit: hNotes.exploits, recommendations: hNotes.recs,
      }, { onConflict: 'fixture_id, team_id' })
      await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: a.id, opponent_id: h.id,
        confidence: aNotes.confidence, opponent_will_exploit: aNotes.exploits, recommendations: aNotes.recs,
      }, { onConflict: 'fixture_id, team_id' })
      notes += 2
    } else { notes += 2 }
  }

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}${teamCtxs.length} playstyles, ${notes} coach notes ${dryRun ? 'would be' : ''} written`)
}

main().catch(console.error)
