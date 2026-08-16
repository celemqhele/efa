/**
 * One-off: apply backdoor losses (3-0) to Manchester City's fixtures on 2026-08-15
 * where Man City is absent, mirroring the WhatsApp admin backdoor flow
 * (handleBackdoorSide) + the direct result-submit pattern.
 *
 * Fixtures (all EFA Champions League, tournament 7174e29f-64c7-4f77-97f2-0fefe15d7e35):
 *   33af4c21  Chelsea (home) 3-0 Man City   MD33 leg 1
 *   f82c3583  PSG (home)     3-0 Man City   MD42 leg 2
 *   69cd36a9  Man City 0-3 Chelsea (away)   MD37 leg 2
 *
 * Per fixture:
 *   - upserts the result (on_result_insert trigger updates group_standings)
 *   - confirms the fixture status (group fixtures need the explicit update)
 *   - voids pending backdoor_submissions
 *   - notifies both team managers
 *   - writes an audit_log entry
 * Then recalculates standings for the tournament.
 *
 * Run: npx tsx scripts/backdoor-mci-loss-15aug.ts
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
const TOURNAMENT_ID = '7174e29f-64c7-4f77-97f2-0fefe15d7e35' // EFA Champions League

// Man City is the absent side in every fixture below.
const BACKDOOR_FIXTURES = [
  { id: '33af4c21-de5a-43c0-878e-65a2c0a08bbd', home_score: 3, away_score: 0, away_absent: true }, // Chelsea 3-0 Man City
  { id: 'f82c3583-8a5d-47bc-9fb1-1822994dbfdf', home_score: 3, away_score: 0, away_absent: true }, // PSG 3-0 Man City
  { id: '69cd36a9-d354-428f-80ff-550f2d26073d', home_score: 0, away_score: 3, home_absent: true },  // Man City 0-3 Chelsea
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  for (const bf of BACKDOOR_FIXTURES) {
    const { data: fixture, error: fetchError } = await supabase
      .from('fixtures')
      .select(`
        id, status, tournament_id, matchday, round_type,
        home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
        away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
      `)
      .eq('id', bf.id)
      .single()

    if (fetchError || !fixture) {
      throw new Error(`Fixture not found: ${fetchError?.message ?? bf.id}`)
    }

    const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
    const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
    const label = `${home?.name ?? 'Home'} ${bf.home_score}-${bf.away_score} ${away?.name ?? 'Away'}`
    console.log(`[${bf.id}] ${label} (status: ${fixture.status})`)

    // Idempotent re-run guard: if already confirmed with the matching score, skip apply.
    const { data: existingResult } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', bf.id)
      .maybeSingle()
    const alreadyApplied = fixture.status === 'confirmed' &&
      existingResult?.home_score === bf.home_score &&
      existingResult?.away_score === bf.away_score
    if (alreadyApplied) {
      console.log('  already applied — skipping.')
      continue
    }
    if (fixture.status !== 'scheduled') {
      throw new Error(`Fixture ${bf.id} is ${fixture.status} with a different result — aborting.`)
    }

    await supabase.from('result_confirmations').insert({
      fixture_id: bf.id,
      home_score: bf.home_score,
      away_score: bf.away_score,
      submitted_by: ADMIN_ID,
    })

    const { data: result, error: resultError } = await supabase
      .from('results')
      .upsert(
        {
          fixture_id: bf.id,
          home_score: bf.home_score,
          away_score: bf.away_score,
          is_abandoned: false,
          finalised_by: ADMIN_ID,
        },
        { onConflict: 'fixture_id' }
      )
      .select('id')
      .single()
    if (resultError || !result) {
      throw new Error(`Result upsert failed for ${bf.id}: ${resultError?.message}`)
    }

    await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', bf.id)

    await supabase
      .from('backdoor_submissions')
      .update({ status: 'void_game_played' })
      .eq('fixture_id', bf.id)
      .eq('status', 'pending')

    const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
    const notificationRows = managerIds.map((uid) => ({
      user_id: uid,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: label,
      data: {
        fixture_id: bf.id,
        home_score: String(bf.home_score),
        away_score: String(bf.away_score),
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
      target_id: bf.id,
      details: {
        home_score: bf.home_score,
        away_score: bf.away_score,
        result_id: result.id,
        home_absent: !!bf.home_absent,
        away_absent: !!bf.away_absent,
      },
    })
    if (auditError) console.error('Audit log insert failed:', auditError.message)

    console.log(`  result ${result.id} saved, fixture confirmed, ${notificationRows.length} notification(s), audit written.`)
  }

  console.log('\nRecalculating standings for EFA Champions League...')
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const summary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', summary)

  console.log('\n--- verify ---')
  for (const bf of BACKDOOR_FIXTURES) {
    const { data: f } = await supabase
      .from('fixtures')
      .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', bf.id)
      .single()
    const { data: r } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', bf.id)
      .maybeSingle()
    const h = Array.isArray(f?.home_team) ? f?.home_team[0]?.name : f?.home_team?.name
    const a = Array.isArray(f?.away_team) ? f?.away_team[0]?.name : f?.away_team?.name
    const ok = f?.status === 'confirmed' && r && r.home_score === bf.home_score && r.away_score === bf.away_score
    console.log(`${ok ? 'OK ' : 'FAIL'} ${h} ${r?.home_score ?? '-'}-${r?.away_score ?? '-'} ${a} (status: ${f?.status})`)
    if (!ok) throw new Error(`Verification FAILED for ${bf.id}`)
  }
  console.log('\nDone — all 3 backdoor losses applied and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
