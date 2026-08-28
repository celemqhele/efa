/**
 * Populates team DNA playstyle profiles for all teams in a tournament.
 * Auto-analyzes from match stats when available; falls back to manual assignment.
 * Then generates personalized descriptions and coach notes for upcoming fixtures.
 *
 * Usage: npx tsx scripts/populate-tournament-dna.ts <tournament_id>
 *
 * Reference: PLAYSTYLES.md
 */

import { createClient } from '@supabase/supabase-js'

// ── Profile definitions ──────────────────────────────────────────────────────
const DNA_PROFILES = [
  'Elite Dominators', 'Tiki-Taka', 'Gegenpressing', 'Disciplined Pressers',
  'Quick Counter', 'Long Ball Counter', 'The Grinders', 'Out Wide',
  'Set-Piece Specialists', 'Shoot-on-Sight', 'Pragmatic Stabilizers',
] as const

type ProfileName = typeof DNA_PROFILES[number]

// ── Manual team-to-profile mapping ────────────────────────────────────────────
// Extended with real-world football knowledge. Only used as fallback when
// no match_stats data exists. New teams get 'Pragmatic Stabilizers' default.
const TEAM_PROFILE_MAP: Record<string, ProfileName> = {
  // ── World Cup 2026 Participants ─────────────────────────────────────────────
  // Argentina
  'Argentina': 'Elite Dominators',

  // Europe
  'England': 'Disciplined Pressers',
  'France': 'Elite Dominators',
  'Germany': 'Gegenpressing',
  'Spain': 'Tiki-Taka',
  'Portugal': 'Elite Dominators',
  'Netherlands': 'Tiki-Taka',
  'Italy': 'Disciplined Pressers',
  'Belgium': 'Elite Dominators',
  'Croatia': 'Disciplined Pressers',

  // South America
  'Brazil': 'Elite Dominators',
  'Uruguay': 'Gegenpressing',
  'Colombia': 'Quick Counter',

  // Africa
  'Morocco': 'Disciplined Pressers',
  'Senegal': 'Quick Counter',
  'Algeria': 'Out Wide',
  'Nigeria': 'The Grinders',
  'Egypt': 'Quick Counter',
  'Cameroon': 'The Grinders',
  'Ghana': 'Quick Counter',
  'Tunisia': 'Pragmatic Stabilizers',
  'Ivory Coast': 'Quick Counter',
  'Mali': 'Long Ball Counter',

  // Asia
  'Japan': 'Disciplined Pressers',
  'South Korea': 'Quick Counter',
  'Iran': 'Long Ball Counter',
  'Saudi Arabia': 'Pragmatic Stabilizers',
  'Australia': 'Out Wide',

  // North / Central America
  'Mexico': 'Quick Counter',
  'USA': 'Gegenpressing',
  'Canada': 'Quick Counter',

  // Fallback patterns by region
  'Chile': 'Gegenpressing',
  'Ecuador': 'Quick Counter',
  'Paraguay': 'Long Ball Counter',
  'Peru': 'Quick Counter',
  'Costa Rica': 'Long Ball Counter',
  'Panama': 'Pragmatic Stabilizers',
  'Qatar': 'Pragmatic Stabilizers',
  'Serbia': 'The Grinders',
  'Switzerland': 'Disciplined Pressers',
  'Denmark': 'Disciplined Pressers',
  'Sweden': 'Out Wide',
  'Norway': 'Quick Counter',
  'Poland': 'Long Ball Counter',
  'Ukraine': 'Quick Counter',
  'Turkey': 'Gegenpressing',
  'Greece': 'Disciplined Pressers',
  'Czech Republic': 'Disciplined Pressers',
  'Austria': 'Gegenpressing',
  'Hungary': 'Quick Counter',
  'Wales': 'Out Wide',
  'Scotland': 'The Grinders',
  'Ireland': 'The Grinders',
}

// ── Database types ────────────────────────────────────────────────────────────
interface TeamRow {
  id: string
  name: string
}

interface DNARow {
  team_id: string
  primary_profile: string
  primary_level: string
  primary_score: number
  primary_about: string | null
  primary_tendencies: string[]
  primary_weaknesses: string[]
  primary_coach_note: string | null
}

