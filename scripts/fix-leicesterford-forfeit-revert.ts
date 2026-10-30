/**
 * Revert the mistaken Leicesterford City forfeits in the CAF Confederations
 * League and the carry-over ripple they caused.
 *
 * Fixture 1: Leicesterford City (home) vs Upington City (away), 2026-10-27.
 * The real score submitted was 0-3 to Upington, but the submitter ticked
 * "forfeit" (home). The forfeit flow adds +3 to the opponent, so the row was
 * written as 0-6 with is_abandoned=true / abandoned_type='home', and it minted a
 * 6-goal carry-over forfeit balance (3a2e48df) for the Leicesterford manager.
 *
 * Fixture 2: Leicesterford City (home) vs Orbit College (away), 2026-10-29.
 * The real score was a 6-0 Leicesterford win, but the carry-over balance from
 * fixture 1 was applied on top, turning it into 6-6 (and stamping a
 * forfeit_note citing fixture 1).
 *
 * The user confirmed no forfeit applies to either match, so fixture 1 is the
 * plain 0-3 and fixture 2 is the real 6-0. Same class of repair as
 * .opencode/context/forfeit-balances/revert-upington-orbit-forfeit_2026-10-18.md
 * and .opencode/context/forfeit-balances/revert-stellenbosch-mistaken-forfeit_2026-10-16.md.
 *
 * This script:
 *   1. Reverts fixture 1 to a plain 0-3 (not abandoned, no forfeit reason).
 *   2. Reverts fixture 2 to the real 6-0 (forfeit_note cleared).
 *   3. Deletes the forfeit balance created by fixture 1 so it can never be
 *      re-applied by the reset/reinstatement logic.
 *   4. Syncs the result_confirmations rows to the corrected scores (the public
 *      fixture page renders them).
 *   5. Rebuilds CAF Confederations League group standings from scratch (the
 *      UPDATE trigger is additive, so the full recalculateStandings rebuild is
 *      authoritative).
 *
 * abandon_count: nothing to undo here. Both fixtures are round_type='group' and
 * the live update_standings_after_result() trigger returns from the group branch
 * BEFORE its abandon_count block, so the forfeit never incremented it
 * (Leicesterford City is still 0).
 *
 * Run: npx tsx scripts/fix-leicesterford-forfeit-revert.ts
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

const TOURNAMENT_ID = '81f77443-f442-4a5f-b7b8-6fabac3f92d8' // CAF Confederations League
const UPINGTON_FIXTURE = 'f6aff5a1-3473-4893-918d-17652e015156' // Leicesterford City vs Upington City (0-6 forfeit -> real 0-3)
const ORBIT_FIXTURE = '28cbcc6d-aa7e-4c5c-819c-a438941115c2' // Leicesterford City vs Orbit College (6-6 -> real 6-0)
const FORFEIT_BALANCE_ID = '3a2e48df-75b4-4b65-b8f8-5854ac0e258c' // 6-goal carry-over for the Leicesterford manager
const LEICESTERFORD_TEAM_ID = '1943b538-a415-43cb-bf7f-4b76c0dd7666'

// Real scores after the revert. Fixture 1: the 0-3 the away manager submitted,
// with the forfeit's +3 bonus removed. Fixture 2: the genuine 6-0 home win.
const UPINGTON_HOME = 0 // Leicesterford City
const UPINGTON_AWAY = 3 // Upington City
const ORBIT_HOME = 6 // Leicesterford City
const ORBIT_AWAY = 0 // Orbit College

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // 1. Revert the mistaken forfeit to the plain submitted result.
  const { data: upington, error: upingtonErr } = await supabase
    .from('results')
    .update({
      home_score: UPINGTON_HOME,
      away_score: UPINGTON_AWAY,
      is_abandoned: false,
      abandoned_type: null,
      override_reason: null,
    })
    .eq('fixture_id', UPINGTON_FIXTURE)
    .select('id, home_score, away_score, is_abandoned, abandoned_type, override_reason')
    .maybeSingle()
  if (upingtonErr || !upington) {
    throw new Error(`Upington City revert failed: ${upingtonErr?.message ?? 'no row'}`)
  }

  // 2. Revert the carry-over-affected score back to the real result.
  const { data: orbit, error: orbitErr } = await supabase
    .from('results')
    .update({
      home_score: ORBIT_HOME,
      away_score: ORBIT_AWAY,
      override_reason: null,
    })
    .eq('fixture_id', ORBIT_FIXTURE)
    .select('id, home_score, away_score, is_abandoned, override_reason')
    .maybeSingle()
  if (orbitErr || !orbit) {
    throw new Error(`Orbit College revert failed: ${orbitErr?.message ?? 'no row'}`)
  }

  // 3. Remove the forfeit balance created from the mistaken forfeit.
  const { error: delErr } = await supabase
    .from('forfeit_balances')
    .delete()
    .eq('id', FORFEIT_BALANCE_ID)
  if (delErr) throw new Error(`forfeit balance delete failed: ${delErr.message}`)

  // 4. Keep the confirmation rows (shown on the fixture page) in step with the
  //    corrected results.
  const { error: conf1Err } = await supabase
    .from('result_confirmations')
    .update({ home_score: UPINGTON_HOME, away_score: UPINGTON_AWAY })
    .eq('fixture_id', UPINGTON_FIXTURE)
  if (conf1Err) throw new Error(`confirmation sync (fixture 1) failed: ${conf1Err.message}`)
  const { error: conf2Err } = await supabase
    .from('result_confirmations')
    .update({ home_score: ORBIT_HOME, away_score: ORBIT_AWAY })
    .eq('fixture_id', ORBIT_FIXTURE)
  if (conf2Err) throw new Error(`confirmation sync (fixture 2) failed: ${conf2Err.message}`)

  // 5. Rebuild standings (UPDATE trigger is additive; full rebuild is authoritative).
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const recalcSummary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', recalcSummary)

  // 6. Verify final state.
  const { data: upingtonCheck } = await supabase
    .from('results')
    .select('home_score, away_score, is_abandoned, abandoned_type, override_reason')
    .eq('fixture_id', UPINGTON_FIXTURE)
    .maybeSingle()
  const { data: orbitCheck } = await supabase
    .from('results')
    .select('home_score, away_score, override_reason')
    .eq('fixture_id', ORBIT_FIXTURE)
    .maybeSingle()
  const { data: balanceCheck } = await supabase
    .from('forfeit_balances')
    .select('id')
    .eq('id', FORFEIT_BALANCE_ID)
    .maybeSingle()
  const { data: confCheck } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score')
    .in('fixture_id', [UPINGTON_FIXTURE, ORBIT_FIXTURE])
  const { data: teamCheck } = await supabase
    .from('teams')
    .select('name, abandon_count')
    .eq('id', LEICESTERFORD_TEAM_ID)
    .maybeSingle()
  const { data: groupCheck } = await supabase
    .from('group_standings')
    .select('group_name, team_id, played, wins, draws, losses, goals_for, goals_against, points, absent, gd_penalty, team:teams!group_standings_team_id_fkey(name)')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('group_name', 'B')

  console.log('\n--- verify ---')
  console.log(
    'Leicesterford City vs Upington City:',
    `${upingtonCheck?.home_score}-${upingtonCheck?.away_score}`,
    'abandoned:', upingtonCheck?.is_abandoned, upingtonCheck?.abandoned_type ?? '(none)',
    'reason:', upingtonCheck?.override_reason ?? '(none)'
  )
  console.log(
    'Leicesterford City vs Orbit College:',
    `${orbitCheck?.home_score}-${orbitCheck?.away_score}`,
    'reason:', orbitCheck?.override_reason ?? '(none)'
  )
  console.log('forfeit balance row:', balanceCheck ? 'STILL PRESENT' : 'deleted')
  console.log('confirmations:', JSON.stringify(confCheck))
  console.log('Leicesterford City abandon_count:', teamCheck?.abandon_count)
  console.log('\nGroup B standings:')
  for (const row of (groupCheck ?? []) as any[]) {
    const net = Number(row.goals_for) - Number(row.goals_against)
    console.log(
      `  ${row.team?.name ?? row.team_id}: P${row.played} W${row.wins} D${row.draws} L${row.losses}`,
      `${row.goals_for}-${row.goals_against} (${net >= 0 ? '+' : ''}${net})`,
      `${row.points}pts absent ${row.absent} gdpen ${row.gd_penalty}`
    )
  }

  const ok =
    upingtonCheck?.home_score === UPINGTON_HOME &&
    upingtonCheck?.away_score === UPINGTON_AWAY &&
    upingtonCheck?.is_abandoned === false &&
    !upingtonCheck?.abandoned_type &&
    !upingtonCheck?.override_reason &&
    orbitCheck?.home_score === ORBIT_HOME &&
    orbitCheck?.away_score === ORBIT_AWAY &&
    !orbitCheck?.override_reason &&
    !balanceCheck &&
    (confCheck ?? []).every((c: any) =>
      c.fixture_id === UPINGTON_FIXTURE
        ? c.home_score === UPINGTON_HOME && c.away_score === UPINGTON_AWAY
        : c.home_score === ORBIT_HOME && c.away_score === ORBIT_AWAY
    ) &&
    teamCheck?.abandon_count === 0
  if (!ok) throw new Error('Verification FAILED — see output above')
  console.log('\nRepair complete and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
