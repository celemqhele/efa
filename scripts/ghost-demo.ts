import { createClient } from '@supabase/supabase-js'

const s = createClient('https://dtxnqtfqsehofezdmdbd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc')

async function main() {
  // 1. Clean up old ghost data if any
  const { data: oldTeams } = await s.from('teams').select('id').or('name.ilike.%ghost%,name.ilike.%demo%').limit(10)
  for (const t of (oldTeams ?? [])) {
    await s.from('fixture_coach_notes').delete().eq('team_id', t.id)
    await s.from('team_dna').delete().eq('team_id', t.id)
    await s.from('fixtures').delete().or(`home_team_id.eq.${t.id},away_team_id.eq.${t.id}`)
    await s.from('teams').delete().eq('id', t.id)
  }
  console.log('Cleaned up old ghost data')

  // 2. Create 2 ghost teams
  const { data: t1 } = await s.from('teams').insert({
    name: 'Atlas Lions',
    logo_league_folder: 'custom',
    logo_team_slug: 'atlas-lions',
  }).select('id').single()

  const { data: t2 } = await s.from('teams').insert({
    name: 'Cobalt FC',
    logo_league_folder: 'custom',
    logo_team_slug: 'cobalt-fc',
  }).select('id').single()

  console.log('Created teams:', { t1: t1?.id, t2: t2?.id })

  // 3. Assign playstyles
  await s.from('team_dna').upsert({
    team_id: t1!.id,
    primary_profile: 'Gegenpressing',
    primary_level: '++++',
    primary_score: 0.67,
    primary_about: 'Atlas Lions suffocate opponents with relentless high-intensity pressing, forcing turnovers in dangerous areas and converting defensive actions into immediate goal-scoring opportunities.',
    primary_tendencies: ['Swarm the ball carrier within 3 seconds of losing possession', 'High defensive line that compresses the pitch into the opponent\'s half', 'Vertical passing immediately after winning the ball back'],
    primary_weaknesses: ['Atlas Lions tends to leave space behind their high line, so expect opponents to attempt long balls over the top, which will create one-on-one chances if the press is broken.', 'Atlas Lions tends to fatigue in the final 15 minutes, so expect opponents to conserve energy and increase intensity late, which will exploit decreasing defensive concentration.'],
    primary_coach_note: 'Atlas Lions employ a gegenpressing approach. They swarm the ball carrier immediately after losing possession. They will look to win the ball high and strike before the opponent can settle into defensive shape.',
  }, { onConflict: 'team_id' })

  await s.from('team_dna').upsert({
    team_id: t2!.id,
    primary_profile: 'Tiki-Taka',
    primary_level: '+++',
    primary_score: 0.52,
    primary_about: 'Cobalt FC are possession purists who dictate the tempo through intricate short passing combinations, patiently circulating the ball until a defensive crack appears.',
    primary_tendencies: ['Build from the back with short, patient passing to draw opponents out of position', 'Create midfield overloads with rotating positional play', 'Quick one-touch passing in the final third to disorganise defenders'],
    primary_weaknesses: ['Cobalt FC tends to struggle when pressed aggressively by multiple attackers, so expect opponents to implement a coordinated high press, which will force rushed passes and create turnovers.', 'Cobalt FC tends to become frustrated when their forward passes are consistently cut out, so expect opponents to sit deep in a compact shape, which will force sideways recycling instead of progression.'],
    primary_coach_note: 'Cobalt FC employ a tiki-taka approach. They keep the ball with purpose, circulating it methodically while waiting for the perfect moment to penetrate the defensive lines. They will look to exhaust opponents through relentless possession.',
  }, { onConflict: 'team_id' })

  console.log('Assigned playstyles')

  // 4. Get or create a friendlies tournament
  let { data: tournament } = await s.from('tournaments').select('id').eq('type', 'friendlies').limit(1).single()
  if (!tournament) {
    const { data: newTourney } = await s.from('tournaments').insert({
      name: 'Demo Showcase',
      type: 'friendlies',
      season_id: 'fee4a878-9159-4fd7-999f-d1bc7821bf86',
    }).select('id').single()
    tournament = newTourney
  }
  console.log('Tournament:', tournament?.id)

  // 5. Create ghost fixture
  const { data: fixture } = await s.from('fixtures').insert({
    tournament_id: tournament!.id,
    home_team_id: t1!.id,
    away_team_id: t2!.id,
    matchday: 999,
    round_type: 'super_cup',
    scheduled_date: new Date().toISOString().split('T')[0],
    status: 'scheduled',
  }).select('id').single()

  console.log('Fixture:', fixture?.id)

  // 6. Generate coach note (HOME team = Atlas Lions, admin perspective)
  await s.from('fixture_coach_notes').upsert({
    fixture_id: fixture!.id,
    team_id: t1!.id,
    opponent_id: t2!.id,
    confidence: '++',
    opponent_will_exploit: [
      'Cobalt FC tends to struggle when pressed aggressively by multiple attackers, so expect them to implement a coordinated high press, which will force rushed passes and create turnovers.',
      'Cobalt FC tends to become frustrated when their forward passes are consistently cut out, so expect them to sit deep in a compact shape, which will force sideways recycling instead of progression.',
    ],
    recommendations: [
      'Atlas Lions should press aggressively in the first 10 minutes to unsettle their build-up, as the opponent is vulnerable to this approach.',
      'Atlas Lions should target the space behind Cobalt FC\'s full-backs with direct vertical passes, as the opponent is vulnerable to this approach.',
      'Atlas Lions should stay compact when out of possession, frustrate their passing rhythm, and break at speed on the counter.',
    ],
  }, { onConflict: 'fixture_id, team_id' })

  console.log('Coach note created')

  // 7. Output URLs
  const APP_URL = 'https://efa-fxyk.vercel.app'
  console.log('\n=== DEMO LINKS ===')
  console.log(`Atlas Lions team page: ${APP_URL}/teams/${t1!.id}`)
  console.log(`Cobalt FC team page:    ${APP_URL}/teams/${t2!.id}`)
  console.log(`Match page:             ${APP_URL}/fixtures/${fixture!.id}`)
  console.log(`Atlas Lions DNA badge shows: Gegenpressing ++++ (home team with coach notes)`)
  console.log(`Cobalt FC DNA badge shows:    Tiki-Taka +++`)
}

main().catch(console.error)
