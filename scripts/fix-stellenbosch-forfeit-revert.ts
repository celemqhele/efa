/**
 * Revert the mistaken Stellenbosch vs Midlands Wanderers forfeit and its ripple.
 *
 * The submitter entered the real 6-0 Stellenbosch win but then mistakenly marked
 * the match as forfeited, which adjusted it to 9-0 and created a 9-goal carry-over
 * forfeit balance for the Midlands Wanderers manager (phiwayinkosi). That balance
 * was then consumed on TS Galaxy vs Midlands Wanderers, turning the real 4-7 into
 * 13-7.
 *
 * This script:
 *   1. Reverts Stellenbosch vs Midlands Wanderers to a plain 6-0 result
 *      (no longer abandoned, forfeit override_reason cleared).
 *   2. Reverts TS Galaxy vs Midlands Wanderers to the real 4-7
 *      (forfeit_note override_reason cleared).
 *   3. Deletes the forfeit balance row (2ba6c88a) created from that forfeit.
 *   4. Rebuilds Betway Premiership standings from scratch (the UPDATE trigger is
 *      additive, so the full recalculateStandings rebuild is authoritative).
 *
 * Run: npx tsx scripts/fix-stellenbosch-forfeit-revert.ts
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

const TOURNAMENT_ID = '18d4f540-0246-42ae-8699-64d13d0a2ae7' // Betway Premiership
const STELLEN_FIXTURE = 'e2c790ce-59e3-4315-987c-2ca1b5983d8f' // Stellenbosch vs Midlands Wanderers (9-0 forfeit -> real 6-0)
const TS_GALAXY_FIXTURE = '6290bb68-b370-4426-8276-059f989c57bb' // TS Galaxy vs Midlands Wanderers (13-7 -> real 4-7)
const FORFEIT_BALANCE_ID = '2ba6c88a-0638-45b7-a582-fc74ed0fa7dc' // 9-goal carry-over for phiwayinkosi

const REAL_STELLENBOSCH_HOME = 6 // Stellenbosch
const REAL_STELLENBOSCH_AWAY = 0 // Midlands Wanderers
const REAL_TSGALAXY_HOME = 4 // TS Galaxy
const REAL_TSGALAXY_AWAY = 7 // Midlands Wanderers

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Revert the mistaken forfeit to the real played score.
  const { data: stellen, error: stellenErr } = await supabase
    .from('results')
    .update({
      home_score: REAL_STELLENBOSCH_HOME,
      away_score: REAL_STELLENBOSCH_AWAY,
      is_abandoned: false,
      abandoned_type: null,
      override_reason: null,
    })
    .eq('fixture_id', STELLEN_FIXTURE)
    .select('id, home_score, away_score, is_abandoned, abandoned_type')
    .maybeSingle()
  if (stellenErr || !stellen) {
    throw new Error(`Stellenbosch revert failed: ${stellenErr?.message ?? 'no row'}`)
  }

  // 2. Revert the carry-over-affected score back to the real result.
  const { data: tsGalaxy, error: tsgErr } = await supabase
    .from('results')
    .update({
      home_score: REAL_TSGALAXY_HOME,
      away_score: REAL_TSGALAXY_AWAY,
      override_reason: null,
    })
    .eq('fixture_id', TS_GALAXY_FIXTURE)
    .select('id, home_score, away_score, is_abandoned')
    .maybeSingle()
  if (tsgErr || !tsGalaxy) {
    throw new Error(`TS Galaxy revert failed: ${tsgErr?.message ?? 'no row'}`)
  }

  // 3. Remove the forfeit balance created from the mistaken forfeit.
  const { error: delErr } = await supabase
    .from('forfeit_balances')
    .delete()
    .eq('id', FORFEIT_BALANCE_ID)
  if (delErr) throw new Error(`forfeit balance delete failed: ${delErr.message}`)

  // 4. Rebuild standings (UPDATE trigger is additive; full rebuild is authoritative).
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const recalcSummary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', recalcSummary)

  // 5. Verify final state.
  const { data: stellenCheck } = await supabase
    .from('results')
    .select('home_score, away_score, is_abandoned, abandoned_type, override_reason')
    .eq('fixture_id', STELLEN_FIXTURE)
    .maybeSingle()
  const { data: tsgCheck } = await supabase
    .from('results')
    .select('home_score, away_score, override_reason')
    .eq('fixture_id', TS_GALAXY_FIXTURE)
    .maybeSingle()
  const { data: balanceCheck } = await supabase
    .from('forfeit_balances')
    .select('id')
    .eq('id', FORFEIT_BALANCE_ID)
    .maybeSingle()

  console.log('\n--- verify ---')
  console.log('Stellenbosch vs Midlands Wanderers:', `${stellenCheck?.home_score}-${stellenCheck?.away_score}`, 'abandoned:', stellenCheck?.is_abandoned, stellenCheck?.abandoned_type ?? '(none)', 'reason:', stellenCheck?.override_reason ?? '(none)')
  console.log('TS Galaxy vs Midlands Wanderers:', `${tsgCheck?.home_score}-${tsgCheck?.away_score}`, 'reason:', tsgCheck?.override_reason ?? '(none)')
  console.log('forfeit balance row:', balanceCheck ? 'STILL PRESENT' : 'deleted')

  const ok =
    stellenCheck?.home_score === REAL_STELLENBOSCH_HOME &&
    stellenCheck?.away_score === REAL_STELLENBOSCH_AWAY &&
    stellenCheck?.is_abandoned === false &&
    !stellenCheck?.abandoned_type &&
    !stellenCheck?.override_reason &&
    tsgCheck?.home_score === REAL_TSGALAXY_HOME &&
    tsgCheck?.away_score === REAL_TSGALAXY_AWAY &&
    !tsgCheck?.override_reason &&
    !balanceCheck
  if (!ok) throw new Error('Verification FAILED — see output above')
  console.log('\nRepair complete and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
