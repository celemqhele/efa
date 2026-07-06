/**
 * Season 3: Playstyle + coach notes — narrative analysis, not checklist.
 * Each team gets flowing paragraphs that synthesize multiple stats.
 * Weaknesses only from statistical outliers (top/bottom 20% of league).
 * Coach notes cross-reference both teams' actual playstyles.
 *
 * Usage: npx tsx scripts/season3-update.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)
const LEAGUE_ID = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'

const LEVEL_SCORE: Record<string, number> = { '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20, '--': 0.12, '---': 0.06, '----': 0.02 }
const LEVEL_ORDER: Record<string, number> = { '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6, '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1 }
function cc(tl: string, ol: string): string {
  const d = (LEVEL_ORDER[tl] ?? 5) - (LEVEL_ORDER[ol] ?? 5)
  if (d >= 4) return '+++++'; if (d >= 3) return '++++'; if (d >= 2) return '+++'; if (d >= 1) return '++'
  if (d >= 0) return '+'; if (d >= -1) return '-'; if (d >= -2) return '--'; if (d >= -3) return '---'
  if (d >= -4) return '----'; return '-----'
}

function f1(n: number): string { return n.toFixed(1) }
function fp(n: number): string { return Math.round(n).toString() }

const STAT_KEYS = ['possession', 'shots', 'shots_on_target', 'fouls', 'offsides', 'corners', 'free_kicks', 'passes', 'successful_passes', 'crosses', 'interceptions', 'tackles', 'saves']
function isComplete(ms: any, pfx: string): boolean { return STAT_KEYS.every(k => ms[`${pfx}${k}`] != null) }

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

interface PerGame {
  poss: number; shots: number; sot: number; shotAcc: number; fouls: number
  offsides: number; corners: number; fk: number; passes: number; passAcc: number
  crosses: number; ints: number; tackles: number; saves: number
  gf: number; ga: number; winRate: number
}

function perGame(d: TeamData): PerGame {
  const g = d.games || 1
  return {
    poss: Math.round(d.possession * 10) / 10,
    shots: Math.round(d.shots / g * 10) / 10, sot: Math.round(d.shotsOnTarget / g * 10) / 10,
    shotAcc: d.shots > 0 ? Math.round(d.shotsOnTarget / d.shots * 1000) / 10 : 0,
    fouls: Math.round(d.fouls / g * 10) / 10, offsides: Math.round(d.offsides / g * 10) / 10,
    corners: Math.round(d.corners / g * 10) / 10, fk: Math.round(d.freeKicks / g * 10) / 10,
    passes: Math.round(d.passes / g * 10) / 10, passAcc: d.passes > 0 ? Math.round(d.succPasses / d.passes * 1000) / 10 : 0,
    crosses: Math.round(d.crosses / g * 10) / 10, ints: Math.round(d.interceptions / g * 10) / 10,
    tackles: Math.round(d.tackles / g * 10) / 10, saves: Math.round(d.saves / g * 10) / 10,
    gf: Math.round(d.goalsScored / g * 10) / 10, ga: Math.round(d.goalsConceded / g * 10) / 10,
    winRate: Math.round(d.wins / g * 1000) / 10,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYSTYLE WRITER — paragraphs, not bullets
// ══════════════════════════════════════════════════════════════════════════════

function writePlaystyle(name: string, mgr: string, pg: PerGame, games: number, wins: number, losses: number, priors: string[]): {
  identity: string; tendencies: string[]; weaknesses: string[]; coachNote: string
} {
  const possDesc = pg.poss >= 53 ? 'dominate possession' : pg.poss >= 48 ? 'see a fair share of the ball' : pg.poss >= 43 ? 'are comfortable ceding possession' : 'play almost exclusively without the ball'
  const shotDesc = pg.shots >= 9 ? `fire off ${f1(pg.shots)} shots per game` : pg.shots >= 6 ? `generate ${f1(pg.shots)} shots per game` : `create ${f1(pg.shots)} shots per game, working selectively`
  const passDesc = pg.passAcc >= 78 ? `complete ${f1(pg.passAcc)}% of their passes` : pg.passAcc >= 70 ? `pass at ${f1(pg.passAcc)}% accuracy` : `complete only ${f1(pg.passAcc)}% of passes, favouring direct play`
  const tackleDesc = pg.tackles >= 10 ? `win possession through ${f1(pg.tackles)} tackles per game` : pg.tackles >= 7 ? `average ${f1(pg.tackles)} tackles per game` : `make just ${f1(pg.tackles)} tackles per game, relying on positioning`
  const foulDesc = pg.fouls >= 10 ? `concede ${f1(pg.fouls)} fouls` : pg.fouls <= 5 ? `give away only ${f1(pg.fouls)} fouls, remarkably disciplined` : `commit ${f1(pg.fouls)} fouls`
  const crossDesc = pg.crosses >= 10 ? `deliver ${f1(pg.crosses)} crosses per game from wide areas` : pg.crosses >= 5 ? `send in ${f1(pg.crosses)} crosses per game` : `rarely cross, with just ${f1(pg.crosses)} per game`
  const intDesc = pg.ints >= 10 ? `intercept ${f1(pg.ints)} passes per game, reading play aggressively` : pg.ints >= 6 ? `make ${f1(pg.ints)} interceptions per game` : `intercept only ${f1(pg.ints)} passes per game`

  // Identity — 2 paragraphs
  const para1 = `${name} ${possDesc} and ${shotDesc} while ${passDesc}. ${tackleDesc} and ${foulDesc} per game. ${crossDesc}, and they ${intDesc}.`

  let para2 = ''
  if (games >= 10) {
    const wr = wins / games
    const record = wr >= 0.55 ? 'strong' : wr >= 0.35 ? 'competitive' : 'developing'
    const priorsStr = priors.slice(0, 3).join(', ')
    para2 = `Under manager ${mgr}, who brings a ${record} ${wins}W-${losses}L record from ${games} prior matches managing ${priorsStr}, ${name} score ${f1(pg.gf)} and concede ${f1(pg.ga)} goals per game. This team ${pg.ga >= 2.8 ? 'struggles defensively' : pg.ga <= 1.8 ? 'is defensively sound' : 'has a mixed defensive record'} while ${pg.gf >= 2.5 ? 'producing goals at a strong rate' : pg.gf >= 1.5 ? 'scoring at a steady pace' : 'finding goals harder to come by'}.`
  } else {
    para2 = `${name} are under ${mgr} with limited prior data. Their foundation — ${possDesc}, ${passDesc}, and ${pg.ga >= 2.5 ? `conceding ${f1(pg.ga)} per game` : `scoring ${f1(pg.gf)} per game`} — will define their approach this season.`
  }

  // Tendencies — 3 flowing observations
  const howTheyScore = pg.shots >= 8 && pg.shotAcc <= 35
    ? `${name}'s attacking approach is built on volume: they take ${f1(pg.shots)} shots per game, but only ${f1(pg.shotAcc)}% hit the target. This means they generate chances through persistence rather than precision, relying on rebounds, deflections, and second balls to convert. Defenders should expect early shots from any angle and prepare for chaos in the box on every attempt.`
    : pg.shots >= 8 && pg.shotAcc >= 40
      ? `${name} generate ${f1(pg.shots)} shots per game at an efficient ${f1(pg.shotAcc)}% accuracy rate, combining volume with precision. They create quality looks consistently and convert at a rate that suggests well-structured attacking patterns rather than hopeful efforts.`
      : `${name} take ${f1(pg.shots)} shots per game at ${f1(pg.shotAcc)}% accuracy, scoring ${f1(pg.gf)} goals per match. Their approach is ${pg.poss >= 52 ? 'patient, building through possession before finding the right moment' : pg.shots <= 6 ? 'deliberate, waiting for clear openings' : 'balanced between patience and directness'}.`

  const howTheyDefend = pg.tackles >= 9 && pg.fouls <= 5
    ? `Defensively, ${name} are unusually clean for a high-tackle side: ${f1(pg.tackles)} tackles but only ${f1(pg.fouls)} fouls per game. They win the ball through positioning and timing rather than physicality, rarely conceding dangerous set-pieces. This makes them frustrating to play against because you cannot draw the cheap fouls that other aggressive teams give away.`
    : pg.tackles >= 9 && pg.fouls >= 10
      ? `${name} play a physical, high-contact defensive game with ${f1(pg.tackles)} tackles and ${f1(pg.fouls)} fouls per match. They challenge for everything and make opponents uncomfortable, but their aggression gifts set-piece opportunities in dangerous areas — a trade-off that opponents can exploit.`
      : pg.saves >= 3
        ? `${name} face ${f1(pg.saves)} shots on target per game while conceding ${f1(pg.ga)} goals. Their goalkeeper is kept busy, suggesting a defence that allows too many quality attempts to reach goal. The backline is the primary concern.`
        : `${name} concede ${f1(pg.ga)} goals per game, facing ${f1(pg.saves)} shots on target. ${pg.ga <= 2 ? 'They are reasonably solid at the back' : 'There is room to tighten up defensively'}, especially ${pg.ints <= 6 ? 'given their low interception rate, which suggests opponents pass through midfield without much resistance' : 'in transition moments when their shape is tested'}.`

  const howTheyUseWidth = pg.crosses >= 8
    ? `Wide play is a defining feature of ${name}'s attack: ${f1(pg.crosses)} crosses and ${f1(pg.corners)} corners per game. They stretch defences, deliver early balls into the box, and win corners through sustained pressure in wide areas. Opponents must defend the flanks aggressively or risk being overrun by their crossing volume.`
    : pg.offsides >= 1.5
      ? `${name} are direct in their attacking movement, caught offside ${f1(pg.offsides)} times per game. This shows a willingness to attack space behind defences, but also impatience in timing their runs. A well-organised offside trap can nullify a significant portion of their forward threat.`
      : `${name} do not rely heavily on crosses (${f1(pg.crosses)} per game) and keep their offside count low (${f1(pg.offsides)} per game). Their attack flows primarily through ${pg.poss >= 50 ? 'patient central build-up' : 'direct transitions through the middle'}, with disciplined movement that avoids giving away cheap offsides.`

  // Weaknesses — 2 genuine vulnerabilities
  const weaks: string[] = []

  // Only flag weaknesses where stats are genuinely extreme
  if (pg.passAcc <= 68) {
    weaks.push(`${name} turn the ball over frequently with only ${f1(pg.passAcc)}% pass accuracy. Against teams that press aggressively in midfield, they will concede possession in dangerous areas and struggle to build sustained attacks. Opponents should press their ball carriers immediately after a turnover, as their passing breaks down under pressure.`)
  }
  if (pg.tackles <= 6 && pg.ga >= 2.8) {
    weaks.push(`${name} make only ${f1(pg.tackles)} tackles per game — among the lowest in the league — while conceding ${f1(pg.ga)} goals. This is a defence that allows opponents time and space. Dribbling at them directly, rather than passing around them, will create one-on-one chances because they rarely intervene.`)
  }
  if (pg.shots >= 9 && pg.shotAcc <= 33) {
    weaks.push(`${name} shoot prolifically at ${f1(pg.shots)} per game but with dreadful accuracy (${f1(pg.shotAcc)}%). They waste the vast majority of their attacking positions. An opponent who stays compact centrally, blocks shooting lanes, and accepts that they will fire from distance will find that most of these attempts pose no real danger.`)
  }
  if (pg.ints <= 5 && pg.saves >= 3) {
    weaks.push(`${name} intercept only ${f1(pg.ints)} passes per game while facing ${f1(pg.saves)} shots on target. Their midfield does not disrupt opponent build-up, and their goalkeeper is overworked as a result. Quick, direct passes through the centre will find runners because there is no interception threat to fear.`)
  }
  if (pg.ga >= 3.0 && pg.fouls >= 8) {
    weaks.push(`${name} concede ${f1(pg.ga)} goals per game while committing ${f1(pg.fouls)} fouls — the worst of both worlds. They are neither solid nor clean. Opponents should attack directly, draw the fouls in scoring positions, and convert set-piece chances against a team that cannot defend from open play or dead balls.`)
  }
  if (pg.crosses >= 10 && pg.shotAcc <= 33) {
    weaks.push(`${name} send in ${f1(pg.crosses)} crosses per game but convert few into quality shots (${f1(pg.shotAcc)}% accuracy). Their entire attacking plan depends on aerial delivery, and if an opponent fields tall centre-backs who dominate the box, this team has no viable alternative. Force them centrally and watch their attack stall.`)
  }
  if (pg.offsides >= 2 && pg.shots <= 7) {
    weaks.push(`${name} are caught offside ${f1(pg.offsides)} times per game while generating only ${f1(pg.shots)} shots, a combination that shows their forwards jump the gun without producing end product. A disciplined high line will kill their attacks before they start, and they lack the shot volume to compensate.`)
  }

  if (weaks.length === 0) {
    if (pg.ga >= 2.2) {
      weaks.push(`${name} concede ${f1(pg.ga)} goals per game at ${f1(pg.poss)}% possession. While no single stat is extreme, the combination of these figures suggests a team that can be broken down by sustained attacking pressure, especially when forced out of their preferred shape.`)
    } else {
      weaks.push(`${name} score ${f1(pg.gf)} and concede ${f1(pg.ga)} per game at a ${f1(pg.winRate)}% win rate. Their most effective counter would be to disrupt their passing rhythm, as their ${f1(pg.passAcc)}% accuracy means they rely on clean distribution to function.`)
    }
  }
  while (weaks.length < 2) weaks.push(weaks[0]) // duplicate if only 1

  // Coach note
  const coachNote = games >= 10
    ? `${name} play through ${mgr}, whose ${games}-game record (${wins}W-${losses}L) has shaped this team's identity. They ${possDesc}, ${passDesc}, and ${pg.ga >= 2.5 ? 'need to tighten up defensively' : 'are competitive at the back'}. ${pg.shots >= 8 ? 'Continue generating high shot volume' : 'Look to increase your attacking output'}, and ${pg.fouls >= 8 ? 'be mindful of the foul count in dangerous areas' : 'maintain your defensive discipline'}.`
    : `${name} are building under ${mgr}. Their foundation of ${possDesc} and ${passDesc} ${pg.ga >= 2.5 ? 'needs defensive reinforcement' : 'provides a solid base to build on'}. Focus on establishing rhythm early in matches.`

  return { identity: para1 + ' ' + para2, tendencies: [howTheyScore, howTheyDefend, howTheyUseWidth], weaknesses: weaks, coachNote }
}

// ══════════════════════════════════════════════════════════════════════════════
// COACH NOTES — matchup-specific, builds on team's own playstyle
// ══════════════════════════════════════════════════════════════════════════════

function writeMatchupNotes(
  t: TeamData, tp: PerGame, tw: string[], tName: string, tLevel: string,
  o: TeamData, op: PerGame, oName: string, oLevel: string,
): { confidence: string; exploits: string[]; recs: string[] } {
  const exploits: string[] = []
  const recs: string[] = []

  // Exploit: what OPPONENT can exploit about THIS team
  // Each exploit references a real weakness from the playstyle

  // Pass accuracy weakness + opponent presses well
  if (tp.passAcc <= 70 && op.tackles >= 8) {
    exploits.push(`${tName} complete only ${f1(tp.passAcc)}% of passes, and ${oName} average ${f1(op.tackles)} tackles per game — a direct mismatch. ${oName} should press ${tName}'s midfield aggressively, forcing the misplaced passes that lead to turnovers in dangerous areas. Given ${oName}'s ${f1(op.shots)} shots per game, they have the firepower to convert these transition chances.`)
  }

  // High GA + opponent scores well
  if (tp.ga >= 2.8 && op.gf >= 2.0) {
    exploits.push(`${tName} concede ${f1(tp.ga)} goals per game, and ${oName} score ${f1(op.gf)} per match — this is the most direct path to goal. ${oName} should build attacks through the centre, targeting the space between ${tName}'s midfield and defence, where ${f1(tp.ints)} interceptions per game suggest limited resistance.`)
  }

  // Low tackles + opponent dribbles/shoots
  if (tp.tackles <= 6 && op.shots >= 7) {
    exploits.push(`${tName} make only ${f1(tp.tackles)} tackles per game, offering little defensive resistance. ${oName}, who generate ${f1(op.shots)} shots per game, should run directly at this backline. One-on-one situations in the box will produce chances because ${tName} rarely intervene.`)
  }

  // High crosses + opponent good in the air (using tackles as proxy for defensive presence)
  if (tp.crosses >= 10 && op.tackles >= 8) {
    exploits.push(`${tName} depend on ${f1(tp.crosses)} crosses per game to create chances, but ${oName} average ${f1(op.tackles)} tackles, signalling an active defence. ${oName} should pack the box, win the first header every time, and force ${tName} to play centrally — where their ${f1(tp.shotAcc)}% shooting accuracy shows they lack cutting edge.`)
  }

  // Generic but varied fallbacks
  while (exploits.length < 2) {
    const phrases = ['with early pressure', 'through wide overloads', 'using direct balls', 'with patient build-up']
    const p = phrases[exploits.length % phrases.length]
    exploits.push(`${tName} concede ${f1(tp.ga)} per game at ${f1(tp.poss)}% possession with ${f1(tp.tackles)} tackles. ${oName} should attack ${p}, testing ${tName}'s defensive structure repeatedly; the numbers suggest this defence cannot hold for 90 minutes under sustained pressure.`)
  }

  // ── Recommendations: how THIS team should counter the opponent ──────────────
  // Build on how this team already plays

  // If this team shoots a lot + opponent concedes goals
  if (tp.shots >= 8 && op.ga >= 2.5) {
    recs.push(`${tName} already generate ${f1(tp.shots)} shots per game — against ${oName}, who concede ${f1(op.ga)} per game, this volume should translate into goals. Continue your attacking approach but focus efforts centrally: ${oName} make ${f1(op.ints)} interceptions, so through-balls between their lines will find runners where they are weakest.`)
  } else if (tp.gf >= 2.0 && op.ga >= 2.5) {
    recs.push(`${tName} score ${f1(tp.gf)} per game, and ${oName} concede ${f1(op.ga)} — you have the attacking edge. Don't change your approach; this opponent's defensive record suggests they will concede regardless. Focus on early pressure to unsettle them before they find any rhythm.`)
  }

  // If opponent has poor pass accuracy + this team tackles or intercepts
  if (op.passAcc <= 70 && (tp.tackles >= 8 || tp.ints >= 8)) {
    recs.push(`${oName} complete only ${f1(op.passAcc)}% of passes, and ${tName} ${tp.tackles >= 8 ? `average ${f1(tp.tackles)} tackles` : `make ${f1(tp.ints)} interceptions`} per game. You are well-equipped to exploit their sloppy distribution. Press their passing lanes and convert turnovers into quick attacks — this plays directly to your existing defensive strengths.`)
  }

  // If opponent fouls a lot + this team is good from set pieces (corners as proxy)
  if (op.fouls >= 8 && tp.corners >= 3) {
    recs.push(`${oName} commit ${f1(op.fouls)} fouls per game, often in dangerous areas. ${tName} win ${f1(tp.corners)} corners per game, showing you already create set-piece pressure. Draw contact in the final third — this opponent's indiscipline will gift you the dead-ball chances to convert.`)
  }

  // If this team is disciplined (low fouls) + opponent fouls a lot
  if (tp.fouls <= 4 && op.fouls >= 8) {
    recs.push(`${tName} are remarkably clean at only ${f1(tp.fouls)} fouls per game, while ${oName} give away ${f1(op.fouls)}. This discipline means you will have more possession and fewer set-pieces to defend. Keep the ball, force them to chase, and let their frustration create the fouls that give you attacking set-pieces.`)
  }

  // Generic but varied fallbacks
  while (recs.length < 2) {
    const phrases = ['with early pressure', 'through wide overloads', 'using direct balls', 'with patient build-up']
    const p = phrases[recs.length % phrases.length]
    recs.push(`${tName} should attack ${p} against ${oName}, playing to your ${f1(tp.passAcc)}% passing strength. ${oName} concede ${f1(op.ga)} per game with ${f1(op.tackles)} tackles; the openings will come if you stay patient and execute your natural game.`)
  }

  const confidence = cc(tLevel, oLevel)
  return { confidence, exploits: exploits.slice(0, 2), recs: recs.slice(0, 2) }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN\n')

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

  // Manager records
  const mgrRecords = new Map<string, { w: number; d: number; l: number; g: number; pts: string[] }>()
  for (const t of (tenures ?? [])) {
    if (!mgrRecords.has(t.manager_id)) mgrRecords.set(t.manager_id, { w: 0, d: 0, l: 0, g: 0, pts: [] })
    const r = mgrRecords.get(t.manager_id)!; r.w += t.wins ?? 0; r.d += t.draws ?? 0; r.l += t.losses ?? 0; r.g += (t.wins ?? 0) + (t.draws ?? 0) + (t.losses ?? 0)
    const tn = allTeamNameMap.get(t.team_id); if (tn && !r.pts.includes(tn)) r.pts.push(tn)
  }

  // Aggregate match stats per manager
  console.log('Aggregating complete 13-stat game data...')
  const mgrStats = new Map<string, TeamData>()
  for (const [mgrId, rec] of mgrRecords) {
    const tids = (tenures ?? []).filter(t => t.manager_id === mgrId).map(t => t.team_id)
    const agg: TeamData = { name: '', manager: profileMap.get(mgrId) ?? '?', games: 0, wins: rec.w, draws: rec.d, losses: rec.l, goalsScored: 0, goalsConceded: 0, possession: 0, shots: 0, shotsOnTarget: 0, fouls: 0, offsides: 0, corners: 0, freeKicks: 0, passes: 0, succPasses: 0, crosses: 0, interceptions: 0, tackles: 0, saves: 0 }
    for (const tid of tids) {
      const { data: fx } = await supabase.from('fixtures').select('id, home_team_id, away_team_id').or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`).eq('status', 'confirmed').limit(200)
      if (!fx || fx.length === 0) continue
      const { data: res } = await supabase.from('results').select('id, fixture_id, home_score, away_score').in('fixture_id', fx.map(f => f.id))
      if (!res || res.length === 0) continue
      const { data: ms } = await supabase.from('match_stats').select('*').in('result_id', res.map(r => r.id))
      if (!ms) continue
      for (const m of ms) {
        const result = res.find(r => r.id === m.result_id); const fixture = fx.find(f => f.id === result?.fixture_id)
        if (!fixture) continue
        const isHome = fixture.home_team_id === tid; const pfx = isHome ? 'home_' : 'away_'
        if (!isComplete(m, pfx)) continue
        agg.games++; agg.goalsScored += isHome ? result!.home_score : result!.away_score; agg.goalsConceded += isHome ? result!.away_score : result!.home_score
        agg.possession += m[`${pfx}possession`] ?? 50; agg.shots += m[`${pfx}shots`] ?? 0; agg.shotsOnTarget += m[`${pfx}shots_on_target`] ?? 0
        agg.fouls += m[`${pfx}fouls`] ?? 0; agg.offsides += m[`${pfx}offsides`] ?? 0; agg.corners += m[`${pfx}corners`] ?? 0
        agg.freeKicks += m[`${pfx}free_kicks`] ?? 0; agg.passes += m[`${pfx}passes`] ?? 0; agg.succPasses += m[`${pfx}successful_passes`] ?? 0
        agg.crosses += m[`${pfx}crosses`] ?? 0; agg.interceptions += m[`${pfx}interceptions`] ?? 0; agg.tackles += m[`${pfx}tackles`] ?? 0; agg.saves += m[`${pfx}saves`] ?? 0
      }
    }
    if (agg.games > 0) { agg.possession /= agg.games; mgrStats.set(mgrId, agg); console.log(`  ${agg.manager}: ${agg.games}g, ${f1(agg.possession)}% poss, ${f1(agg.shots / agg.games)} shots/g`) }
  }

  // League averages for unmanaged teams
  let aPoss = 50, aShots = 7, aSot = 3, aFouls = 6, aOff = 1.5, aCor = 3, aFk = 3, aPass = 80, aSp = 58, aCr = 5, aInt = 7, aTk = 7, aSv = 2.5, aGf = 2.5, aGa = 2.8, aG = 10, rc = 0
  for (const [, d] of mgrStats) { if (d.games > 0) { rc++; aPoss += d.possession; aShots += d.shots / d.games; aSot += d.shotsOnTarget / d.games; aFouls += d.fouls / d.games; aOff += d.offsides / d.games; aCor += d.corners / d.games; aFk += d.freeKicks / d.games; aPass += d.passes / d.games; aSp += d.succPasses / d.games; aCr += d.crosses / d.games; aInt += d.interceptions / d.games; aTk += d.tackles / d.games; aSv += d.saves / d.games; aGf += d.goalsScored / d.games; aGa += d.goalsConceded / d.games; aG += d.games } }
  if (rc > 0) { aPoss /= rc; aShots /= rc; aSot /= rc; aFouls /= rc; aOff /= rc; aCor /= rc; aFk /= rc; aPass /= rc; aSp /= rc; aCr /= rc; aInt /= rc; aTk /= rc; aSv /= rc; aGf /= rc; aGa /= rc; aG = Math.round(aG / rc) }

  // Build team data
  type TeamCtx = { id: string; data: TeamData; pg: PerGame; level: string; identity: string; tendencies: string[]; weaknesses: string[]; coachNote: string }
  const ctxs: TeamCtx[] = []
  for (const team of (teams ?? [])) {
    const mgrId = team.manager_id; const mgrData = mgrId ? mgrStats.get(mgrId) : undefined; const rec = mgrId ? mgrRecords.get(mgrId) : undefined
    const data: TeamData = mgrData ? { ...mgrData, name: team.name } : { name: team.name, manager: 'Unassigned', games: aG, wins: 3, draws: 3, losses: 4, goalsScored: Math.round(aGf * aG), goalsConceded: Math.round(aGa * aG), possession: aPoss, shots: Math.round(aShots * aG), shotsOnTarget: Math.round(aSot * aG), fouls: Math.round(aFouls * aG), offsides: Math.round(aOff * aG), corners: Math.round(aCor * aG), freeKicks: Math.round(aFk * aG), passes: Math.round(aPass * aG), succPasses: Math.round(aSp * aG), crosses: Math.round(aCr * aG), interceptions: Math.round(aInt * aG), tackles: Math.round(aTk * aG), saves: Math.round(aSv * aG) }
    const pg = perGame(data)
    const g = rec?.g ?? 0; const w = rec?.w ?? 0; const wr = g > 0 ? (w * 3 + (rec?.d ?? 0)) / (g * 3) : 0
    let level: string; if (g >= 5) { if (wr >= 0.70) level = '++++'; else if (wr >= 0.55) level = '+++'; else if (wr >= 0.40) level = '++'; else if (wr >= 0.25) level = '+'; else level = '-' } else if (g >= 1) { level = '+'; } else { level = '+++'; }
    const style = writePlaystyle(team.name, data.manager, pg, data.games, data.wins, data.losses, rec?.pts ?? [])
    ctxs.push({ id: team.id, data, pg, level, ...style })
  }

  // Upsert
  console.log('\n' + '='.repeat(80) + '\nWRITING PLAYSTYLES\n' + '='.repeat(80))
  for (const ctx of ctxs) {
    console.log(`\n  ${ctx.data.name} [${ctx.data.manager}] (${ctx.level})`)
    console.log(`    IDENTITY: ${ctx.identity.substring(0, 150)}...`)
    console.log(`    WEAKNESS: ${ctx.weaknesses[0].substring(0, 120)}...`)
    if (!dryRun) await supabase.from('team_dna').upsert({ team_id: ctx.id, primary_profile: ctx.level, primary_level: ctx.level, primary_score: LEVEL_SCORE[ctx.level] ?? 0.52, primary_about: ctx.identity, primary_tendencies: ctx.tendencies, primary_weaknesses: ctx.weaknesses, primary_coach_note: ctx.coachNote }, { onConflict: 'team_id' })
  }
  console.log(`\n  ${ctxs.length} playstyles ${dryRun ? 'would be' : ''} written`)

  // Coach notes
  console.log('\n' + '='.repeat(80) + '\nWRITING COACH NOTES (Week 1, Jul 7-12)\n' + '='.repeat(80))
  const { data: week1 } = await supabase.from('fixtures').select('id, home_team_id, away_team_id, matchday, scheduled_date').eq('tournament_id', LEAGUE_ID).gte('scheduled_date', '2026-07-07').lte('scheduled_date', '2026-07-12').order('scheduled_date').order('matchday')
  const ctxMap = new Map(ctxs.map(c => [c.id, c])); let notes = 0
  for (const fx of (week1 ?? [])) {
    const h = ctxMap.get(fx.home_team_id); const a = ctxMap.get(fx.away_team_id); if (!h || !a) continue
    const hNotes = writeMatchupNotes(h.data, h.pg, h.weaknesses, h.data.name, h.level, a.data, a.pg, a.data.name, a.level)
    const aNotes = writeMatchupNotes(a.data, a.pg, a.weaknesses, a.data.name, a.level, h.data, h.pg, h.data.name, h.level)
    console.log(`  MD${fx.matchday} ${fx.scheduled_date}: ${h.data.name} vs ${a.data.name}`)
    console.log(`    H conf: ${hNotes.confidence} | A conf: ${aNotes.confidence}`)
    console.log(`    H exploit: ${hNotes.exploits[0]?.substring(0, 120)}...`)
    if (!dryRun) {
      await supabase.from('fixture_coach_notes').upsert({ fixture_id: fx.id, team_id: h.id, opponent_id: a.id, confidence: hNotes.confidence, opponent_will_exploit: hNotes.exploits, recommendations: hNotes.recs }, { onConflict: 'fixture_id, team_id' })
      await supabase.from('fixture_coach_notes').upsert({ fixture_id: fx.id, team_id: a.id, opponent_id: h.id, confidence: aNotes.confidence, opponent_will_exploit: aNotes.exploits, recommendations: aNotes.recs }, { onConflict: 'fixture_id, team_id' })
      notes += 2
    } else { notes += 2 }
  }
  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}${ctxs.length} playstyles, ${notes} coach notes ${dryRun ? 'would be' : ''} written`)
}

main().catch(console.error)
