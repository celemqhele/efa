/**
 * Season 3: Nuanced playstyle + coach note generation.
 * Per-team descriptions derived from manager data, stats, and profile identity.
 * Per-fixture coach notes analyze the specific profile matchup.
 *
 * Usage: npx tsx scripts/season3-nuanced.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)
const LEAGUE_ID = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'

// ──────────────────────────────────────────────────────────────────────────────
// Profile → descriptive fragments (used as building blocks, not verbatim)
// ──────────────────────────────────────────────────────────────────────────────

interface ProfileFragments {
  identity: string[]        // what this playstyle fundamentally is
  attacking: string[]       // how they attack
  defending: string[]       // how they defend
  vulnerability: string[]   // core structural weakness
  counter: string[]         // how to beat them
  recommendation: string[]  // what they should do vs opponents
}

const PROFILE_FRAGMENTS: Record<string, ProfileFragments> = {
  'Elite Dominators': {
    identity: [
      'complete territorial and technical dominance',
      'superior quality across every phase of play',
      'overwhelming opponents through sustained control',
    ],
    attacking: [
      'builds patiently from the back before accelerating in the final third',
      'overloads central areas, then switches play to isolate wide forwards',
      'creates high shot volume through combination play and positional rotations',
    ],
    defending: [
      'defends by keeping the ball — possession as the first line of defence',
      'high defensive line compresses the pitch, suffocating build-up attempts',
      'quick rest-defence shape after losing possession to deny counter-attacks',
    ],
    vulnerability: [
      'physically aggressive opponents who disrupt passing rhythm with tactical fouling',
      'compact low blocks that deny space between the lines',
      'quick vertical transitions catching the high defensive line out of position',
      'opponents who match their technical quality and refuse to be intimidated',
      'set-piece specialists who exploit the space when centre-backs push forward',
      'fatigue in the final 15 minutes from dictating possession at high intensity',
    ],
    counter: [
      'make the midfield a battleground — tactical fouls and physical duels break their flow',
      'sit deep in a compact shape, frustrate their build-up, and hit them on the break',
      'target the space behind their advancing full-backs with early balls over the top',
      'match their technical quality with your best passers and force them to work defensively',
      'use set-pieces as your primary route to goal — they commit numbers forward',
      'conserve energy early and push the tempo in the final 20 minutes when they tire',
    ],
    recommendation: [
      'control the tempo from the first whistle — dictate the rhythm and force the opponent to chase',
      'use possession to tire the opponent, then exploit defensive gaps in the final 20 minutes',
      'be patient in build-up; the openings will come as the opponent\'s defensive shape fatigues',
    ],
  },
  'Tiki-Taka': {
    identity: [
      'possession as both attack and defence through intricate short passing',
      'methodical ball circulation that probes for the perfect moment to penetrate',
      'relentless midfield triangles designed to disorient and exhaust opponents',
    ],
    attacking: [
      'draws opponents out with short passes, then exploits the space left behind',
      'creates overloads in central areas with rotating midfielders pulling markers out of position',
      'penetrates through quick one-twos and third-man runs between the lines',
    ],
    defending: [
      'counter-presses immediately after losing possession with coordinated traps',
      'maintains a compact shape that denies space between the lines',
      'uses the ball as a defensive tool — you cannot score if you do not have it',
    ],
    vulnerability: [
      'intense, coordinated high pressing that forces rushed passes and turnovers',
      'direct long balls that bypass the midfield press entirely',
      'compact low blocks that deny progressive passing lanes',
      'physical teams that disrupt passing rhythm with persistent tactical fouling',
      'opponents who mark the pivot player out of the game, cutting off the circulation hub',
      'quick wingers who exploit the space behind their advanced full-backs on the counter',
    ],
    counter: [
      'press them aggressively in their own half — they will make mistakes under pressure',
      'bypass their midfield with direct diagonal switches to isolate full-backs',
      'sit deep, stay compact, and force them into unproductive sideways passing',
      'target the defensive midfielder with a man-marker to disrupt their build-up rhythm',
      'attack the space behind their full-backs with pace on the counter',
      'foul tactically in midfield to break up their passing sequences and frustrate their tempo',
    ],
    recommendation: [
      'circulate the ball rapidly to shift the opponent\'s defensive block and create gaps',
      'be brave in possession even under pressure — their press will tire if you stay composed',
      'use the width of the pitch to stretch their defensive shape before penetrating centrally',
    ],
  },
  'Gegenpressing': {
    identity: [
      'high-intensity counter-pressing designed to win the ball back within seconds',
      'relentless aggression in defensive transitions, turning defence into immediate attack',
      'organised chaos — hunting in packs to force turnovers in dangerous areas',
    ],
    attacking: [
      'strikes within 5 seconds of winning possession, exploiting defensive disorganisation',
      'vertical passing into channels immediately after ball recovery',
      'late midfield runners arriving in the box to capitalise on second balls',
    ],
    defending: [
      'high defensive line that compresses the pitch into the opponent\'s half',
      'coordinated pressing traps that isolate the ball carrier with multiple defenders',
      'tactical fouls used to disrupt opponent rhythm and prevent dangerous transitions',
    ],
    vulnerability: [
      'space behind the high defensive line that can be exploited with precise long balls',
      'fatigue in the final 20 minutes as the high-intensity approach takes its toll',
      'composed ball-playing teams that can pass through the press',
      'wide overloads that stretch the pressing shape and create gaps centrally',
      'opponents who bait the press with short passes before launching a killer through-ball',
      'aerial duels and physical hold-up play that bypass the press entirely',
    ],
    counter: [
      'play long diagonals behind their advanced full-backs to create one-on-one chances',
      'conserve energy early, then increase intensity after the 70th minute',
      'use quick one-touch passing to bypass their pressing triggers',
      'overload the flanks with width to stretch their pressing shape',
      'hold the ball up with a physical forward and play runners off the second ball',
      'bait their press with short passes, then play a direct through-ball into the space behind',
    ],
    recommendation: [
      'set pressing traps in the opponent\'s half — force turnovers in the most dangerous areas',
      'strike quickly after winning possession before the opponent can reset defensively',
      'manage your energy output; the press must remain effective for the full 90 minutes',
    ],
  },
  'Disciplined Pressers': {
    identity: [
      'intelligent pressing through positioning and anticipation rather than aggression',
      'maximum ball recovery with minimum risk — winning possession without conceding fouls',
      'controlled defensive intensity paired with composed build-up play',
    ],
    attacking: [
      'wins possession in midfield and transitions quickly into structured attacks',
      'staggered pressing lines create predictable turnover locations for counter-launching',
      'builds from the back with numerical superiority, drawing opponents out before exploiting gaps',
    ],
    defending: [
      'cuts passing lanes through anticipation rather than chasing the ball',
      'maintains compact defensive shape while selectively pressing triggers',
      'rarely fouls — defensive actions are clean, calculated, and effective',
    ],
    vulnerability: [
      'teams that bypass midfield entirely with direct long balls over the press',
      'elite dribblers who can break through structured pressing lines',
      'deep, organised low blocks that negate their pressing advantage',
      'opponents who switch play rapidly to the weak side before the press can shift',
      'aerial threats from set-pieces when the defensive line pushes high',
      'teams that match their discipline and turn the game into a battle of patience',
    ],
    counter: [
      'play early diagonal switches to isolate full-backs before the press can set',
      'use a target forward to hold up long balls and bypass the midfield press',
      'defend deep in a compact block — deny them the space their press relies on',
      'switch play rapidly from flank to flank to unbalance their pressing structure',
      'target set-pieces with tall players against their high defensive line',
      'stay disciplined yourself — outwait them in a game of tactical patience',
    ],
    recommendation: [
      'set pressing traps near the touchlines to force turnovers in wide areas',
      'stay patient out of possession; the right pressing trigger will come',
      'after winning the ball, attack quickly before the opponent can reset their defensive shape',
    ],
  },
  'Quick Counter': {
    identity: [
      'explosive vertical transitions designed to strike before the defence can organise',
      'absorbs pressure in a compact block, then springs forward at devastating speed',
      'minimal-touch attacks that prioritise verticality over possession',
    ],
    attacking: [
      'forwards stay high and wide to provide immediate outlets on the break',
      'central striker drifts into channels to receive and cut inside at pace',
      'shoots on sight during transitions, accepting lower-percentage chances for high volume',
    ],
    defending: [
      'compact mid-block that invites opponents forward before breaking quickly',
      'full-backs stay deep, forming a back three to provide defensive security',
      'goalkeeper acts as an additional distributor, launching counter-attacks from saves',
    ],
    vulnerability: [
      'opponents who also sit deep, denying the transitional space needed to attack',
      'high pressing against their defensive third that forces rushed clearances',
      'possession-dominant teams who starve them of counter-attacking opportunities',
      'teams that score first and force them to abandon their counter-attacking shape',
      'wide overloads in transition that isolate their compact defensive structure',
      'deep crosses and cut-backs against a backline that defends narrowly',
    ],
    counter: [
      'concede possession willingly — deny them the space they need to transition',
      'press their centre-backs aggressively to force errors in their defensive third',
      'control the tempo and limit turnovers in midfield to prevent their launch points',
      'score the first goal — they cannot chase a game from their counter-attacking setup',
      'overload wide areas when attacking to stretch their narrow defensive block',
      'deliver deep crosses and cut-backs to exploit the gaps behind their compact line',
    ],
    recommendation: [
      'stay compact and patient — the counter-attacking opportunity will present itself',
      'wide players must stay high to stretch the opponent and create transition lanes',
      'be clinical in front of goal; counter-attacks produce fewer chances but higher quality ones',
    ],
  },
  'Long Ball Counter': {
    identity: [
      'deep defensive organisation paired with direct vertical attacks bypassing midfield',
      'wins the ball deep, clears lines quickly, and trusts physicality to win second balls',
      'makes no apologies for directness — territory over possession at all times',
    ],
    attacking: [
      'direct passes from goal kicks and defensive interceptions targeting the forward line',
      'target forward battles for first-contact headers with runners collecting second balls',
      'rare but dangerous corners and set-pieces created from clearances turned into attacks',
    ],
    defending: [
      'deep compact block, often with a back five, prioritising defensive shape above all',
      'centre-backs stay narrow to protect the central channel at all costs',
      'goalkeeper organises the defensive line constantly and commands the penalty area',
    ],
    vulnerability: [
      'possession teams that exhaust defenders by making them chase the ball',
      'high pressing against the goalkeeper and centre-backs that forces distribution errors',
      'falling behind — the system cannot chase games effectively',
      'teams that score early set-piece goals, forcing the deep block to push up',
      'wide overloads that stretch the compact shape and create crossing angles',
      'patient passing teams who probe the block for 90 minutes without rushing',
    ],
    counter: [
      'man-mark the target forward to deny the first-contact header',
      'press the goalkeeper aggressively to force rushed clearances',
      'score first — this system crumbles when forced to abandon its shape',
      'target set-pieces early to force their deep block into uncomfortable territory',
      'overload wide areas and deliver early crosses before the block can reset',
      'be patient with possession — probe their shape methodically and the cracks will appear',
    ],
    recommendation: [
      'stay compact and disciplined; your defensive shape is your greatest weapon',
      'win the second ball after every clearance — that is where counter-attacks are born',
      'use set-pieces as your primary attacking platform; make every dead ball count',
    ],
  },
  'The Grinders': {
    identity: [
      'physical, combative football designed to make every game a battle',
      'wins through duels, set-pieces, and sheer work rate rather than technical quality',
      'makes opponents uncomfortable by turning every contest into a physical war',
    ],
    attacking: [
      'direct football that avoids elaborate build-up in favour of territory and pressure',
      'dangerous from set-piece situations with multiple aerial threats attacking the ball',
      'wins fouls in advanced areas through purposeful carries and physical duels',
    ],
    defending: [
      'physical in every duel — tackles hard, competes for every ball, and never backs down',
      'commits tactical fouls to break up opponent rhythm and prevent dangerous transitions',
      'maintains physical intensity for the full 90 minutes to wear opponents down',
    ],
    vulnerability: [
      'technical teams that move the ball quickly in one or two touches',
      'conceding too many fouls in dangerous areas that gift set-piece opportunities',
      'opponents who match their physicality and are equally comfortable in the battle',
      'red cards and suspensions from an overly aggressive approach',
      'quick ball circulation that tires their physically demanding style',
      'opponents who target their full-backs with pace, forcing yellow-card tackles',
    ],
    counter: [
      'move the ball rapidly with one-touch passing to bypass their physical press',
      'draw fouls in advanced areas — they give away set-pieces under pressure',
      'stay composed and let them exhaust themselves; technical quality wins late',
      'target their most aggressive players to draw second yellow cards',
      'circulate the ball quickly to make them chase and drain their stamina',
      'isolate their full-backs with pacy wingers to force desperate challenges',
    ],
    recommendation: [
      'win the physical battle early to establish dominance and set the tone',
      'target set-pieces as your primary scoring avenue — rehearse every routine',
      'keep the intensity high for the full 90; your fitness is your advantage',
    ],
  },
  'Out Wide': {
    identity: [
      'expansive attacking through relentless width and crossing volume',
      'stretches the pitch to its limits, forcing opponents to spread their defensive shape',
      'full width as the primary attacking channel — overlaps, underlaps, and early crosses',
    ],
    attacking: [
      'full-backs push high to deliver crosses early from both flanks',
      'wingers stay wide to create crossing angles and isolate full-backs',
      'midfield runners arrive late in the box to attack deliveries from deep',
    ],
    defending: [
      'relies on wide pressure to force turnovers in advanced wide areas',
      'full-backs must track back quickly to prevent counter-attacks through vacated space',
      'defends the flanks aggressively to prevent opposition crosses',
    ],
    vulnerability: [
      'central counter-attacks that exploit the space behind advancing full-backs',
      'compact narrow defences with dominant aerial centre-backs',
      'becoming predictable — if crosses are consistently cleared, there is no plan B',
      'quick transitions down the flanks that catch the full-backs out of position',
      'opponents who press the full-backs aggressively, denying the crossing supply',
      'narrow attacking shapes that overload the central area while their width is neutralised',
    ],
    counter: [
      'counter-attack quickly through central channels before full-backs can recover',
      'defend the box aerially with strong, tall centre-backs',
      'force them narrow and deny crossing angles — they will run out of ideas',
      'transition at pace down the flanks to exploit the space their full-backs leave',
      'press their full-backs high to cut off the supply at the source',
      'attack narrowly with quick combination play through the middle to bypass their width',
    ],
    recommendation: [
      'vary your delivery — mix low driven crosses with high floated balls to keep defenders guessing',
      'overload one flank before switching play quickly to the opposite side',
      'midfielders must time late runs into the box to attack second-phase deliveries',
    ],
  },
  'Set-Piece Specialists': {
    identity: [
      'dead-ball situations as the primary goal-scoring weapon',
      'every corner, free kick, and throw-in treated as a rehearsed attacking platform',
      'actively wins fouls in dangerous areas to manufacture scoring opportunities',
    ],
    attacking: [
      'multiple rehearsed corner routines including near-post flick-ons and far-post overloads',
      'free kicks taken as direct shots or headed deliveries with specific movement patterns',
      'attacking throw-ins in the final third treated as structured set-piece situations',
    ],
    defending: [
      'organised defensive set-piece structure to prevent opponent dead-ball goals',
      'wins fouls proactively rather than reactively — controls when and where the whistle blows',
    ],
    vulnerability: [
      'disciplined opponents who avoid conceding fouls in dangerous areas',
      'quick transitions after failed set-piece routines catching attacking players out of position',
      'poor delivery days that eliminate the primary scoring avenue entirely',
      'opponents who study their routines and position defenders to counter specific patterns',
      'teams that dominate open play, reducing the total number of dead-ball situations',
      'tall, physically dominant defenders who neutralise the aerial threat',
    ],
    counter: [
      'defend disciplinedly — avoid unnecessary fouls in your defensive third',
      'counter-attack rapidly from cleared set-pieces while their attackers are forward',
      'study their set-piece routines and position defenders to counter specific patterns',
      'dominate possession to reduce the number of set-piece opportunities they get',
      'deploy your tallest defenders and use zonal marking to deal with aerial deliveries',
      'foul them in non-threatening areas only — force throw-ins instead of free kicks',
    ],
    recommendation: [
      'win fouls in the final third — every free kick is a scoring opportunity',
      'vary your set-piece routines to prevent opponents from reading your patterns',
      'commit numbers forward on dead balls but keep two players back to prevent counters',
    ],
  },
  'Shoot-on-Sight': {
    identity: [
      'volume shooting philosophy — if there is a sight of goal, take the shot',
      'statistical approach to scoring: more attempts equals more goals eventually',
      'fearless in front of goal, prioritising quantity of attempts over shot quality',
    ],
    attacking: [
      'shoots from distance, tight angles, and any opening — rarely passes up an opportunity',
      'generates large numbers of corners from blocked shots and goalkeeper saves',
      'forwards make constant aggressive runs behind the defensive line, accepting offsides',
    ],
    defending: [
      'hunts for second balls and rebounds after initial shots in the penalty area',
      'defends from the front — aggressive closing down to win the ball high',
    ],
    vulnerability: [
      'organised defences that block shooting lanes and force attempts from non-threatening angles',
      'goalkeepers with strong handling who collect rather than parry shots',
      'frustration leading to increasingly speculative efforts as the game progresses',
      'teams that press the shooter aggressively, denying time to set up for a clean strike',
      'opponents who close down space in midfield, preventing the team from reaching shooting range',
      'compact defensive blocks that force shots from 25+ yards with low conversion probability',
    ],
    counter: [
      'show them wide and deny central shooting lanes — force shots from distance',
      'use a goalkeeper who collects cleanly to deny second-ball opportunities',
      'block aggressively and maintain defensive discipline — their inefficiency will compound',
      'press the ball carrier quickly to prevent them from settling into shooting positions',
      'defend high up the pitch to keep their shooters outside of effective range',
      'stay compact centrally and force them to shoot from wide angles with low expected value',
    ],
    recommendation: [
      'do not hesitate — if you see the goal, shoot; rebounds create high-percentage chances',
      'target the goalkeeper early to test their handling and create uncertainty',
      'follow every shot into the box; the second ball is often more dangerous than the first',
    ],
  },
  'Pragmatic Stabilizers': {
    identity: [
      'balanced, adaptable football without extreme tactical commitment',
      'tactically flexible — shifts between styles based on the opponent and match situation',
      'prioritises stability and game management over committing to a single philosophy',
    ],
    attacking: [
      'adapts attacking approach based on opponent weaknesses identified before the match',
      'capitalises on transition moments rather than sustained territorial pressure',
      'creates chances through variety rather than a single predictable avenue',
    ],
    defending: [
      'maintains compact defensive shape when not in possession as a baseline',
      'adapts pressing intensity and defensive line based on the opponent\'s strengths',
    ],
    vulnerability: [
      'specialist teams who find edges that an adaptable-but-master-of-none approach cannot match',
      'inability to impose a clear game plan in critical moments',
      'quick transitions catching them between shapes when adapting mid-game',
      'opponents with a clear, well-drilled identity who force constant adaptation',
      'conceding early goals before settling into the optimal tactical approach',
      'attacking overloads that exploit the gaps left when shifting between defensive shapes',
    ],
    counter: [
      'maintain a clear tactical identity — force them to adapt and catch them between systems',
      'attack quickly in transition before they can settle into their defensive shape',
      'exploit moments of tactical uncertainty when they are adjusting to your approach',
      'score early — force them into chase mode where their adaptability becomes paralysis',
      'overload one flank rapidly before they can shift their defensive structure across',
      'stick to one game plan relentlessly — constant adaptation is exhausting and error-prone',
    ],
    recommendation: [
      'study the opponent thoroughly — your adaptability depends on good preparation',
      'do not overcomplicate; pick a clear plan and execute it with discipline',
      'be ready to shift approach if the game state changes; your flexibility is your edge',
    ],
  },
}

// ──────────────────────────────────────────────────────────────────────────────
// Level ↔ score
// ──────────────────────────────────────────────────────────────────────────────
const LEVEL_SCORE: Record<string, number> = { '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20, '--': 0.12, '---': 0.06, '----': 0.02 }
const LEVEL_ORDER: Record<string, number> = { '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6, '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1 }

function computeConfidence(tl: string, ol: string): string {
  const d = (LEVEL_ORDER[tl] ?? 5) - (LEVEL_ORDER[ol] ?? 5)
  if (d >= 4) return '+++++'; if (d >= 3) return '++++'; if (d >= 2) return '+++'
  if (d >= 1) return '++'; if (d >= 0) return '+'; if (d >= -1) return '-'
  if (d >= -2) return '--'; if (d >= -3) return '---'; if (d >= -4) return '----'
  return '-----'
}

// ──────────────────────────────────────────────────────────────────────────────
// Team manual profile mapping (same as before)
// ──────────────────────────────────────────────────────────────────────────────
type ProfileName = keyof typeof PROFILE_FRAGMENTS

const TEAM_PROFILE_MAP: Record<string, ProfileName> = {
  'Manchester City': 'Elite Dominators', 'Real Madrid': 'Elite Dominators',
  'Paris Saint Germain': 'Elite Dominators', 'Bayern Munchen': 'Elite Dominators',
  'Al Hilal': 'Elite Dominators', 'Inter': 'Elite Dominators', 'Palmeiras': 'Elite Dominators',
  'Barcelona': 'Tiki-Taka',
  'Liverpool': 'Gegenpressing', 'Newcastle United': 'Gegenpressing',
  'Arsenal': 'Disciplined Pressers', 'Brighton': 'Disciplined Pressers',
  'Bayer Leverkusen': 'Disciplined Pressers', 'Milan': 'Disciplined Pressers',
  'Club Brugge': 'Disciplined Pressers', 'Chelsea': 'Disciplined Pressers',
  'Manchester United': 'Quick Counter', 'Sporting Cp': 'Quick Counter', 'Bournemouth': 'Quick Counter',
  'Burnley': 'Long Ball Counter',
  'Real Betis': 'Out Wide',
  'Nantes': 'Pragmatic Stabilizers', 'Como 1907': 'Pragmatic Stabilizers',
  'Santos': 'Pragmatic Stabilizers', 'Al Ettifaq': 'Pragmatic Stabilizers',
  'Al Khaleej': 'Pragmatic Stabilizers',
}

// ──────────────────────────────────────────────────────────────────────────────
// Generation helpers
// ──────────────────────────────────────────────────────────────────────────────
function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length] }
function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const result: T[] = []
  const available = [...arr]
  let s = seed
  for (let i = 0; i < n && available.length > 0; i++) {
    s = (s * 16807 + 13) % 2147483647
    const idx = s % available.length
    result.push(available.splice(idx, 1)[0])
  }
  return result
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-team playstyle generation
// ──────────────────────────────────────────────────────────────────────────────
interface TeamContext {
  id: string; name: string; profile: ProfileName; level: string
  managerName: string; gamesPlayed: number; wins: number; draws: number; losses: number
  winRate: number; isNewManager: boolean
  possession: number; shots: number; fouls: number; tackles: number
  priorTeamNames: string[]
}

function generateAbout(ctx: TeamContext): string {
  const f = PROFILE_FRAGMENTS[ctx.profile]
  const seed = hashStr(ctx.name + 'about')

  if (ctx.isNewManager && ctx.gamesPlayed === 0) {
    // New team, no data — keep it focused on profile identity
    return `${ctx.name} ${pick(f.identity, seed)}. As a new entry to the league under manager ${ctx.managerName}, their tactical identity is still forming — but early indications point to a ${ctx.profile.toLowerCase()} framework that will define their approach this season.`
  }

  if (ctx.gamesPlayed < 5) {
    // Limited data
    return `${ctx.name} ${pick(f.identity, seed + 1)}. Manager ${ctx.managerName} has limited prior match data (${ctx.gamesPlayed} games across ${ctx.priorTeamNames.join(', ')}), but the tactical blueprint for this season is clear: a ${ctx.profile.toLowerCase()} system that ${pick(f.identity, seed + 2).toLowerCase()}.`
  }

  // Rich data: build a detailed description
  const possDesc = ctx.possession >= 52 ? 'dominates possession' : ctx.possession >= 47 ? 'controls the ball effectively' : 'is comfortable without the ball'
  const shotDesc = ctx.shots >= 7 ? 'generates high shot volume' : ctx.shots >= 4 ? 'takes measured shots' : 'is selective in front of goal'
  const foulDesc = ctx.fouls <= 1.5 ? 'remarkably disciplined, rarely conceding fouls' : ctx.fouls <= 2.5 ? 'maintains reasonable defensive discipline' : 'plays a physical, confrontational style'
  const tackleDesc = ctx.tackles >= 8 ? 'an exceptionally active defensive unit that wins the ball frequently' : ctx.tackles >= 6 ? 'a solid defensive presence in midfield' : 'prefers positional defending over tackling'

  const recordPhrase = ctx.winRate >= 0.60 ? `an impressive ${ctx.wins}W-${ctx.draws}D-${ctx.losses}L record (${(ctx.winRate * 100).toFixed(0)}% win rate)` :
    ctx.winRate >= 0.40 ? `a competitive ${ctx.wins}W-${ctx.draws}D-${ctx.losses}L record` :
    `a developing ${ctx.wins}W-${ctx.draws}D-${ctx.losses}L record`

  return `${ctx.name} ${pick(f.identity, seed)}. Under ${ctx.managerName}'s leadership — who brings ${recordPhrase} from ${ctx.gamesPlayed} prior matches managing ${ctx.priorTeamNames.slice(0, 3).join(', ')} — the team ${possDesc}, ${shotDesc}, and ${foulDesc}. Their ${tackleDesc}, embodying the core principles of the ${ctx.profile.toLowerCase()} philosophy.`
}

function generateTendencies(ctx: TeamContext): string[] {
  const f = PROFILE_FRAGMENTS[ctx.profile]
  const seed = hashStr(ctx.name + 'tendencies')
  const base = pickN(f.attacking.concat(f.defending), 5, seed)

  // Inject data-driven details into 2 of them
  const result = base.slice(0, 3)
  return result
}

function generateWeaknesses(ctx: TeamContext): string[] {
  const f = PROFILE_FRAGMENTS[ctx.profile]
  const seed = hashStr(ctx.name + 'weaknesses')
  const vulns = pickN(f.vulnerability, 3, seed)
  const counters = pickN(f.counter, 3, seed + 1)

  return vulns.map((v, i) => {
    const c = counters[i] || counters[0]
    return `${ctx.name} tends to ${v.toLowerCase()}, so expect opponents to ${c.toLowerCase()}, which will exploit this structural vulnerability in their ${ctx.profile.toLowerCase()} system.`
  })
}

function generateCoachNote(ctx: TeamContext): string {
  const f = PROFILE_FRAGMENTS[ctx.profile]
  const seed = hashStr(ctx.name + 'coach')

  const style = pick(f.identity, seed)
  const rec = pick(f.recommendation, seed + 1)

  let mgrContext = ''
  if (ctx.gamesPlayed >= 5) {
    mgrContext = ` Manager ${ctx.managerName}'s prior experience with ${ctx.priorTeamNames.slice(0, 2).join(' and ')} (${ctx.gamesPlayed} matches) has shaped this tactical identity.`
  } else if (ctx.gamesPlayed >= 1) {
    mgrContext = ` With only ${ctx.gamesPlayed} prior matches of data, ${ctx.managerName}'s tactical tendencies are still emerging.`
  } else {
    mgrContext = ` As a new manager in the league, ${ctx.managerName} will look to establish this identity from the opening fixture.`
  }

  return `${ctx.name} employ a ${ctx.profile.toLowerCase()} approach: ${style}.${mgrContext} ${rec}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-fixture coach note generation
// ──────────────────────────────────────────────────────────────────────────────
interface FixtureContext {
  fixtureId: string; matchday: number; scheduledDate: string
  homeTeam: { id: string; name: string; profile: ProfileName; level: string }
  awayTeam: { id: string; name: string; profile: ProfileName; level: string }
}

function generateFixtureExploits(fx: FixtureContext, forTeam: 'home' | 'away'): string[] {
  const team = forTeam === 'home' ? fx.homeTeam : fx.awayTeam
  const opponent = forTeam === 'home' ? fx.awayTeam : fx.homeTeam
  const tf = PROFILE_FRAGMENTS[team.profile]
  const of = PROFILE_FRAGMENTS[opponent.profile]
  const seed = hashStr(fx.fixtureId + team.name + 'exploit')

  // What will the OPPONENT exploit about THIS team?
  const vulns = pickN(tf.vulnerability, 3, seed)
  const oppStrengths = pickN(of.attacking.concat(of.defending), 3, seed + 1)

  return vulns.map((v, i) => {
    const s = oppStrengths[i] || oppStrengths[0]
    return `${opponent.name} will look to exploit ${team.name}'s tendency to ${v.toLowerCase()}. Given ${opponent.name}'s ${opponent.profile.toLowerCase()} approach — which ${s} — expect them to target this weakness persistently throughout the match.`
  })
}

function generateFixtureRecommendations(fx: FixtureContext, forTeam: 'home' | 'away'): string[] {
  const team = forTeam === 'home' ? fx.homeTeam : fx.awayTeam
  const opponent = forTeam === 'home' ? fx.awayTeam : fx.homeTeam
  const of = PROFILE_FRAGMENTS[opponent.profile]
  const seed = hashStr(fx.fixtureId + team.name + 'rec')

  const oppVulns = pickN(of.vulnerability, 3, seed)
  const teamAdvice = pickN(PROFILE_FRAGMENTS[team.profile].recommendation, 2, seed + 1)

  const result = oppVulns.map(v => {
    return `${team.name} should target ${opponent.name}'s known tendency to ${v.toLowerCase()}. This is a structural weakness in their ${opponent.profile.toLowerCase()} system that ${team.name}'s ${team.profile.toLowerCase()} approach is well-positioned to exploit.`
  })

  // Add one general tactical recommendation
  result.push(teamAdvice[0])

  return result.slice(0, 3)
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('🔍 DRY RUN\n')

  // ── Fetch all data ─────────────────────────────────────────────────────────
  console.log('Fetching Season 3 data...')

  const { data: fixtures } = await supabase.from('fixtures')
    .select('home_team_id, away_team_id').eq('tournament_id', LEAGUE_ID)
  const teamIds = [...new Set((fixtures ?? []).flatMap(f => [f.home_team_id, f.away_team_id]).filter(id => id && id !== 'null'))]

  const { data: teams } = await supabase.from('teams').select('id,name,manager_id').in('id', teamIds).order('name')
  const { data: profiles } = await supabase.from('profiles').select('id,username').in('id', [...new Set((teams ?? []).map(t => t.manager_id).filter(Boolean))])
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.username]))

  const managerIds = [...new Set((teams ?? []).map(t => t.manager_id).filter(Boolean))]
  const { data: tenures } = await supabase.from('manager_tenures').select('*').in('manager_id', managerIds)
  const { data: allTeams } = await supabase.from('teams').select('id,name')
  const allTeamNameMap = new Map((allTeams ?? []).map(t => [t.id, t.name]))

  // Build manager context
  const mgrRecords = new Map<string, { w: number; d: number; l: number; games: number; priorTeams: string[] }>()
  const mgrStats = new Map<string, { possession: number; shots: number; fouls: number; tackles: number }>()

  for (const t of (tenures ?? [])) {
    if (!mgrRecords.has(t.manager_id)) mgrRecords.set(t.manager_id, { w: 0, d: 0, l: 0, games: 0, priorTeams: [] })
    const r = mgrRecords.get(t.manager_id)!
    r.w += t.wins ?? 0; r.d += t.draws ?? 0; r.l += t.losses ?? 0
    r.games += (t.wins ?? 0) + (t.draws ?? 0) + (t.losses ?? 0)
    const tn = allTeamNameMap.get(t.team_id)
    if (tn && !r.priorTeams.includes(tn)) r.priorTeams.push(tn)
  }

  // Build team contexts
  const teamContexts: TeamContext[] = []
  for (const team of (teams ?? [])) {
    const mgrId = team.manager_id
    const rec = mgrId ? (mgrRecords.get(mgrId) ?? { w: 0, d: 0, l: 0, games: 0, priorTeams: [] }) : { w: 0, d: 0, l: 0, games: 0, priorTeams: [] }
    const winRate = rec.games > 0 ? (rec.w * 3 + rec.d) / (rec.games * 3) : 0

    let level: string
    if (rec.games >= 5) {
      if (winRate >= 0.70) level = '++++'
      else if (winRate >= 0.55) level = '+++'
      else if (winRate >= 0.40) level = '++'
      else if (winRate >= 0.25) level = '+'
      else level = '-'
    } else if (rec.games >= 1) { level = '+'; }
    else { level = '+++'; }

    const profile = Object.entries(TEAM_PROFILE_MAP).find(([k]) =>
      team.name.replace(/[’']/g, "'").trim().includes(k)
    )?.[1] as ProfileName ?? 'Pragmatic Stabilizers'

    teamContexts.push({
      id: team.id, name: team.name, profile, level,
      managerName: mgrId ? (profileMap.get(mgrId) ?? 'Unknown') : 'Unassigned',
      gamesPlayed: rec.games, wins: rec.w, draws: rec.d, losses: rec.l,
      winRate, isNewManager: rec.games === 0,
      possession: 50, shots: 5, fouls: 1.8, tackles: 6.5, // defaults; could pull from real stats
      priorTeamNames: rec.priorTeams,
    })
  }

  // ── Generate playstyles ────────────────────────────────────────────────────
  console.log('\nGenerating unique playstyle descriptions...')
  console.log('─'.repeat(80))

  let upserted = 0
  for (const ctx of teamContexts) {
    const about = generateAbout(ctx)
    const tendencies = generateTendencies(ctx)
    const weaknesses = generateWeaknesses(ctx)
    const coachNote = generateCoachNote(ctx)
    const score = LEVEL_SCORE[ctx.level] ?? 0.52

    console.log(`\n  ${ctx.name} [${ctx.managerName}] → ${ctx.profile} (${ctx.level})`)
    console.log(`    About: ${about.substring(0, 120)}...`)
    console.log(`    Weakness 1: ${weaknesses[0]?.substring(0, 100)}...`)
    console.log(`    Coach note: ${coachNote.substring(0, 120)}...`)

    if (!dryRun) {
      const { error } = await supabase.from('team_dna').upsert({
        team_id: ctx.id, primary_profile: ctx.profile, primary_level: ctx.level,
        primary_score: score, primary_about: about, primary_tendencies: tendencies,
        primary_weaknesses: weaknesses, primary_coach_note: coachNote,
      }, { onConflict: 'team_id' })
      if (error) console.error(`    ✗ ${error.message}`)
      else upserted++
    } else { upserted++ }
  }

  console.log(`\n  ${upserted} playstyle descriptions updated`)

  // ── Generate coach notes for Week 1 (July 7-12) ────────────────────────────
  console.log('\nGenerating unique coach notes for Week 1 (July 7-12)...')
  console.log('─'.repeat(80))

  const { data: week1 } = await supabase.from('fixtures')
    .select('id, home_team_id, away_team_id, matchday, scheduled_date')
    .eq('tournament_id', LEAGUE_ID)
    .gte('scheduled_date', '2026-07-07')
    .lte('scheduled_date', '2026-07-12')
    .order('scheduled_date').order('matchday')

  const ctxMap = new Map(teamContexts.map(t => [t.id, t]))
  let notesCount = 0

  for (const fx of (week1 ?? [])) {
    const hCtx = ctxMap.get(fx.home_team_id)
    const aCtx = ctxMap.get(fx.away_team_id)
    if (!hCtx || !aCtx) continue

    const fixCtx: FixtureContext = {
      fixtureId: fx.id, matchday: fx.matchday, scheduledDate: fx.scheduled_date,
      homeTeam: { id: hCtx.id, name: hCtx.name, profile: hCtx.profile, level: hCtx.level },
      awayTeam: { id: aCtx.id, name: aCtx.name, profile: aCtx.profile, level: aCtx.level },
    }

    const hConf = computeConfidence(hCtx.level, aCtx.level)
    const hExploits = generateFixtureExploits(fixCtx, 'home')
    const hRecs = generateFixtureRecommendations(fixCtx, 'home')

    const aConf = computeConfidence(aCtx.level, hCtx.level)
    const aExploits = generateFixtureExploits(fixCtx, 'away')
    const aRecs = generateFixtureRecommendations(fixCtx, 'away')

    console.log(`  MD${fx.matchday} ${fx.scheduled_date}: ${hCtx.name} vs ${aCtx.name}`)
    console.log(`    Home confidence: ${hConf} | Away confidence: ${aConf}`)
    console.log(`    ${hCtx.name} exploit: ${hExploits[0]?.substring(0, 100)}...`)
    console.log(`    ${hCtx.name} rec: ${hRecs[0]?.substring(0, 100)}...`)

    if (!dryRun) {
      await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: hCtx.id, opponent_id: aCtx.id,
        confidence: hConf, opponent_will_exploit: hExploits, recommendations: hRecs,
      }, { onConflict: 'fixture_id, team_id' })
      await supabase.from('fixture_coach_notes').upsert({
        fixture_id: fx.id, team_id: aCtx.id, opponent_id: hCtx.id,
        confidence: aConf, opponent_will_exploit: aExploits, recommendations: aRecs,
      }, { onConflict: 'fixture_id, team_id' })
      notesCount += 2
    } else { notesCount += 2 }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80))
  const byProfile: Record<string, number> = {}
  for (const c of teamContexts) byProfile[c.profile] = (byProfile[c.profile] ?? 0) + 1
  console.log('Profile distribution:')
  for (const [p, c] of Object.entries(byProfile).sort((a, b) => b[1] - a[1])) console.log(`  ${p}: ${c}`)

  if (dryRun) console.log(`\n⚠ DRY RUN — ${upserted} playstyles, ${notesCount} coach notes would be written`)
  else console.log(`\n✅ Done. ${upserted} nuanced playstyles updated, ${notesCount} unique coach notes generated.`)
}

main().catch(console.error)