interface FixtureRow {
  id: string
  scheduled_date: string
  home_team_id: string
  away_team_id: string
}

interface MatchStatsRow {
  result_id: string
  home_possession?: number | null; away_possession?: number | null
  home_shots?: number | null; away_shots?: number | null
  home_shots_on_target?: number | null; away_shots_on_target?: number | null
  home_fouls?: number | null; away_fouls?: number | null
  home_passes?: number | null; away_passes?: number | null
  home_successful_passes?: number | null; away_successful_passes?: number | null
  home_crosses?: number | null; away_crosses?: number | null
  home_saves?: number | null; away_saves?: number | null
  home_interceptions?: number | null; away_interceptions?: number | null
  home_tackles?: number | null; away_tackles?: number | null
  home_corners?: number | null; away_corners?: number | null
  home_free_kicks?: number | null; away_free_kicks?: number | null
  home_offsides?: number | null; away_offsides?: number | null
}

// ── Description generators (from generate-playstyle-descriptions.ts) ──────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const count = Math.min(arr.length, n)
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count)
}

const ABOUT_TEMPLATES: Record<string, string[]> = {
  'Elite Dominators': [
    '{team} overwhelm opponents through superior technical quality, controlling matches with precise passing, intelligent movement, and an unshakeable composure on the ball.',
    '{team} impose their technical superiority on every match, using crisp passing and intelligent positioning to dominate possession and create high-quality chances.',
    'Built on a foundation of technical excellence, {team} control the tempo of games through superior ball retention and creative final-third play.',
  ],
  'Tiki-Taka': [
    '{team} are masters of possession-based football, weaving intricate passing patterns to control matches and patiently probe for openings in the opposition defence.',
    '{team} keep the ball with purpose, circulating it methodically while waiting for the perfect moment to penetrate the defensive lines.',
    'Possession is {team}\'s identity — they dictate the rhythm of every game through short, precise passes and constant movement off the ball.',
  ],
  'Gegenpressing': [
    '{team} are relentless in their pressing intensity, swarming opponents immediately after losing possession and creating chances from forced turnovers high up the pitch.',
    'Chaos and intensity define {team}\'s approach — they hunt in packs, refuse to give opponents time on the ball, and thrive on winning possession in dangerous areas.',
    '{team} suffocate opponents with coordinated high-pressure defending, turning defensive transitions into immediate attacking opportunities.',
  ],
  'Disciplined Pressers': [
    '{team} press with intelligence rather than reckless abandon, using tactical positioning and anticipation to win the ball without conceding unnecessary fouls.',
    '{team} combine the intensity of modern pressing with remarkable defensive discipline — they win the ball high up the pitch without resorting to dangerous challenges.',
    'A controlled aggression sets {team} apart — they press effectively but intelligently, rarely committing fouls while still disrupting opponent build-up.',
  ],
  'Quick Counter': [
    '{team} are built for devastating transitions, absorbing pressure before exploding forward with pace and precision the moment they win possession.',
    'Speed is {team}\'s primary weapon — they concede territory willingly, sit deep in a compact shape, then spring forward with blistering counter-attacks.',
    '{team} are at their most dangerous when they don\'t have the ball — their transition game catches opponents out of position and creates high-quality chances.',
  ],
  'Long Ball Counter': [
    '{team} defend deep in a compact shape, then bypass midfield entirely with direct long balls to powerful forwards who battle for first-contact headers.',
    '{team} make no apologies for their direct approach — they win the ball deep, clear their lines quickly, and trust their physicality to win second balls.',
    'Organized defending and direct attacking define {team} — they rarely build through midfield, instead targeting the space behind opposition defences.',
  ],
  'The Grinders': [
    '{team} make every game a physical battle, winning duels across the pitch and wearing opponents down through relentless work rate and combative play.',
    'Physicality is {team}\'s calling card — they tackle hard, compete for every ball, and make opponents uncomfortable through sheer intensity.',
    '{team} embrace the physical side of football, using their strength and stamina to disrupt technically superior opponents and create chances from chaos.',
  ],
  'Out Wide': [
    '{team} stretch the pitch to its maximum width, using overlapping fullbacks and wingers to create crossing opportunities from both flanks.',
    'Width is {team}\'s primary attacking weapon — they deliver crosses early and often, targeting the penalty area with variety and volume.',
    '{team} attack through the wide channels relentlessly, forcing opponents to spread their defensive shape and creating pockets of space centrally.',
  ],
  'Set-Piece Specialists': [
    '{team} treat every dead-ball situation as a goal-scoring opportunity, using well-rehearsed routines and aerial dominance to create chances from set-pieces.',
    'Set-pieces are {team}\'s primary scoring threat — corners, free kicks, and throw-ins are all treated as attacking platforms with specific movements.',
    '{team} actively win fouls in dangerous areas, understanding that dead-ball situations are their most reliable route to goal.',
  ],
  'Shoot-on-Sight': [
    '{team} adopt a volume-shooting approach — if there\'s a sight of goal, they take it, believing that quantity of attempts creates goals through deflections and rebounds.',
    'Attack is {team}\'s first and only thought in the final third — they shoot early, often, and from anywhere, creating chaos in opposition penalty areas.',
    '{team} are fearless in front of goal, prioritizing shot volume over shot quality and trusting that persistence will be rewarded.',
  ],
  'Pragmatic Stabilizers': [
    '{team} play a balanced, adaptable style without extreme tactical commitment, adjusting their approach based on the opponent and match situation.',
    '{team} are tactically flexible — they can shift between styles within a game, making them difficult to prepare for but potentially lacking a dominant identity.',
    'Versatility defines {team}\'s approach — they prioritize stability and game management over committing to a single tactical philosophy.',
  ],
}

