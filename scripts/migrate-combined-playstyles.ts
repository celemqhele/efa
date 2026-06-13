/**
 * One-time migration script: reads all team_dna rows, generates a single
 * combined playstyle description per team (merged from existing primary +
 * secondary + tertiary profiles), and upserts into primary_* columns.
 *
 * Run: npx tsx scripts/migrate-combined-playstyles.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ── Combination name map ─────────────────────────────────────────────────────
const COMBINATION_NAMES: Record<string, string> = {
  'Disciplined Pressers|Elite Dominators': 'Tactical Perfection',
  'Disciplined Pressers|Gegenpressing': 'Complete Press',
  'Disciplined Pressers|Long Ball Counter': 'Structured Pragmatism',
  'Disciplined Pressers|Out Wide': 'Wide Intelligence',
  'Disciplined Pressers|Quick Counter': 'Calculated Counter',
  'Disciplined Pressers|Set-Piece Specialists': 'Dead Ball Tacticians',
  'Disciplined Pressers|Shoot-on-Sight': 'Press & Strike',
  'Disciplined Pressers|The Grinders': 'Iron Midfield',
  'Disciplined Pressers|Tiki-Taka': 'Positional Play',
  'Elite Dominators|Gegenpressing': 'Suffocating Elite',
  'Elite Dominators|Long Ball Counter': 'Calculated Directness',
  'Elite Dominators|Out Wide': 'Expansive Elite',
  'Elite Dominators|Quick Counter': 'Dual Threat',
  'Elite Dominators|Set-Piece Specialists': 'Every Angle',
  'Elite Dominators|Shoot-on-Sight': 'Relentless',
  'Elite Dominators|The Grinders': 'Ruthless Machine',
  'Elite Dominators|Tiki-Taka': 'Orchestral Control',
  'Gegenpressing|Long Ball Counter': 'Chaotic Directness',
  'Gegenpressing|Out Wide': 'Wing Press',
  'Gegenpressing|Quick Counter': 'Vertical Press',
  'Gegenpressing|Set-Piece Specialists': 'Press & Pounce',
  'Gegenpressing|Shoot-on-Sight': 'Trigger-Happy Presser',
  'Gegenpressing|The Grinders': 'Heavy Metal',
  'Gegenpressing|Tiki-Taka': 'Total Football',
  'Long Ball Counter|Out Wide': 'Long Ball Wide',
  'Long Ball Counter|Quick Counter': 'Direct Transition',
  'Long Ball Counter|Set-Piece Specialists': 'Old School Direct',
  'Long Ball Counter|Shoot-on-Sight': 'Route One Chaos',
  'Long Ball Counter|The Grinders': 'Park the Bus',
  'Long Ball Counter|Tiki-Taka': 'False Patience',
  'Out Wide|Quick Counter': 'Flying Wingers',
  'Out Wide|Set-Piece Specialists': 'Cross & Corner',
  'Out Wide|Shoot-on-Sight': 'Wide & Ruthless',
  'Out Wide|The Grinders': 'Physical Width',
  'Out Wide|Tiki-Taka': 'Expansive Possession',
  'Quick Counter|Set-Piece Specialists': 'Counter & Dead Ball',
  'Quick Counter|Shoot-on-Sight': 'Shock & Awe',
  'Quick Counter|The Grinders': 'Combative Counter',
  'Quick Counter|Tiki-Taka': 'Fluid Attack',
  'Set-Piece Specialists|Shoot-on-Sight': 'Dead Ball Shooters',
  'Set-Piece Specialists|The Grinders': 'Set-Piece Machine',
  'Set-Piece Specialists|Tiki-Taka': 'Complete Technicians',
  'Shoot-on-Sight|The Grinders': 'Brute Force',
  'Shoot-on-Sight|Tiki-Taka': 'Rondo & Fire',
  'The Grinders|Tiki-Taka': 'Beautiful Brutality',
}

const THREE_WAY_NAMES: Record<string, string> = {
  'Disciplined Pressers|Elite Dominators|Gegenpressing': 'Total Press',
  'Disciplined Pressers|Elite Dominators|Long Ball Counter': 'Controlled Directness',
  'Disciplined Pressers|Elite Dominators|Out Wide': 'Structured Width',
  'Disciplined Pressers|Elite Dominators|Quick Counter': 'Smart Predators',
  'Disciplined Pressers|Elite Dominators|The Grinders': 'Calculated Warriors',
  'Disciplined Pressers|Elite Dominators|Tiki-Taka': 'Surgical Dominance',
  'Disciplined Pressers|Gegenpressing|Long Ball Counter': 'Press & Go Long',
  'Disciplined Pressers|Gegenpressing|Out Wide': 'Pressing Width',
  'Disciplined Pressers|Gegenpressing|Quick Counter': 'High Press Machine',
  'Disciplined Pressers|Gegenpressing|The Grinders': 'Total Intensity',
  'Disciplined Pressers|Gegenpressing|Tiki-Taka': 'Total Control',
  'Disciplined Pressers|Long Ball Counter|Out Wide': 'Wide Pragmatism',
  'Disciplined Pressers|Long Ball Counter|Quick Counter': 'Triple Counter',
  'Disciplined Pressers|Long Ball Counter|The Grinders': 'Physical Pragmatism',
  'Disciplined Pressers|Long Ball Counter|Tiki-Taka': 'Intelligent Directness',
  'Disciplined Pressers|Out Wide|Quick Counter': 'Wide Calculated Counter',
  'Disciplined Pressers|Out Wide|The Grinders': 'Wide Iron Midfield',
  'Disciplined Pressers|Out Wide|Tiki-Taka': 'Wide Positional Play',
  'Disciplined Pressers|Quick Counter|The Grinders': 'Physical Calculated Counter',
  'Disciplined Pressers|Quick Counter|Tiki-Taka': 'The Complete System',
  'Disciplined Pressers|The Grinders|Tiki-Taka': 'Tactical Muscle',
  'Elite Dominators|Gegenpressing|Long Ball Counter': 'Pragmatic Elite',
  'Elite Dominators|Gegenpressing|Out Wide': 'Elite Pressing Width',
  'Elite Dominators|Gegenpressing|Quick Counter': 'High Press Predators',
  'Elite Dominators|Gegenpressing|The Grinders': 'Iron Fist',
  'Elite Dominators|Gegenpressing|Tiki-Taka': 'The Pep System',
  'Elite Dominators|Long Ball Counter|Out Wide': 'Direct Wide Elite',
  'Elite Dominators|Long Ball Counter|Quick Counter': 'Transition Masters',
  'Elite Dominators|Long Ball Counter|The Grinders': 'Impenetrable',
  'Elite Dominators|Long Ball Counter|Tiki-Taka': 'Velvet Directness',
  'Elite Dominators|Out Wide|Quick Counter': 'Wide Elite Counter',
  'Elite Dominators|Out Wide|The Grinders': 'Wide Warriors',
  'Elite Dominators|Out Wide|Tiki-Taka': 'The Full Field',
  'Elite Dominators|Quick Counter|The Grinders': 'Physical Elite Counter',
  'Elite Dominators|Quick Counter|Tiki-Taka': 'False Security',
  'Elite Dominators|The Grinders|Tiki-Taka': 'Velvet Hammer',
  'Gegenpressing|Long Ball Counter|Out Wide': 'Chaotic Width',
  'Gegenpressing|Long Ball Counter|Quick Counter': 'Counter Chaos',
  'Gegenpressing|Long Ball Counter|The Grinders': 'Pure Chaos',
  'Gegenpressing|Long Ball Counter|Tiki-Taka': 'Desperate Measures',
  'Gegenpressing|Out Wide|Quick Counter': 'Wide Vertical Press',
  'Gegenpressing|Out Wide|The Grinders': 'Physical Wide Presser',
  'Gegenpressing|Out Wide|Tiki-Taka': 'Modern Masterclass',
  'Gegenpressing|Quick Counter|The Grinders': 'Physical Vertical Press',
  'Gegenpressing|Quick Counter|Tiki-Taka': 'Pressing Transition',
  'Gegenpressing|The Grinders|Tiki-Taka': 'Intense Total Football',
  'Long Ball Counter|Out Wide|Quick Counter': 'Wide Direct Transition',
  'Long Ball Counter|Out Wide|The Grinders': 'Wide Park the Bus',
  'Long Ball Counter|Out Wide|Tiki-Taka': 'Patient Width',
  'Long Ball Counter|Quick Counter|The Grinders': 'Physical Direct Transition',
  'Long Ball Counter|Quick Counter|Tiki-Taka': 'Multi-Dimensional Attack',
  'Long Ball Counter|The Grinders|Tiki-Taka': 'Deceptive Muscle',
  'Out Wide|Quick Counter|The Grinders': 'Wide Combative Counter',
  'Out Wide|Quick Counter|Tiki-Taka': 'Wide Fluid Attack',
  'Out Wide|The Grinders|Tiki-Taka': 'Expansive Brutality',
  'Quick Counter|The Grinders|Tiki-Taka': 'Physical Fluid Attack',
}

function getCombinationName(profiles: string[]): string | null {
  if (profiles.length === 0) return null
  if (profiles.length === 1) return profiles[0]
  const key = [...profiles].sort().join('|')
  return COMBINATION_NAMES[key] ?? THREE_WAY_NAMES[key] ?? null
}

// ── Template descriptions ────────────────────────────────────────────────────
const TEMPLATE_TENDENCIES: Record<string, string[]> = {
  'Elite Dominators': [
    "This team is a dominant controller, they will usually dictate tempo through sustained possession and patient build-up, and it is successful against teams that allow them to settle into their passing rhythm, evidence is their high passing volume and shot creation.",
    "This team is positionally superior, they will usually overwhelm opponents with total control of ball, space, and tempo, and it is effective against teams that press high and leave gaps, evidence is their ability to play through pressure.",
    "This team is defensively secure through possession, they will usually keep the ball rather than chase it, and it is successful against teams that rely on transition moments, evidence is their low goals-against despite limited defensive actions.",
  ],
  'Tiki-Taka': [
    "This team is a possession purist, they will usually build through short, precise passes and rarely play long or direct, and it is successful against teams that give them time on the ball in midfield, evidence is their exceptionally high pass count and accuracy.",
    "This team is centrally focused, they will usually attack through central combinations rather than crossing, and it is effective against teams that defend compactly but lack quick pressing triggers, evidence is their low cross count.",
    "This team is positionally disciplined, they will usually squeeze the midfield to create passing triangles, and it is successful against teams that don't press intelligently, evidence is their ability to maintain shape while in possession.",
  ],
  'Gegenpressing': [
    "This team is an intense counter-pressing unit, they will usually win the ball back within seconds of losing it high up the pitch, and it is successful against teams that lack composure under pressure, evidence is their high tackles and interceptions in advanced areas.",
    "This team is a physical presser, they will usually commit tactical fouls to disrupt counter-attacks when the press is bypassed, and it is effective against teams that try to break quickly, evidence is their elevated foul count.",
    "This team is high-energy, they will usually operate with a high defensive line and squeeze the opponent into their own half, and it is successful against teams that hold a back line deep, evidence is their high offside count.",
  ],
  'Disciplined Pressers': [
    "This team is an intelligent pressing unit, they will usually cut passing lanes through anticipation rather than sprinting, and it is successful against teams that play predictable passing patterns, evidence is their high interceptions and very low foul count.",
    "This team is structurally disciplined, they will usually force opponents into low-value passing options before tightening the trap, and it is effective against teams that rely on structured build-up, evidence is their compact shape while pressing.",
    "This team is positionally aware, they will rarely be caught out of position while pressing, and it is successful against teams that lack individual dribbling ability, evidence is their ability to press without committing fouls.",
  ],
  'Quick Counter': [
    "This team is a transition specialist, they will usually absorb pressure in a medium-to-low block and explode forward on turnover, and it is successful against teams that commit numbers forward, evidence is their low possession combined with high shot volume.",
    "This team is vertically direct, they will usually attack with minimal touches and avoid unnecessary sideways passing, and it is effective against teams with a high defensive line, evidence is their high offside count from constant runs in behind.",
    "This team thrives on chaos, they will usually use their goalkeeper as an attacking trigger to start counters, and it is successful against teams that don't recover quickly after losing the ball, evidence is their high shot count from transition situations.",
  ],
  'Long Ball Counter': [
    "This team defends deep, they will usually sit in a compact low block and go direct from defensive clearances, and it is successful against teams that struggle to break down a deep defence, evidence is their very low possession and pass count.",
    "This team bypasses midfield, they will usually target a forward with long balls and compete for second balls, and it is effective against teams with small aerial defenders, evidence is their low pass accuracy and high saves.",
    "This team is patient, they will usually keep the game tight and frustrate possession-based opponents, and it is successful against teams that become impatient and force passes, evidence is their high interception rate.",
  ],
  'The Grinders': [
    "This team is physically combative, they will usually engage in every duel and impose physicality on the opponent, and it is successful against technically superior teams that dislike physical contact, evidence is their high fouls and tackles.",
    "This team is direct and physical, they will usually play short passing sequences and avoid elaborate build-up, and it is effective against teams that try to play through midfield, evidence is their low pass count and accuracy.",
    "This team wins through attrition, they will usually wear opponents down over 90 minutes through relentless physical intensity, and it is successful against teams with less squad depth for rotation, evidence is their second-half performance consistency.",
  ],
  'Out Wide': [
    "This team is width-focused, they will usually attack down both flanks with fullbacks pushing high and delivering crosses, and it is successful against teams that defend narrowly, evidence is their high cross and corner count.",
    "This team stretches defences, they will usually use width to create space between centre-backs for midfield runners, and it is effective against teams with slow centre-backs, evidence is their balanced possession combining with wide threat.",
    "This team wins corners for fun, they will usually create corner opportunities through sustained wide pressure, and it is successful against teams weak at defending set-pieces, evidence is their high corner count.",
  ],
  'Set-Piece Specialists': [
    "This team treats dead balls as gold, they will usually win free kicks in dangerous areas through purposeful dribbling, and it is successful against teams that commit tactical fouls, evidence is their high free kick count.",
    "This team is dangerous from corners, they will usually have well-rehearsed routines for near-post flick-ons and far-post overloads, and it is effective against teams with poor zonal marking, evidence is their combination of high corners and free kicks.",
    "This team studies set-piece defence, they will usually target specific weak points in the opponent's dead-ball setup, and it is successful against teams that don't rehearse set-piece defence, evidence is their varied corner routines.",
  ],
  'Shoot-on-Sight': [
    "This team is volume shooters, they will usually shoot from anywhere and rarely pass up a shooting opportunity, and it is successful against goalkeepers with poor rebound control, evidence is their very high shot count.",
    "This team creates chaos through quantity, they will usually generate corners and second balls from blocked shots, and it is effective against defences that clear the ball rather than control it, evidence is their high corner count from deflections.",
    "This team is aggressive in attack, they will usually make runs behind the defence and accept offsides as part of the strategy, and it is successful against teams that play a high line, evidence is their constant testing of the defensive line.",
  ],
}

const TEMPLATE_WEAKNESSES: Record<string, string[]> = {
  'Elite Dominators': [
    "This team tends to dominate possession and push fullbacks high, so attempt to hit them on the counter through quick direct attacks into the space behind their advanced fullbacks, because their high line is vulnerable to fast transitions.",
    "This team tends to rely on patient build-up to break down opponents, so attempt to use a compact low block to frustrate their passing game and force sideways circulation without penetration, because they lack a direct alternative when Plan A stalls.",
    "This team tends to control games and can become complacent, so attempt to be clinical with the few chances you get, because they concede few opportunities but can be punished by efficient finishing.",
  ],
  'Tiki-Taka': [
    "This team tends to build from the back with short passes, so attempt to press them aggressively and force errors, because they lack a long-ball outlet and can be rattled by intense pressure.",
    "This team tends to play through central areas and avoid width, so attempt to use long diagonals and direct switches of play to bypass their midfield squeeze, because their structure is vulnerable to flank attacks that bypass the central press.",
    "This team tends to maintain a high physical output off the ball, so attempt to increase intensity in the second half, because their movement levels can drop, creating space for late runners.",
  ],
  'Gegenpressing': [
    "This team tends to press intensely and commit players forward, so attempt to use calm, composed build-up players who can bypass the press with quick one-touch passing, because their pressing structure is vulnerable to quick combinations.",
    "This team tends to tire in the final 20 minutes due to high energy demands, so attempt to conserve energy and exploit tired legs late in the game, because their pressing intensity drops significantly after 70 minutes.",
    "This team tends to leave space behind their advanced fullbacks, so attempt long diagonals to switch play and exploit the space, because their fullbacks push high and can be caught out of position.",
  ],
  'Disciplined Pressers': [
    "This team tends to press through reading passing patterns, so attempt to use unpredictable passing and individual dribbling, because their interception-based pressing is vulnerable to players who beat their man one-on-one.",
    "This team tends to maintain compact shape while pressing, so attempt to use quick one-two combinations that unlock the space between pressing lines, because their structure is rigid and can be beaten by quick give-and-go moves.",
    "This team tends to rely on positional discipline, so attempt to use long diagonals to force them to reset their shape repeatedly, because constantly reorganising creates temporary gaps.",
  ],
  'Quick Counter': [
    "This team tends to rely on transition opportunities created by opponents committing forward, so attempt to keep possession and build slowly, because it denies them the space they need behind your defence.",
    "This team tends to struggle against deep low blocks that leave no space in behind, so sit deep and compact, because their primary weapon (runs in behind) is neutralised when there's no space to attack.",
    "This team tends to isolate their forwards for hold-up play, so attempt to man-mark their target man and prevent them from bringing others into play, because isolated forwards can't sustain attacks.",
  ],
  'Long Ball Counter': [
    "This team tends to rely on their target man for attacking output, so attempt to tightly man-mark their primary aerial outlet, because neutralising first-contact headers kills their attacking threat.",
    "This team tends to build attacks through their goalkeeper's distribution, so attempt to press the goalkeeper to force rushed clearances, because under pressure they give away possession cheaply.",
    "This team tends to struggle when trailing, so attempt to score first and force them to chase the game, because they lack the technical ability to build patient attacks against a set defence.",
  ],
  'The Grinders': [
    "This team tends to rely on physical dominance and tactical fouling, so attempt to use quick one- or two-touch passing to bypass their pressing, because they can't foul what they can't catch.",
    "This team tends to commit many fouls, so attempt to draw fouls in dangerous areas and use set-pieces against them, because their aggressive style gives away dangerous free kicks.",
    "This team tends to struggle against clean technical teams, so attempt to play through their physical pressing with quick passing, because if you deny them physical dominance their tactical limitations are exposed.",
  ],
  'Out Wide': [
    "This team tends to attack primarily through wide areas, so attempt to defend with a compact narrow shape and strong aerial centre-backs, because cutting off their supply to the flanks neutralises their primary route to goal.",
    "This team tends to push fullbacks high, so attempt to use quick counter-attacks targeting the space left by their advanced fullbacks, because the space behind their wide players is exploitable.",
    "This team tends to lack alternative attacking patterns when wide play is shut down, so attempt to force them centrally, because they struggle when their crossing game is neutralised.",
  ],
  'Set-Piece Specialists': [
    "This team tends to rely on set-pieces for their best chances, so attempt to avoid giving away fouls in dangerous areas and prepare strong zonal marking for corners, because starving them of dead-ball opportunities reduces their attacking threat significantly.",
    "This team tends to study opponent set-piece setups, so attempt to vary your defensive organisation and keep them guessing, because predictable defensive setups can be exploited by their rehearsed routines.",
    "This team tends to struggle when their delivery is off, so attempt to apply pressure on their set-piece takers and force hurried deliveries, because inaccurate delivery reduces their dead-ball threat.",
  ],
  'Shoot-on-Sight': [
    "This team tends to shoot from anywhere, so attempt to block shooting lanes early and maintain defensive shape to force them into low-percentage shots, because organised shot-blocking reduces their primary output.",
    "This team tends to rely on rebounds and second balls, so attempt to use a goalkeeper with strong handling to reduce rebound opportunities, because preventing second-chance shots kills their secondary threat.",
    "This team tends to get frustrated when shots aren't falling, so attempt to block early shots and force them into even lower-percentage attempts, because their frustration leads to rushed, low-quality shooting.",
  ],
}

const TEMPLATE_ABOUT: Record<string, string> = {
  'Elite Dominators': 'A complete control team that dictates games through technical and territorial dominance. They suffocate opponents with sustained possession, build patiently through high passing volume, and maintain defensive solidity by keeping the ball rather than chasing it. The goalkeeper is rarely tested because the opponent is pinned back. This team wins by making the game feel hopeless for the opposition.',
  'Tiki-Taka': 'Possession-as-control specialists who use the ball as both attack and defence. They build through short, precise central combinations, rarely use width or direct passes, and compress the midfield to create numerical overloads. Their pressing after ball loss is coordinated rather than frantic — they cut passing lanes rather than chase. When it works, the opponents chase shadows.',
  'Gegenpressing': 'A high-intensity pressing machine that treats every lost ball as an immediate attacking opportunity. They swarm the ball within seconds of losing it high up the pitch, commit tactical fouls to stop counters when the press is bypassed, and play with a high defensive line that squeezes opponents into their own half. Exhausting to play against.',
  'Disciplined Pressers': 'An intelligent pressing team that wins the ball through positioning and reading the game rather than physical aggression. They cut passing lanes through anticipation, intercept rather than tackle, and rarely commit fouls. The hallmark is efficiency: maximum ball recovery with minimum defensive risk. The most economical pressing style in the game.',
  'Quick Counter': 'Vertical, explosive transition specialists who punish opponents that over-commit. They absorb pressure in a medium-to-low block, then explode forward on turnover with minimal touches. Their forwards constantly test the defensive line with runs in behind, accepting offside calls as part of the strategy. The keeper is busy because they invite pressure before striking.',
  'Long Ball Counter': 'Deep-defence, direct-attack specialists who bypass the midfield entirely. They sit in a compact low block, go direct from clearances and goal kicks, and compete for second balls in midfield. The goalkeeper effectively becomes a central defender in possession — long distribution starts attacks. Low risk, low reward, but brutally effective when it works.',
  'The Grinders': 'Physical, combative football that wins through duels, set-pieces, and sheer work rate. They engage in every challenge, commit and win fouls in equal measure, and drag technically superior opponents into uncomfortable physical battles. Their attacking threat comes from dead-ball situations and second-ball chaos. Not pretty, but effective.',
  'Out Wide': 'Expansive attacking play that stretches opponents through constant width. They attack both flanks consistently, deliver crosses early and often, and win corners through sustained wide pressure. By stretching defensive lines horizontally, they create space for midfield runners to exploit between centre-backs and fullbacks. Width is their weapon.',
  'Set-Piece Specialists': 'Dead-ball experts who treat every corner, free kick, and attacking throw-in as a genuine goal-scoring opportunity. They actively win fouls in dangerous areas through purposeful dribbling, and every set-piece is rehearsed with specific routines designed for each opponent. The statistical signature combines high corner volume with frequent free kicks.',
  'Shoot-on-Sight': 'Volume-shooting specialists who believe more shots equals more goals. They shoot early, often, and from anywhere — distance, tight angles, under pressure. The low on-target ratio reflects willingness to shoot from low-probability positions rather than poor finishing. Deflections, rebounds, and keeper errors create secondary chances from blocked shots.',
}

function getCombinedDescription(profileNames: string[]): {
  name: string
  about: string
  tendencies: string[]
  weaknesses: string[]
} {
  const combinedName = getCombinationName(profileNames) ?? profileNames[0] ?? 'Pragmatic Stabilizers'

  // Merge about texts
  const aboutParts = profileNames
    .map((p) => TEMPLATE_ABOUT[p])
    .filter(Boolean)
  const about = aboutParts.length > 0
    ? aboutParts.join(' ') + (aboutParts.length > 1 ? ' This hybrid approach blends multiple tactical identities into a unique, multi-dimensional style.' : '')
    : 'A balanced team with no single dominant tactical identity, adapting their approach based on opponent and game state.'

  // Merge tendencies (deduplicate themes)
  const seenTendencies = new Set<string>()
  const tendencies: string[] = []
  for (const p of profileNames) {
    const pts = TEMPLATE_TENDENCIES[p] ?? []
    for (const t of pts) {
      const key = t.slice(0, 60)
      if (!seenTendencies.has(key)) {
        seenTendencies.add(key)
        tendencies.push(t)
      }
    }
  }

  // Merge weaknesses
  const seenWeaknesses = new Set<string>()
  const weaknesses: string[] = []
  for (const p of profileNames) {
    const ws = TEMPLATE_WEAKNESSES[p] ?? []
    for (const w of ws) {
      const key = w.slice(0, 60)
      if (!seenWeaknesses.has(key)) {
        seenWeaknesses.add(key)
        weaknesses.push(w)
      }
    }
  }

  return { name: combinedName, about, tendencies, weaknesses }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching team_dna rows...')
  const { data: rows, error } = await supabase
    .from('team_dna')
    .select('*')

  if (error) {
    console.error('Error fetching team_dna:', error)
    process.exit(1)
  }

  if (!rows || rows.length === 0) {
    console.log('No team_dna rows found.')
    return
  }

  console.log(`Found ${rows.length} team_dna rows.`)

  for (const row of rows) {
    const profiles: string[] = [row.primary_profile]
    if (row.secondary_profile) profiles.push(row.secondary_profile)
    if (row.tertiary_profile) profiles.push(row.tertiary_profile)

    const { name, about, tendencies, weaknesses } = getCombinedDescription(profiles)

    // Compute combined level from average of all profile scores
    const scores = [row.primary_score ?? 0]
    if (row.secondary_score) scores.push(row.secondary_score)
    if (row.tertiary_score) scores.push(row.tertiary_score)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

    const level = avgScore >= 0.80 ? '+++++'
      : avgScore >= 0.65 ? '++++'
      : avgScore >= 0.50 ? '+++'
      : avgScore >= 0.38 ? '++'
      : avgScore >= 0.27 ? '+'
      : avgScore >= 0.18 ? '-'
      : avgScore >= 0.10 ? '--'
      : avgScore >= 0.04 ? '---'
      : '----'

    console.log(`  Updating ${row.primary_profile} → ${name} (${level})`)

    const { error: upsertError } = await supabase
      .from('team_dna')
      .upsert({
        team_id: row.team_id,
        primary_profile: name,
        primary_level: level,
        primary_score: avgScore,
        primary_about: about,
        primary_tendencies: tendencies,
        primary_weaknesses: weaknesses,
        primary_coach_note: null,
        secondary_profile: null,
        secondary_level: null,
        secondary_score: 0,
        secondary_about: null,
        secondary_tendencies: [],
        secondary_coach_note: null,
        secondary_weaknesses: [],
        tertiary_profile: null,
        tertiary_level: null,
        tertiary_score: 0,
        tertiary_about: null,
        tertiary_tendencies: [],
        tertiary_coach_note: null,
        tertiary_weaknesses: [],
        combination_about: null,
        combination_tendencies: [],
        combination_coach_note: null,
        combination_weaknesses: [],
      }, { onConflict: 'team_id' })

    if (upsertError) {
      console.error(`  Error updating ${row.team_id}:`, upsertError)
    }
  }

  console.log('Done.')
}

main()
