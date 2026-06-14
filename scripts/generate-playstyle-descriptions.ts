/**
 * Generates unique playstyle descriptions for every team.
 * Handles both old and new profile names by generating
 * contextually appropriate content from the profile label itself.
 *
 * Run: npx tsx scripts/generate-playstyle-descriptions.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ── Dynamic generators ───────────────────────────────────────────────────────
// Uses the profile label itself to construct meaningful, unique descriptions.

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const count = Math.min(arr.length, n)
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count)
}

// About templates indexed by profile label for best-match.
// Falls back to dynamic generation for unknown profiles.

const ABOUT_TEMPLATES: Record<string, string[]> = {
  'Technical Dominance': [
    '{team} overwhelm opponents through superior technical quality, controlling matches with precise passing, intelligent movement, and an unshakeable composure on the ball.',
    '{team} impose their technical superiority on every match, using crisp passing and intelligent positioning to dominate possession and create high-quality chances.',
    'Built on a foundation of technical excellence, {team} control the tempo of games through superior ball retention and creative final-third play.',
  ],
  'Defensive Solidity': [
    '{team} build from a rock-solid defensive foundation, prioritising organisation and discipline while waiting for opportunities to strike on the counter.',
    '{team} are masters of defensive organisation — compact, disciplined, and exceptionally difficult to break down, they frustrate opponents before capitalising on mistakes.',
    'Defence first is {team}\'s motto — they are structured, resilient, and comfortable absorbing pressure before hitting opponents on the break.',
  ],
  'Possession with Purpose': [
    '{team} keep the ball with clear intent, patiently building attacks through structured phases while always looking for the decisive forward pass.',
    '{team} combine possession football with direct ambition — they keep the ball but always with the purpose of creating goal-scoring opportunities rather than passing for its own sake.',
    'Purposeful possession defines {team} — they circulate the ball methodically but always with an eye on penetrating the opposition defence.',
  ],
  'Calculated Counter': [
    '{team} are tactically disciplined counter-attackers, sitting deep in a compact shape before springing forward with precision and pace when opponents commit numbers forward.',
    '{team} specialise in calculated transitions — they defend intelligently, absorb pressure patiently, and strike with devastating effect when the moment is right.',
    'Discipline and timing define {team}\'s counter-attacking approach — they rarely force play, instead waiting for the perfect moment to transition from defence to attack.',
  ],
  'Fluid Attack': [
    '{team} attack with wonderful fluidity, their forwards interchanging positions seamlessly and creating confusion among opposition defenders with constant movement.',
    '{team} are a nightmare to defend against — their attackers rotate positions freely, dragging defenders out of shape and creating space for late runners from midfield.',
    'Fluidity in the final third sets {team} apart — their forward line is interchangeable, with players drifting wide, dropping deep, and running in behind at will.',
  ],
  'Quick Counter': [
    '{team} are built for devastating transitions — they absorb pressure patiently, then explode forward with pace and precision the moment they win possession.',
    'Speed is {team}\'s primary weapon: they concede possession willingly, sit deep in a compact shape, then spring forward with blistering counter-attacks that catch opponents out of position.',
    '{team} are at their most dangerous when they don\'t have the ball — their transition game is so sharp that opponents must think twice before committing numbers forward.',
  ],
  'Forward\'s Delight': [
    '{team} play with an attacking verve that puts opposing defences under constant pressure, creating a steady stream of chances through adventurous forward play.',
    'Attacking football is {team}\'s identity — they commit players forward, take risks in the final third, and create an entertaining brand of football that keeps defenders on edge.',
    '{team} prioritise attacking ambition above all else — they create chances through volume and variety, keeping goalkeepers and defenders constantly under pressure.',
  ],
  'Disciplined Pressers': [
    '{team} combine the intensity of modern pressing football with remarkable defensive discipline — they win the ball high up the pitch without resorting to reckless challenges.',
    '{team} press with purpose rather than panic, using tactical positioning and intelligent cover shadows to funnel opponents into traps before springing coordinated pressure.',
    'A controlled aggression sets {team} apart — they press intensely but intelligently, rarely committing fouls while still winning the ball back in dangerous advanced positions.',
  ],
  'Aggressive High Press': [
    '{team} are relentless in their high press, swarming opponents in their own half and forcing errors through sheer intensity and coordinated pressure waves.',
    'Chaos and intensity define {team}\'s pressing game — they hunt in packs, refuse to give opponents time on the ball, and thrive on turnovers in advanced positions.',
    '{team} smother opponents with relentless high-pressure defending, winning the ball back quickly and creating chances through forced errors in the opposition half.',
  ],
}

const TENDENCIES_BY_PROFILE: Record<string, string[]> = {
  'Technical Dominance': [
    'Build from the back with short, patient passing to draw opponents out of position',
    'Overload central areas before switching play to exploit space out wide',
    'Midfielders rotate positions to create confusion in opposition marking',
    'Full-backs push high to provide width while midfielders occupy half-spaces',
    'Quick combinations in tight areas to break through compact defensive lines',
  ],
  'Defensive Solidity': [
    'Deep defensive block with two compact lines, prioritising defensive shape',
    'Centre-backs stay narrow to protect the central channel at all costs',
    'Full-backs tuck inside to form a back five when defending wide areas',
    'Limited attacking commitment — only 3-4 players advance into the final third',
    'Goalkeeper organises the defensive line constantly to maintain structure',
  ],
  'Possession with Purpose': [
    'Patient build-up through the thirds with emphasis on progression rather than sideways passing',
    'Central midfielders probe for forward passes rather than recycling possession',
    'Wingers stay wide to stretch the defence, creating central space for midfield runners',
    'Striker drops deep to link play while wingers attack the space behind',
    'Full-backs provide overlapping options to create 2v1 situations out wide',
  ],
  'Calculated Counter': [
    'Sit deep in a compact mid-block, inviting opponents forward before breaking quickly',
    'Central striker drifts wide to receive the ball in space before cutting inside',
    'Rapid vertical passes from defensive interceptions directly to attacking runners',
    'Wide players stay high and wide to provide immediate outlets on the break',
    'Full-backs rarely overlap, instead forming a back three for defensive security',
  ],
  'Fluid Attack': [
    'Forwards interchange positions constantly, making them difficult to mark',
    'Wide players cut inside while full-backs provide the width',
    'False nine drops deep to create space for wingers running in behind',
    'Late midfield runners arrive in the box from deep positions',
    'Quick one-touch passing in the final third to disorganise defenders',
  ],
  'Quick Counter': [
    'Defend in a compact low-to-mid block, inviting opponents forward before breaking quickly',
    'Central striker drifts wide to receive the ball in space before cutting inside',
    'Rapid vertical passes from defensive interceptions directly to attacking runners',
    'Wide players stay high and wide to provide immediate outlets on the break',
    'Full-backs rarely overlap, instead forming a back three to provide defensive security',
  ],
  'Forward\'s Delight': [
    'Full-backs push high to pin opposition wingers back in their own half',
    'Centre-forwards make constant runs in behind to stretch the defensive line',
    'Midfielders arrive late in the box to capitalise on knock-downs and cutbacks',
    'Wingers cut inside onto their stronger foot to create shooting opportunities',
    'Overload in wide areas before delivering crosses into the box',
  ],
  'Disciplined Pressers': [
    'Diagonal pressing traps that force opponents towards the touchline before springing the trap',
    'Cover shadows used to cut off passing lanes while one player pressures the ball carrier',
    'Midfield drops into the backline to create numerical superiority when building from the back',
    'Staggered pressing — first line aggressive, second line holds shape to intercept',
    'Quick rest-defence organisation to prevent counter-attacks after losing the ball',
  ],
  'Aggressive High Press': [
    'Aggressive counter-pressing with 3-4 players swarming the ball carrier immediately after possession loss',
    'High defensive line to compress the pitch and force opponents into mistakes',
    'Quick vertical passes into the channels after winning the ball in midfield',
    'Overload wide areas when pressing, forcing opponents to play into congested central areas',
    'Late runners from midfield arriving in the box to capitalise on second balls',
  ],
}

const WEAKNESSES_BY_PROFILE: Record<string, string[]> = {
  'Technical Dominance': [
    '{team} tends to struggle against physically aggressive opponents who disrupt their rhythm, so attempt repeated tactical fouls and physical challenges in midfield, because it will break their passing sequences and force mistakes.',
    '{team} tends to leave space in behind when their full-backs push high, so attempt quick vertical passes into the channels behind their defensive line, because it will exploit the temporary numerical disadvantage in their backline.',
  ],
  'Defensive Solidity': [
    '{team} tends to lack creativity when they need to chase the game, so attempt to take an early lead and force them to open up, because it will expose their limited attacking capabilities.',
    '{team} tends to struggle against teams that move the ball quickly in wide areas, so attempt to stretch the play with quick switches and overlapping runs, because it will pull their compact defensive shape apart.',
  ],
  'Possession with Purpose': [
    '{team} tends to become frustrated when their forward passes are consistently cut out, so attempt to sit deep in a compact shape and deny space in behind, because it will force them into sideways recycling rather than progression.',
    '{team} tends to struggle when pressed aggressively by multiple attackers, so attempt to implement a coordinated high press against their build-up, because it will force rushed passes and create turnovers.',
  ],
  'Calculated Counter': [
    '{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them the transitional space they need.',
    '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their centre-backs, because it will force rushed clearances and create chances from errors.',
  ],
  'Fluid Attack': [
    '{team} tends to leave defensive gaps when their forwards rotate and lose positional discipline, so attempt to counter-attack quickly after winning the ball in midfield, because it will catch their defence disorganised.',
    '{team} tends to struggle against well-organised low blocks that deny space between the lines, so attempt to maintain a deep, compact shape with two banks of four, because it will congest the areas they need to exploit.',
  ],
  'Quick Counter': [
    '{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them the transitional space they need.',
    '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their centre-backs, because it will force rushed clearances and create chances from errors.',
    '{team} tends to struggle against well-organised set-piece defences, so attempt to defend set pieces zonally with all players behind the ball, because it will neutralise their aerial threat from dead-ball situations.',
  ],
  'Forward\'s Delight': [
    '{team} tends to leave space in behind when their full-backs push forward aggressively, so attempt to play quick through balls into the channels behind the full-backs, because it will exploit the spaces they leave when attacking.',
    '{team} tends to become frustrated when their attacking moves break down against a disciplined defence, so attempt to maintain a compact defensive shape and absorb pressure, because it will force them into low-percentage attempts.',
  ],
  'Disciplined Pressers': [
    '{team} tends to lack creative spark against deep, organised defences, so attempt to sit deep in a compact mid-block and absorb pressure, because it will frustrate their build-up and force long-range shots.',
    '{team} tends to struggle against teams that bypass midfield with direct long balls, so attempt to play early diagonal switches to their full-backs, because it will bypass their pressing structure and create isolated wide duels.',
  ],
  'Aggressive High Press': [
    '{team} tends to leave significant space behind their high defensive line, so attempt precise long balls over the top for quick forwards to run onto, because it will bypass their entire press and create one-on-one chances.',
    '{team} tends to tire significantly in the final 20 minutes, so attempt to conserve energy early and increase intensity after the 70th minute, because it will exploit their fatigued legs and deteriorating shape.',
  ],
}

function normalizeKey(label: string): string {
  return label.trim().replace(/['\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
}

function generateAbout(profile: string, teamName: string): string {
  const key = normalizeKey(profile)
  const templates = ABOUT_TEMPLATES[key]
  if (templates && templates.length > 0) {
    return pick(templates).replace(/\{team\}/g, teamName)
  }
  // Dynamic fallback for unknown profiles
  const parts = profile.toLowerCase().split(/\s+/)
  const styles = ['calculated', 'structured', 'dynamic', 'fluid', 'disciplined', 'aggressive', 'patient', 'direct']
  const styleWord = parts.find(p => styles.includes(p)) ?? pick(styles)
  return `${teamName} play with a ${styleWord} ${profile.toLowerCase()} approach, focusing on their core tactical principles to control matches and create scoring opportunities.`
}

function generateTendencies(profile: string): string[] {
  const key = normalizeKey(profile)
  const templates = TENDENCIES_BY_PROFILE[key]
  if (templates && templates.length > 0) {
    return pickN(templates, 3)
  }
  // Dynamic fallback
  return [
    `Execute ${profile.toLowerCase()} principles with tactical discipline`,
    'Adapt formation and approach based on opposition strengths and weaknesses',
    'Capitalise on transition moments to create goal-scoring opportunities',
    'Maintain compact defensive shape when not in possession',
  ].sort(() => Math.random() - 0.5).slice(0, 3)
}

function generateWeaknesses(profile: string, teamName: string): string[] {
  const key = normalizeKey(profile)
  const templates = WEAKNESSES_BY_PROFILE[key]
  if (templates && templates.length > 0) {
    return pickN(templates, 2).map(t => t.replace(/\{team\}/g, teamName))
  }
  // Dynamic fallback
  return [
    `${teamName} tends to struggle against well-organised defensive systems, so attempt to maintain a compact shape and frustrate them, because it will neutralise their primary attacking threats.`,
    `${teamName} tends to be vulnerable to quick transitions when caught out of shape, so attempt to win the ball in midfield and attack quickly, because it will exploit moments of defensive disorganisation.`,
  ]
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching teams and DNA data...')

  const { data: teams } = await supabase.from('teams').select('id, name')
  if (!teams || teams.length === 0) { console.error('No teams found'); process.exit(1) }

  const { data: dnaRows } = await supabase.from('team_dna').select('*')
  if (!dnaRows || dnaRows.length === 0) { console.error('No DNA rows found'); process.exit(1) }

  const teamMap = new Map(teams.map(t => [t.id, t.name]))

  console.log(`Found ${teams.length} teams, ${dnaRows.length} DNA rows\n`)

  let updated = 0
  const updates: { name: string; profile: string; about: string }[] = []

  for (const row of dnaRows) {
    const teamName = teamMap.get(row.team_id) ?? 'Unknown'
    const profile = row.primary_profile

    if (!profile || profile === 'N/A' || profile.startsWith('N/A')) {
      console.log(`  ${teamName}: No profile assigned, skipping.`)
      continue
    }

    const about = generateAbout(profile, teamName)
    const tendencies = generateTendencies(profile)
    const weaknesses = generateWeaknesses(profile, teamName)
    const coachNote = `${teamName} employ a ${profile.toLowerCase()} approach. ${about.split('.')[0]}. They will look to exploit any defensive disorganisation and transition moments.`

    const { error } = await supabase
      .from('team_dna')
      .update({
        primary_about: about,
        primary_tendencies: tendencies,
        primary_weaknesses: weaknesses,
        primary_coach_note: coachNote,
      })
      .eq('team_id', row.team_id)

    if (error) {
      console.error(`  ${teamName}: Update failed — ${error.message}`)
    } else {
      updated++
      updates.push({ name: teamName, profile, about: about.slice(0, 80) })
    }
  }

  console.log(`\nUpdated ${updated}/${dnaRows.length} teams:\n`)
  for (const u of updates) {
    console.log(`  ${u.name.padEnd(22)} (${u.profile.padEnd(24)}) — ${u.about}...`)
  }

  console.log(`\nDone.`)
}

main().then(() => process.exit(0))