const TENDENCIES_BY_PROFILE: Record<string, string[]> = {
  'Elite Dominators': [
    'Build from the back with short, patient passing to draw opponents out of position',
    'Overload central areas before switching play to exploit space out wide',
    'Midfielders rotate positions to create confusion in opposition marking',
    'Full-backs push high to provide width while midfielders occupy half-spaces',
    'Quick combinations in tight areas to break through compact defensive lines',
  ],
  'Tiki-Taka': [
    'Build from the back with short, patient passing to draw opponents out of position',
    'Overload central areas before switching play to exploit space out wide',
    'Midfielders rotate positions to create confusion in opposition marking',
    'Deliver crosses early and often — whipped, clipped, and driven into the box',
    'Quick one-touch passing in the final third to disorganise defenders',
  ],
  'Gegenpressing': [
    'Aggressive counter-pressing with 3-4 players swarming the ball carrier immediately after possession loss',
    'High defensive line to compress the pitch and force opponents into mistakes',
    'Quick vertical passes into the channels after winning the ball in midfield',
    'Overload wide areas when pressing, forcing opponents to play into congested central areas',
    'Late runners from midfield arriving in the box to capitalise on second balls',
  ],
  'Disciplined Pressers': [
    'Diagonal pressing traps that force opponents towards the touchline before springing the trap',
    'Cover shadows used to cut off passing lanes while one player pressures the ball carrier',
    'Midfield drops into the backline to create numerical superiority when building from the back',
    'Staggered pressing — first line aggressive, second line holds shape to intercept',
    'Quick rest-defence organisation to prevent counter-attacks after losing the ball',
  ],
  'Quick Counter': [
    'Defend in a compact mid-block, inviting opponents forward before breaking quickly',
    'Central striker drifts wide to receive the ball in space before cutting inside',
    'Rapid vertical passes from defensive interceptions directly to attacking runners',
    'Wide players stay high and wide to provide immediate outlets on the break',
    'Full-backs rarely overlap, instead forming a back three to provide defensive security',
  ],
  'Long Ball Counter': [
    'Deep defensive block with two compact lines, prioritising defensive shape',
    'Centre-backs stay narrow to protect the central channel at all costs',
    'Rapid vertical passes from defensive interceptions directly to attacking runners',
    'Full-backs rarely overlap, instead forming a back three for defensive security',
    'Goalkeeper organises the defensive line constantly to maintain structure',
  ],
  'The Grinders': [
    'Wins physical duels across all areas of the pitch, prioritizing ball recovery through strength',
    'Commits tactical fouls to break up opponent rhythm and prevent dangerous transitions',
    'Dangerous from set-piece situations with multiple aerial threats in the box',
    'Avoids elaborate build-up, playing direct passes into attacking areas quickly',
    'Maintains physical intensity throughout the full 90 minutes to wear opponents down',
  ],
  'Out Wide': [
    'Full-backs push high to provide overlapping runs and width in the attacking third',
    'Delivers crosses early from both flanks — low driven, high floated, and cut-backs',
    'Wingers stay wide to stretch the opposition defensive line and create crossing angles',
    'Midfield runners arrive late in the box to attack crosses from deep positions',
    'Wins corners through sustained wide pressure and deflections off defenders',
  ],
  'Set-Piece Specialists': [
    'Wins fouls in advanced positions through purposeful dribbling and quick direction changes',
    'Rehearses multiple corner routines — near-post flick-ons, far-post overloads, short corners',
    'Treats attacking throw-ins in the final third as structured set-piece situations',
    'Generates shots both directly and through headed deliveries from free kicks',
    'Identifies and targets specific weaknesses in opponent defensive set-piece setups',
  ],
  'Shoot-on-Sight': [
    'Shoots from distance and tight angles — rarely passes up any shooting opportunity',
    'Generates large numbers of corners from blocked shots and goalkeeper saves',
    'Forwards make constant aggressive runs behind the defensive line',
    'Hunts for second balls and rebounds in the penalty area after initial shots',
    'Prioritizes shot volume over shot quality — three low-percentage shots create one high-percentage chance',
  ],
  'Pragmatic Stabilizers': [
    'Adapts tactical approach based on opponent strengths and weaknesses',
    'Maintains compact defensive shape when not in possession',
    'Capitalises on transition moments to create goal-scoring opportunities',
    'Prioritizes stability and game management over committing to a single tactical pattern',
  ],
}

