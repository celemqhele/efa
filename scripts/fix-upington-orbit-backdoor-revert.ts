/**
 * Revert the mistaken Upington City vs Orbit College forfeit and its ripple.
 *
 * Upington City vs Orbit College was recorded as a forfeit (Upington quit,
 * abandoned_type='home'), producing a 0-6 score and creating a 6-goal carry-over
 * forfeit balance for the Upington manager (karabo_). That balance was then
 * consumed on Upington City vs The Bees, turning the real 3-0 Upington win into
 * a 3-6 loss.
 *
 * The Orbit College game was actually a backdoor (Upington did not respond), so
 * it should be a plain 3-0 Orbit College win, not a 6-0 forfeit. Because it was
 * not a forfeit, no carry-over balance should exist, so the Bees game reverts to
 * the real 3-0.
 *
 * This script:
 *   1. Reverts Upington City vs Orbit College to a plain 0-3 backdoor result
 *      (no longer abandoned, forfeit flag/reason cleared).
 *   2. Reverts Upington City vs The Bees to the real 3-0 (forfeit_note cleared).
 *   3. Deletes the forfeit balance row (cf3837f6) created from that forfeit.
 *   4. Resets Upington City abandon_count 1 -> 0 (this forfeit was its only
 *      abandoned result ever; the standings engine does not touch abandon_count).
 *   5. Rebuilds Motsepe Foundation Championship standings from scratch (the
 *      UPDATE trigger is additive, so the full recalculateStandings rebuild is
 *      authoritative).
 *
 * Run: npx tsx scripts/fix-upington-orbit-backdoor-revert.ts
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

const TOURNAMENT_ID = '5a267e10-0edd-42f0-8f04-b28ec40713f8' // Motsepe Foundation Championship
const ORBIT_FIXTURE = '589f4491-4d40-4a01-970e-bc598af03d9d' // Upington City vs Orbit College (0-6 forfeit -> real 0-3 backdoor)
const BEES_FIXTURE = '46e9a45d-7699-4ed8-af7c-9bb12c5453b4' // Upington City vs The Bees (3-6 -> real 3-0)
const FORFEIT_BALANCE_ID = 'cf3837f6-5d0f-4b7e-b893-03a7fbbc4944' // 6-goal carry-over for karabo_
const UPINGTON_TEAM_ID = 'a4956f7c-2942-4c1c-bdaa-9cbbfb4a640f' // Upington City

// Real scores after the revert. Game 1 is a backdoor: Upington (home) did not
// respond, so Orbit College (away) wins 3-0. Game 2 was a genuine Upington win.
const ORBIT_HOME = 0 // Upington City
const ORBIT_AWAY = 3 // Orbit College
const BEES_HOME = 3 // Upington City
const BEES_AWAY = 0 // The Bees

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Revert the mistaken forfeit to the real backdoor result.
  const { data: orbit, error: orbitErr } = await supabase
    .from('results')
    .update({
      home_score: ORBIT_HOME,
      away_score: ORBIT_AWAY,
      is_abandoned: false,
      abandoned_type: null,
      override_reason: null,
    })
    .eq('fixture_id', ORBIT_FIXTURE)
    .select('id, home_score, away_score, is_abandoned, abandoned_type')
    .maybeSingle()
  if (orbitErr || !orbit) {
    throw new Error(`Orbit College revert failed: ${orbitErr?.message ?? 'no row'}`)
  }

  // 2. Revert the carry-over-affected score back to the real result.
  const { data: bees, error: beesErr } = await supabase
    .from('results')
    .update({
      home_score: BEES_HOME,
      away_score: BEES_AWAY,
      override_reason: null,
    })
    .eq('fixture_id', BEES_FIXTURE)
    .select('id, home_score, away_score, is_abandoned')
    .maybeSingle()
  if (beesErr || !bees) {
    throw new Error(`The Bees revert failed: ${beesErr?.message ?? 'no row'}`)
  }

  // 3. Remove the forfeit balance created from the mistaken forfeit.
  const { error: delErr } = await supabase
    .from('forfeit_balances')
    .delete()
    .eq('id', FORFEIT_BALANCE_ID)
  if (delErr) throw new Error(`forfeit balance delete failed: ${delErr.message}`)

  // 4. Undo the abandon_count increment the trigger applied when this forfeit
  //    was recorded (the trigger only ever +1 on is_abandoned, and the standings
  //    engine rebuild does not touch abandon_count). Upington City's only
  //    abandoned result ever is this game, so this brings it back to 0.
  const { data: currentTeam, error: curErr } = await supabase
    .from('teams')
    .select('name, abandon_count')
    .eq('id', UPINGTON_TEAM_ID)
    .maybeSingle()
  if (curErr || !currentTeam) {
    throw new Error(`Upington team lookup failed: ${curErr?.message ?? 'no row'}`)
  }
  const targetAbandon = Math.max(0, (currentTeam.abandon_count ?? 0) - 1)
  const { data: upington, error: teamErr } = await supabase
    .from('teams')
    .update({ abandon_count: targetAbandon })
    .eq('id', UPINGTON_TEAM_ID)
    .select('name, abandon_count')
    .maybeSingle()
  if (teamErr || !upington) {
    throw new Error(`Upington abandon_count reset failed: ${teamErr?.message ?? 'no row'}`)
  }

  // 5. Rebuild standings (UPDATE trigger is additive; full rebuild is authoritative).
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const recalcSummary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', recalcSummary)

  // 6. Verify final state.
  const { data: orbitCheck } = await supabase
    .from('results')
    .select('home_score, away_score, is_abandoned, abandoned_type, override_reason')
    .eq('fixture_id', ORBIT_FIXTURE)
    .maybeSingle()
  const { data: beesCheck } = await supabase
    .from('results')
    .select('home_score, away_score, override_reason')
    .eq('fixture_id', BEES_FIXTURE)
    .maybeSingle()
  const { data: balanceCheck } = await supabase
    .from('forfeit_balances')
    .select('id')
    .eq('id', FORFEIT_BALANCE_ID)
    .maybeSingle()
  const { data: teamCheck } = await supabase
    .from('teams')
    .select('name, abandon_count')
    .eq('id', UPINGTON_TEAM_ID)
    .maybeSingle()

  console.log('\n--- verify ---')
  console.log(
    'Upington City vs Orbit College:',
    `${orbitCheck?.home_score}-${orbitCheck?.away_score}`,
    'abandoned:', orbitCheck?.is_abandoned, orbitCheck?.abandoned_type ?? '(none)',
    'reason:', orbitCheck?.override_reason ?? '(none)'
  )
  console.log(
    'Upington City vs The Bees:',
    `${beesCheck?.home_score}-${beesCheck?.away_score}`,
    'reason:', beesCheck?.override_reason ?? '(none)'
  )
  console.log('forfeit balance row:', balanceCheck ? 'STILL PRESENT' : 'deleted')
  console.log('Upington City abandon_count:', teamCheck?.abandon_count)

  const ok =
    orbitCheck?.home_score === ORBIT_HOME &&
    orbitCheck?.away_score === ORBIT_AWAY &&
    orbitCheck?.is_abandoned === false &&
    !orbitCheck?.abandoned_type &&
    !orbitCheck?.override_reason &&
    beesCheck?.home_score === BEES_HOME &&
    beesCheck?.away_score === BEES_AWAY &&
    !beesCheck?.override_reason &&
    !balanceCheck &&
    teamCheck?.abandon_count === 0
  if (!ok) throw new Error('Verification FAILED — see output above')
  console.log('\nRepair complete and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
