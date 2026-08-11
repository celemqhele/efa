/**
 * Repair the wrong result submission for PSG vs Manchester City.
 *
 * The WhatsApp result flow submitted the 12 Aug match result to the FUTURE
 * 15 Aug fixture. This script:
 *   1. Reverts MD42 (f82c3583, PSG vs Man City, 15 Aug) to scheduled, removing
 *      its result, match_stats and result_confirmations.
 *   2. Confirms MD26 (443b0f88, Man City vs PSG, 12 Aug) with the real result
 *      Man City 3 - PSG 7 (PSG won 7-3), moving the captured match stats over.
 *   3. Recalculates standings for the tournament (DELETE doesn't fire the
 *      standings trigger, so a full rebuild is required).
 *
 * Run: npx tsx scripts/fix-psg-mci-result.ts
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

try {
  loadEnvFile('.env.local')
} catch {
  // fall back to process env
}
try {
  loadEnvFile('.env.supabase')
} catch {
  // optional
}

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

const WRONG_FIXTURE = 'f82c3583-8a5d-47bc-9fb1-1822994dbfdf' // MD42 PSG vs Man City (15 Aug)
const CORRECT_FIXTURE = '443b0f88-9e1a-4f94-a635-12a710b79af9' // MD26 Man City vs PSG (12 Aug)
const TOURNAMENT_ID = '7174e29f-64c7-4f77-97f2-0fefe15d7e35'

const WRONG_RESULT_ID = 'de0b30ba-cde1-4611-aaed-28a96fb9db5a'
const WRONG_STATS_ID = '424f39fc-9702-48d1-8499-7befa63d653d'

const HOME_SCORE = 3 // Manchester City
const AWAY_SCORE = 7 // Paris Saint Germain (won 7-3)

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Capture the match stats values so we can move them onto the new result.
  //    Idempotent: on a re-run the source row is already gone and the stats are
  //    already attached to MD26's result, so capture nothing and skip the move.
  const { data: statsRow } = await supabase
    .from('match_stats')
    .select('*')
    .eq('id', WRONG_STATS_ID)
    .maybeSingle()
  let statsValues: Record<string, unknown> | null = null
  if (statsRow) {
    const { id: _sid, result_id: _rid, created_at: _c, ...vals } = statsRow as any
    statsValues = vals
  }

  // 2. Revert the wrong fixture (MD42).
  await supabase.from('match_stats').delete().eq('id', WRONG_STATS_ID)
  await supabase.from('result_confirmations').delete().eq('fixture_id', WRONG_FIXTURE)
  const { error: delResErr } = await supabase.from('results').delete().eq('fixture_id', WRONG_FIXTURE)
  if (delResErr) throw new Error(`delete wrong result failed: ${delResErr.message}`)
  const { error: resetErr } = await supabase
    .from('fixtures')
    .update({ status: 'scheduled' })
    .eq('id', WRONG_FIXTURE)
  if (resetErr) throw new Error(`reset wrong fixture failed: ${resetErr.message}`)

  // 3. Confirm the correct fixture (MD26) exactly like the webhook does.
  //    Clean any prior confirmations so the script is safe to re-run.
  await supabase.from('result_confirmations').delete().eq('fixture_id', CORRECT_FIXTURE)
  const { error: confErr } = await supabase.from('result_confirmations').insert({
    fixture_id: CORRECT_FIXTURE,
    home_score: HOME_SCORE,
    away_score: AWAY_SCORE,
    submitted_by: ADMIN_ID,
  })
  if (confErr) throw new Error(`confirmation insert failed: ${confErr.message}`)

  const { data: newResult, error: resErr } = await supabase
    .from('results')
    .upsert({
      fixture_id: CORRECT_FIXTURE,
      home_score: HOME_SCORE,
      away_score: AWAY_SCORE,
      finalised_by: ADMIN_ID,
    }, { onConflict: 'fixture_id' })
    .select('id')
    .maybeSingle()
  if (resErr || !newResult) throw new Error(`results upsert failed: ${resErr?.message ?? 'no row'}`)

  // The on_result_insert trigger updates group_standings but RETURNs early for
  // group fixtures, so it never confirms them. Mirror the webhook's explicit
  // status update (group fixtures depend on it).
  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', CORRECT_FIXTURE)

  const { error: statsErr } = await supabase
    .from('match_stats')
    .upsert({ result_id: newResult.id, ...(statsValues ?? {}) }, { onConflict: 'result_id' })
  if (statsErr) throw new Error(`match_stats upsert failed: ${statsErr.message}`)

  // 4. Rebuild standings (DELETE doesn't fire the standings trigger).
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const recalcSummary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', recalcSummary)

  // 5. Verify final state.
  const { data: wrong } = await supabase.from('fixtures').select('id, status').eq('id', WRONG_FIXTURE).single()
  const { data: correct } = await supabase.from('fixtures').select('id, status').eq('id', CORRECT_FIXTURE).single()
  const { data: wrongResult } = await supabase.from('results').select('id').eq('fixture_id', WRONG_FIXTURE).maybeSingle()
  const { data: correctResult } = await supabase
    .from('results')
    .select('fixture_id, home_score, away_score')
    .eq('fixture_id', CORRECT_FIXTURE)
    .maybeSingle()

  console.log('\n--- verify ---')
  console.log('MD42 (15 Aug):', wrong?.status, 'result rows:', wrongResult ? 1 : 0)
  console.log('MD26 (12 Aug):', correct?.status, 'result:', correctResult ? `${correctResult.home_score}-${correctResult.away_score}` : 'MISSING')

  if (wrong?.status !== 'scheduled' || wrongResult || correct?.status !== 'confirmed' || correctResult?.home_score !== HOME_SCORE || correctResult?.away_score !== AWAY_SCORE) {
    throw new Error('Verification FAILED — see output above')
  }
  console.log('\nRepair complete and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