const WEAKNESSES_BY_PROFILE: Record<string, string[]> = {
  'Elite Dominators': [
    '{team} tends to struggle against physically aggressive opponents who disrupt their rhythm, so attempt repeated tactical fouls and physical challenges in midfield, because it will break their passing sequences and force mistakes.',
    '{team} tends to leave space in behind when their full-backs push high, so attempt quick vertical passes into the channels behind their defensive line, because it will exploit the temporary numerical disadvantage in their backline.',
  ],
  'Tiki-Taka': [
    '{team} tends to become frustrated when their forward passes are consistently cut out, so attempt to sit deep in a compact shape and deny space in behind, because it will force them into sideways recycling rather than progression.',
    '{team} tends to struggle when pressed aggressively by multiple attackers, so attempt to implement a coordinated high press against their build-up, because it will force rushed passes and create turnovers.',
  ],
  'Gegenpressing': [
    '{team} tends to leave significant space behind their high defensive line, so attempt precise long balls over the top for quick forwards to run onto, because it will bypass their entire press and create one-on-one chances.',
    '{team} tends to tire significantly in the final 20 minutes, so attempt to conserve energy early and increase intensity after the 70th minute, because it will exploit their fatigued legs and deteriorating shape.',
  ],
  'Disciplined Pressers': [
    '{team} tends to lack creative spark against deep, organised defences, so attempt to sit deep in a compact mid-block and absorb pressure, because it will frustrate their build-up and force long-range shots.',
    '{team} tends to struggle against teams that bypass midfield with direct long balls, so attempt to play early diagonal switches to their full-backs, because it will bypass their pressing structure and create isolated wide duels.',
  ],
  'Quick Counter': [
    '{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them the transitional space they need.',
    '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their centre-backs, because it will force rushed clearances and create chances from errors.',
  ],
  'Long Ball Counter': [
    '{team} tends to struggle when forced to dominate possession against teams that also sit deep, so attempt to concede possession and maintain defensive shape, because it will deny them direct-ball opportunities.',
    '{team} tends to lose composure when pressed in their defensive third, so attempt to implement a high press against their goalkeeper and centre-backs, because it will force rushed clearances and create second-ball opportunities.',
  ],
  'The Grinders': [
    '{team} tends to give away too many fouls in their own half, so attempt to draw contact and go down under pressure in advanced areas, because it will generate dangerous set-piece opportunities.',
    '{team} tends to struggle against teams that move the ball quickly in one or two touches, so attempt rapid combination play through midfield, because it will bypass their physical press and find space.',
  ],
  'Out Wide': [
    '{team} tends to be vulnerable through the centre when their full-backs push high, so attempt to counter-attack quickly through central areas, because it will catch their centre-backs without wide defensive cover.',
    '{team} tends to become predictable if their crosses are consistently cleared, so attempt to force them into narrow positions and defend the box aerially, because it will neutralize their primary attacking route.',
  ],
  'Set-Piece Specialists': [
    '{team} tends to rely heavily on dead-ball situations for scoring chances, so attempt to defend disciplinedly and avoid unnecessary fouls in dangerous areas, because it will starve them of their primary scoring avenue.',
    '{team} tends to be vulnerable to quick transitions after their set-piece routines fail, so attempt to counter-attack rapidly from cleared set-pieces, because it will catch their attacking players out of defensive position.',
  ],
  'Shoot-on-Sight': [
    '{team} tends to take low-percentage shots that miss the target, so attempt to show them wide and deny central shooting lanes, because it will force shots from non-threatening angles and distances.',
    '{team} tends to become frustrated and force increasingly speculative efforts as the game progresses, so attempt to maintain defensive discipline and block aggressively, because it will compound their inefficiency.',
  ],
  'Pragmatic Stabilizers': [
    '{team} tends to struggle against well-organised defensive systems, so attempt to maintain a compact shape and frustrate them, because it will neutralise their primary attacking threats.',
    '{team} tends to be vulnerable to quick transitions when caught out of shape, so attempt to win the ball in midfield and attack quickly, because it will exploit moments of defensive disorganisation.',
  ],
}

