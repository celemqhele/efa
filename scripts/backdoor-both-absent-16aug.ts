/**
 * One-off: apply "both teams absent" (0-0, no points) to all scheduled fixtures on 2026-08-16
 * mirroring the WhatsApp admin backdoor flow (handleBackdoorSide) + the direct result-submit pattern.
 *
 * Fixtures (21 total across 3 tournaments):
 *   EFA Europa League (80e86b39-1314-403d-ad91-ff7666fdde80): 9 fixtures
 *   EFA Champions League (7174e29f-64c7-4f77-97f2-0fefe15d7e35): 8 fixtures
 *   EFA Premier League (35adbc8e-fc5d-4311-9a26-e12e902fda3f): 5 fixtures
 *
 * Per fixture:
 *   - upserts the result (on_result_insert trigger updates group_standings)
 *   - confirms the fixture status (group fixtures need the explicit update)
 *   - voids pending backdoor_submissions
 *   - notifies both team managers
 *   - writes an audit_log entry
 * Then recalculates standings for all 3 tournaments.
 *
 * Run: npx tsx scripts/backdoor-both-absent-16aug.ts
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

try { loadEnvFile('.env.local') } catch {}
try { loadEnvFile('.env.supabase') } catch {}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!url) {
  const dbUrl = process.env.SUPABASE_DB_URL ?? ''
  const m = dbUrl.match(/^postgresql:\/\/postgres\.([^:]+):/)
  if (m) url = `https://${m[1]}.supabase.co`
}
if (!url || !key || key.length < 10) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// The standings engine reads these env vars via createAdminClient()
process.env.NEXT_PUBLIC_SUPABASE_URL = url

const ADMIN_ID = '87d8afba-296d-4512-9811-3d32a76eb37a' // celemqhele

// Tournament IDs
const TOURNAMENT_EUROPA = '80e86b39-1314-403d-ad91-ff7666fdde80'     // EFA Europa League
const TOURNAMENT_CL = '7174e29f-64c7-4f77-97f2-0fefe15d7e35'           // EFA Champions League
const TOURNAMENT_PL = '35adbc8e-fc5d-4311-9a26-e12e902fda3f'           // EFA Premier League

// All fixtures scheduled for 2026-08-16 with status 'scheduled'
// Both teams absent → 0-0, no points for either side
const BACKDOOR_FIXTURES = [
  // EFA Europa League (TOURNAMENT_EUROPA)
  { id: '96b1b0e5-1cad-462d-bbf5-9a4987445467', tournament_id: TOURNAMENT_EUROPA },
  { id: 'c9e4e20d-37d1-4f4f-a539-e73abc411cf5', tournament_id: TOURNAMENT_EUROPA },
  { id: '5866b97e-e44c-4b5f-8060-08415b02b137', tournament_id: TOURNAMENT_EUROPA },
  { id: 'eaa28a8a-24ce-451e-88e7-0625c7e16f7c', tournament_id: TOURNAMENT_EUROPA },
  { id: 'bb6aa480-2853-4756-8443-1d59bf615b1e', tournament_id: TOURNAMENT_EUROPA },
  { id: 'abaedab1-9246-4314-96d2-80ba92dacbdb', tournament_id: TOURNAMENT_EUROPA },
  { id: '4798e81c-0e74-4ec6-9d5d-bec57fee6cdc', tournament_id: TOURNAMENT_EUROPA },
  { id: '69ffe813-73ed-4ddd-85ea-19bf94d9cdbb', tournament_id: TOURNAMENT_EUROPA },
  { id: '29a341fa-df9f-4a48-878d-d7299798fa40', tournament_id: TOURNAMENT_EUROPA }, // Actually Premier League? Let me check...
  // Wait, let me verify - I'll fetch tournament_id per fixture dynamically
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // First, fetch all fixtures to get their tournament_ids dynamically
  const fixtureIds = [
    '96b1b0e5-1cad-462d-bbf5-9a4987445467',
    'c9e4e20d-37d1-4f4f-a539-e73abc411cf5',
    '1a8287be-a56f-4e3c-83e9-d4d534160c6b',
    '84d618ac-b01a-451c-81e5-d3a0f2359a41',
    '5866b97e-e44c-4b5f-8060-08415b02b137',
    'eaa28a8a-24ce-451e-88e7-0625c7e16f7c',
    'bb6aa480-2853-4756-8443-1d59bf615b1e',
    'c719fd39-fe49-44d3-8099-8875dfd77d57',
    'abaedab1-9246-4314-96d2-80ba92dacbdb',
    '48fec65b-6eb1-4dc5-8761-51514f5ba619',
    '4798e81c-0e74-4ec6-9d5d-bec57fee6cdc',
    '69ffe813-73ed-4ddd-85ea-19bf94d9cdbb',
    '01d06f85-0b54-43c9-b8ec-496bb32a4035',
    '32363ee9-6951-4eaa-908c-9daa821c14d4',
    'd56ad0e7-3668-48bb-bc6a-caf7b522258f',
    'b2ef19b5-6abc-44f5-be5a-683a3e57ff68',
    'f1e32e85-220f-4b68-bace-8b858e46d24c',
    '29a341fa-df9f-4a48-878d-d7299798fa40',
    'cddf9892-1a66-4a72-a2ca-4ad2630192ac',
    '7868a991-d1b8-4d85-afb5-eeda73855871',
    '81ace9cd-aea6-4e3a-89d6-699f220c3c50',
  ]

  const { data: fixturesData, error: fixturesError } = await supabase
    .from('fixtures')
    .select('id, tournament_id, matchday, status')
    .in('id', fixtureIds)

  if (fixturesError || !fixturesData) {
    throw new Error(`Failed to fetch fixtures: ${fixturesError?.message}`)
  }

  const fixturesMap = new Map(fixturesData.map(f => [f.id, f]))

  for (const fixtureId of fixtureIds) {
    const fixtureInfo = fixturesMap.get(fixtureId)
    if (!fixtureInfo) {
      console.error(`Fixture not found: ${fixtureId}`)
      continue
    }

    const { data: fixture, error: fetchError } = await supabase
      .from('fixtures')
      .select(`
        id, status, tournament_id, matchday, round_type,
        home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
        away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
      `)
      .eq('id', fixtureId)
      .single()

    if (fetchError || !fixture) {
      throw new Error(`Fixture not found: ${fetchError?.message ?? fixtureId}`)
    }

    const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
    const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
    const label = `${home?.name ?? 'Home'} 0-0 ${away?.name ?? 'Away'}`
    console.log(`[${fixture.id}] ${label} (MD${fixture.matchday}, status: ${fixture.status})`)

    // Idempotent re-run guard: if already confirmed with 0-0 score, skip apply.
    const { data: existingResult } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', fixture.id)
      .maybeSingle()
    const alreadyApplied = fixture.status === 'confirmed' &&
      existingResult?.home_score === 0 &&
      existingResult?.away_score === 0
    if (alreadyApplied) {
      console.log('  already applied — skipping.')
      continue
    }
    if (fixture.status !== 'scheduled') {
      throw new Error(`Fixture ${fixture.id} is ${fixture.status} with a different result — aborting.`)
    }

    await supabase.from('result_confirmations').insert({
      fixture_id: fixture.id,
      home_score: 0,
      away_score: 0,
      submitted_by: ADMIN_ID,
    })

    const { data: result, error: resultError } = await supabase
      .from('results')
      .upsert(
        {
          fixture_id: fixture.id,
          home_score: 0,
          away_score: 0,
          is_abandoned: false,
          finalised_by: ADMIN_ID,
          override_reason: 'Both teams absent — result void (0–0, no points)',
        },
        { onConflict: 'fixture_id' }
      )
      .select('id')
      .single()
    if (resultError || !result) {
      throw new Error(`Result upsert failed for ${fixture.id}: ${resultError?.message}`)
    }

    await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fixture.id)

    await supabase
      .from('backdoor_submissions')
      .update({ status: 'void_game_played' })
      .eq('fixture_id', fixture.id)
      .eq('status', 'pending')

    const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
    const notificationRows = managerIds.map((uid) => ({
      user_id: uid,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: label,
      data: {
        fixture_id: fixture.id,
        home_score: '0',
        away_score: '0',
      },
    }))
    if (notificationRows.length > 0) {
      const { error: notifError } = await supabase.from('notifications').insert(notificationRows)
      if (notifError) console.error('Notification insert failed:', notifError.message)
    }

    const { error: auditError } = await supabase.from('audit_log').insert({
      admin_id: ADMIN_ID,
      action: 'finalise_result',
      target_type: 'fixture',
      target_id: fixture.id,
      details: {
        home_score: 0,
        away_score: 0,
        result_id: result.id,
        home_absent: true,
        away_absent: true,
      },
    })
    if (auditError) console.error('Audit log insert failed:', auditError.message)

    console.log(`  result ${result.id} saved, fixture confirmed, ${notificationRows.length} notification(s), audit written.`)
  }

  // Recalculate standings for all 3 affected tournaments
  const tournamentsToRecalc = [
    { id: TOURNAMENT_EUROPA, name: 'EFA Europa League' },
    { id: TOURNAMENT_CL, name: 'EFA Champions League' },
    { id: TOURNAMENT_PL, name: 'EFA Premier League' },
  ]

  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')

  for (const t of tournamentsToRecalc) {
    console.log(`\nRecalculating standings for ${t.name}...`)
    const summary = await recalc(t.id)
    console.log(`recalculateStandings:`, summary)
  }

  console.log('\n--- verify ---')
  for (const fixtureId of fixtureIds) {
    const { data: f } = await supabase
      .from('fixtures')
      .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', fixtureId)
      .single()
    const { data: r } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    const h = Array.isArray(f?.home_team) ? f?.home_team[0]?.name : f?.home_team?.name
    const a = Array.isArray(f?.away_team) ? f?.away_team[0]?.name : f?.away_team?.name
    const ok = f?.status === 'confirmed' && r && r.home_score === 0 && r.away_score === 0
    console.log(`${ok ? 'OK ' : 'FAIL'} ${h} ${r?.home_score ?? '-'}-${r?.away_score ?? '-'} ${a} (status: ${f?.status})`)
    if (!ok) throw new Error(`Verification FAILED for ${fixtureId}`)
  }
  console.log('\nDone — all 21 backdoor both-absent results applied and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})