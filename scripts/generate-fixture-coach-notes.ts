/**
 * Generates coach notes for upcoming fixtures by comparing team playstyles
 * and weaknesses against opponent strengths.
 *
 * Run: npx tsx scripts/generate-fixture-coach-notes.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface DNARow {
  team_id: string
  primary_profile: string
  primary_level: string
  primary_score: number
  primary_about: string | null
  primary_tendencies: string[]
  primary_weaknesses: string[]
}

// ── Confidence calculator ────────────────────────────────────────────────────
const LEVEL_ORDER: Record<string, number> = {
  '+++++': 10,
  '++++': 9,
  '+++': 8,
  '++': 7,
  '+': 6,
  '-': 5,
  '--': 4,
  '---': 3,
  '----': 2,
  '-----': 1,
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

// ── Weakness-to-exploit mapping ──────────────────────────────────────────────
// Maps an opponent's weakness description to an exploit note for the team
function generateExploit(weakness: string, opponentName: string): string {
  // The weaknesses are already in the format "This team tends to X, so attempt Y..."
  // We just need to rephrase from the opponent's perspective
  return weakness
    .replace(/^This team tends to /, `${opponentName} tends to `)
    .replace(/, so attempt /, ', so expect them to ')
    .replace(/, because it will /, ', which will ')
}

function generateRecommendation(weakness: string, teamName: string): string {
  // Extract the "attempt Y" part from the weakness description
  const match = weakness.match(/so attempt ([^,]+),/)
  if (match) {
    return `${teamName} should ${match[1].toLowerCase()}, as the opponent is vulnerable to this approach.`
  }
  return `${teamName} should look to exploit the opponent's structural weaknesses in transition and set-piece situations.`
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Get all teams with managers (active teams)
  const { data: activeTeams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .not('manager_id', 'is', null)

  if (teamsError) {
    console.error('Error fetching teams:', teamsError)
    process.exit(1)
  }

  if (!activeTeams || activeTeams.length === 0) {
    console.log('No active teams found.')
    return
  }

  console.log(`Found ${activeTeams.length} active teams.`)

  // 2. Get DNA for all active teams
  const teamIds = activeTeams.map((t: any) => t.id)
  const { data: dnaRows, error: dnaError } = await supabase
    .from('team_dna')
    .select('*')
    .in('team_id', teamIds)

  if (dnaError) {
    console.error('Error fetching DNA:', dnaError)
    process.exit(1)
  }

  const dnaMap = new Map<string, DNARow>()
  for (const row of dnaRows ?? []) {
    dnaMap.set(row.team_id, row)
  }

  // 3. For each team, find next 6 fixtures
  const now = new Date().toISOString()
  let totalNotes = 0

  for (const team of activeTeams as Array<{ id: string; name: string }>) {
    const teamDna = dnaMap.get(team.id)
    if (!teamDna) {
      console.log(`  ${team.name}: No DNA data, skipping.`)
      continue
    }

    const { data: fixtures, error: fixError } = await supabase
      .from('fixtures')
      .select('id, scheduled_date, home_team_id, away_team_id')
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      .eq('status', 'scheduled')
      .gte('scheduled_date', now)
      .order('scheduled_date', { ascending: true })
      .limit(6)

    if (fixError) {
      console.error(`  Error fetching fixtures for ${team.name}:`, fixError)
      continue
    }

    if (!fixtures || fixtures.length === 0) {
      console.log(`  ${team.name}: No upcoming fixtures.`)
      continue
    }

    for (const fixture of fixtures as Array<{ id: string; scheduled_date: string; home_team_id: string; away_team_id: string }>) {
      const opponentId = fixture.home_team_id === team.id ? fixture.away_team_id : fixture.home_team_id
      const opponentDna = dnaMap.get(opponentId)

      if (!opponentDna) {
        console.log(`    ${team.name} vs opponent: No opponent DNA, skipping.`)
        continue
      }

      const opponentName = activeTeams.find((t: any) => t.id === opponentId)?.name ?? 'Opponent'

      // Generate coach notes for TEAM about OPPONENT
      const confidence = computeConfidence(teamDna.primary_level, opponentDna.primary_level)

      const opponentWillExploit: string[] = []
      for (const w of (teamDna.primary_weaknesses ?? [])) {
        opponentWillExploit.push(generateExploit(w, opponentName))
      }

      const recommendations: string[] = []
      for (const w of (opponentDna.primary_weaknesses ?? [])) {
        recommendations.push(generateRecommendation(w, team.name))
      }

      // Insert/update coach note
      const noteData = {
        fixture_id: fixture.id,
        team_id: team.id,
        opponent_id: opponentId,
        confidence,
        opponent_will_exploit: opponentWillExploit,
        recommendations: recommendations.slice(0, 3),
      }

      const { error: upsertError } = await supabase
        .from('fixture_coach_notes')
        .upsert(noteData, { onConflict: 'fixture_id, team_id' })

      if (upsertError) {
        console.error(`    Error upserting coach note for ${team.name}:`, upsertError)
      } else {
        totalNotes++
        console.log(`    ${team.name} vs ${opponentName}: ${confidence} ✓`)
      }
    }
  }

  console.log(`\nDone. Generated ${totalNotes} coach notes.`)
}

main()