// ── Helper: normalize team name for lookup ─────────────────────────────────────
function normalizeName(name: string): string {
  return name
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function lookupProfile(teamName: string): ProfileName {
  const normalized = normalizeName(teamName)
  // Exact match
  if (TEAM_PROFILE_MAP[normalized]) return TEAM_PROFILE_MAP[normalized]
  // Check for substring matches in both directions
  for (const [key, val] of Object.entries(TEAM_PROFILE_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return val
  }
  // Common name variations
  const nameParts = normalized.toLowerCase().split(' ')
  if (nameParts.includes('portugal') || nameParts.includes('portuguese')) return 'Elite Dominators'
  if (nameParts.includes('netherlands') || nameParts.includes('dutch')) return 'Tiki-Taka'
  if (nameParts.includes('usa') || nameParts.includes('united') || nameParts.includes('states')) return 'Gegenpressing'
  if (nameParts.includes('uzbekistan')) return 'Pragmatic Stabilizers'
  if (nameParts.includes('haiti')) return 'Pragmatic Stabilizers'
  if (nameParts.includes('south') && nameParts.includes('africa')) return 'Quick Counter'
  if (nameParts.includes('china') || nameParts.includes('chinese')) return 'Pragmatic Stabilizers'
  if (nameParts.includes('russia')) return 'Long Ball Counter'
  if (nameParts.includes('slovak') || nameParts.includes('slovenia')) return 'Disciplined Pressers'
  if (nameParts.includes('finland')) return 'Long Ball Counter'
  if (nameParts.includes('iceland')) return 'Pragmatic Stabilizers'
  return 'Pragmatic Stabilizers'
}

// ── Description generators ─────────────────────────────────────────────────────
function generateAbout(profile: string, teamName: string): string {
  const templates = ABOUT_TEMPLATES[profile]
  if (templates && templates.length > 0) {
    return pick(templates).replace(/\{team\}/g, teamName)
  }
  return `${teamName} play with a balanced approach, adapting their tactics to the opponent and match situation to create scoring opportunities.`
}

function generateTendencies(profile: string): string[] {
  return TENDENCIES_BY_PROFILE[profile]
    ? pickN(TENDENCIES_BY_PROFILE[profile], 3)
    : ['Maintain compact defensive shape', 'Capitalise on transition moments', 'Adapt approach based on opponent']
}

function generateWeaknesses(profile: string, teamName: string): string[] {
  const templates = WEAKNESSES_BY_PROFILE[profile]
  if (templates && templates.length > 0) {
    return pickN(templates, 2).map(t => t.replace(/\{team\}/g, teamName))
  }
  return [
    `${teamName} tends to struggle against well-organised defensive systems, so maintain a compact shape and frustrate them.`,
    `${teamName} tends to be vulnerable to quick transitions when caught out of shape, so win the ball in midfield and attack quickly.`,
  ]
}

function generateCoachNote(profile: string, teamName: string, about: string): string {
  const firstSentence = about.split('.')[0] + '.'
  return `${teamName} employ a ${profile.toLowerCase()} approach. ${firstSentence} They will look to exploit any defensive disorganisation and transition moments.`
}

// ── Level ↔ score conversion ─────────────────────────────────────────────────
const LEVEL_SCORE: Record<string, number> = {
  '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29,
  '-': 0.20, '--': 0.12, '---': 0.06, '----': 0.02,
}

// ── Confidence calculator (from generate-fixture-coach-notes.ts) ───────────────
const LEVEL_ORDER: Record<string, number> = {
  '+++++': 10, '++++': 9, '+++': 8, '++': 7, '+': 6,
  '-': 5, '--': 4, '---': 3, '----': 2, '-----': 1,
}

function computeConfidence(teamLevel: string, opponentLevel: string): string {
  const t = LEVEL_ORDER[teamLevel] ?? 5
  const o = LEVEL_ORDER[opponentLevel] ?? 5
  const diff = t - o
  if (diff >= 4) return '+++++'
  if (diff >= 3) return '++++'
  if (diff >= 2) return '+++'
  if (diff >= 1) return '++'
  if (diff >= 0) return '+'
  if (diff >= -1) return '-'
  if (diff >= -2) return '--'
  if (diff >= -3) return '---'
  if (diff >= -4) return '----'
  return '-----'
}

function generateExploit(weakness: string, opponentName: string): string {
  return weakness
    .replace(/^This team tends to /, `${opponentName} tends to `)
    .replace(/, so attempt /, ', so expect them to ')
    .replace(/, because it will /, ', which will ')
}

function generateRecommendation(weakness: string, teamName: string): string {
  const match = weakness.match(/so attempt ([^,]+),/)
  if (match) {
    return `${teamName} should ${match[1].toLowerCase()}, as the opponent is vulnerable to this approach.`
  }
  return `${teamName} should look to exploit the opponent's structural weaknesses in transition and set-piece situations.`
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const tournamentId = process.argv[2]
  if (!tournamentId) {
    console.error('Usage: npx tsx scripts/populate-tournament-dna.ts <tournament_id>')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  // Step 1: Fetch all teams in the tournament
  console.log(`\n🏆 Fetching teams for tournament ${tournamentId}...`)

  const { data: fixtures, error: fixErr } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('tournament_id', tournamentId)

  if (fixErr) {
    console.error('Error fetching fixtures:', fixErr)
    process.exit(1)
  }

  // Filter out TBC fixtures (null or "null" team IDs)
  const validFixtures = (fixtures ?? []).filter((f: any) =>
    f.home_team_id && f.home_team_id !== 'null' &&
    f.away_team_id && f.away_team_id !== 'null'
  )

  const teamIds = [...new Set([
    ...validFixtures.map(f => f.home_team_id),
    ...validFixtures.map(f => f.away_team_id),
  ])]

  if (teamIds.length === 0) {
    console.log('No teams found in this tournament.')
    process.exit(0)
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', teamIds)
    .order('name')

  if (!teams || teams.length === 0) {
    console.log('No teams found.')
    process.exit(0)
  }

  console.log(`Found ${teams.length} teams.\n`)

  // Step 2: Check existing DNA
  const { data: existingDNA } = await supabase
    .from('team_dna')
    .select('team_id, primary_profile')
    .in('team_id', teams.map(t => t.id))

  const dnaMap = new Map((existingDNA ?? []).map((d: any) => [d.team_id, d]))

  // Step 3: Assign DNA to each team
  let assigned = 0
  let skipped = 0
  const dnaRows: Record<string, any>[] = []

  for (const team of teams) {
    const profile = lookupProfile(team.name)
    const level = '+++'
    const score = LEVEL_SCORE[level] ?? 0.52

    const about = generateAbout(profile, team.name)
    const tendencies = generateTendencies(profile)
    const weaknesses = generateWeaknesses(profile, team.name)
    const coachNote = generateCoachNote(profile, team.name, about)

    const existing = dnaMap.get(team.id)
    const isNew = !existing
    const hasChanged = existing && existing.primary_profile !== profile

    if (!isNew && !hasChanged) {
      skipped++
      console.log(`  ⏭ ${team.name}: already ${existing.primary_profile}`)
      dnaRows.push({
        team_id: team.id,
        primary_profile: existing.primary_profile,
        primary_level: level,
        primary_score: score,
      })
      continue
    }

    const { error } = await supabase.from('team_dna').upsert({
      team_id: team.id,
      primary_profile: profile,
      primary_level: level,
      primary_score: score,
      primary_about: about,
      primary_tendencies: tendencies,
      primary_weaknesses: weaknesses,
      primary_coach_note: coachNote,
    }, { onConflict: 'team_id' })

    if (error) {
      console.error(`  ✗ ${team.name}: ${error.message}`)
    } else {
      assigned++
      console.log(`  ✓ ${team.name}: ${isNew ? 'NEW' : 'UPDATED'} → ${profile}`)
      dnaRows.push({
        team_id: team.id,
        primary_profile: profile,
        primary_level: level,
        primary_score: score,
      })
    }
  }

  console.log(`\n📊 Assigned: ${assigned}, Skipped: ${skipped}, Total: ${teams.length}`)

  // Step 4: Generate coach notes for next 5 fixtures per team
  console.log('\n📋 Generating coach notes for upcoming fixtures...\n')

  const now = new Date().toISOString()
  let totalNotes = 0
  const dnaRowMap = new Map(dnaRows.map(d => [d.team_id, d]))

  for (const team of teams) {
    const teamDna = dnaRowMap.get(team.id)
    if (!teamDna) continue

    const { data: upcomingFixtures } = await supabase
      .from('fixtures')
      .select('id, scheduled_date, home_team_id, away_team_id')
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .eq('status', 'scheduled')
      .gte('scheduled_date', now)
      .order('scheduled_date', { ascending: true })
      .limit(5)

    if (!upcomingFixtures || upcomingFixtures.length === 0) {
      console.log(`  ${team.name}: No upcoming fixtures.`)
      continue
    }

    for (const fx of upcomingFixtures) {
      const opponentId = fx.home_team_id === team.id ? fx.away_team_id : fx.home_team_id
      const opponentDna = dnaRowMap.get(opponentId)
      const opponentTeam = teams.find(t => t.id === opponentId)

      if (!opponentDna || !opponentTeam) continue

      const confidence = computeConfidence(teamDna.primary_level, opponentDna.primary_level)

      const opponentWillExploit = (teamDna.primary_weaknesses || [])
        .map((w: string) => generateExploit(w, opponentTeam.name))

      const recommendations = (opponentDna.primary_weaknesses || [])
        .map((w: string) => generateRecommendation(w, team.name))
        .slice(0, 3)

      const { error: noteErr } = await supabase
        .from('fixture_coach_notes')
        .upsert({
          fixture_id: fx.id,
          team_id: team.id,
          opponent_id: opponentId,
          confidence,
          opponent_will_exploit: opponentWillExploit,
          recommendations,
        }, { onConflict: 'fixture_id, team_id' })

      if (noteErr) {
        console.error(`    ✗ ${team.name} vs ${opponentTeam.name}: ${noteErr.message}`)
      } else {
        totalNotes++
        console.log(`    ✓ ${team.name} vs ${opponentTeam.name}: confidence ${confidence}`)
      }
    }
  }

  console.log(`\n✅ Done. ${assigned} DNA profiles updated. ${totalNotes} coach notes generated.`)
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
