/**
 * and award them the backdoor win instead.
 *
 * fixture claiming Real Madrid (home) not responding — which should have given
 *
 * Fixture: 86587fcd-90c3-4a0f-8fa8-399eeb9698fb (MD18, group stage)
 *
 * Mirrors the WhatsApp admin backdoor override flow (handleBackdoorSide with
 * isOverride=true) + the direct result-submit pattern.
 *
 * Run: npx tsx scripts/fix-betis-backdoor-win.ts
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
process.env.NEXT_PUBLIC_SUPABASE_URL = url
const ADMIN_ID = '87d8afba-296d-4512-9811-3d32a76eb37a' // celemqhele
const FIXTURE_ID = '86587fcd-90c3-4a0f-8fa8-399eeb9698fb'
const TOURNAMENT_ID = '18d4f540-0246-42ae-8699-64d13d0a2ae7' // Betway Premiership (Season 3)
const HOME_SCORE = 3
const AWAY_SCORE = 0
const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})
async function main() {
  const { data: fixture, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, tournament_id, matchday, round_type,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('id', FIXTURE_ID)
    .single()
  if (fetchError || !fixture) {
    throw new Error(`Fixture not found: ${fetchError?.message ?? FIXTURE_ID}`)
  }
  const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
  const label = `${home?.name ?? 'Home'} ${3}-${0} ${away?.name ?? 'Away'}`
  const { data: existing } = await supabase
    .from('results')
    .select('home_score, away_score, override_reason')
    .eq('fixture_id', FIXTURE_ID)
    .maybeSingle()
  console.log(`[${FIXTURE_ID}] ${label}`)
  console.log(`  current: ${fixture.status} — ${existing ? `result ${existing.home_score}-${existing.away_score}${existing.override_reason ? ` (${existing.override_reason})` : ''}` : 'NO RESULT'}`)
  if (fixture.status !== 'confirmed' || !existing) {
    throw new Error(`Expected a confirmed fixture with an existing result to override — got status '${fixture.status}' / result ${existing ? 'yes' : 'no'}.`)
  }
  await supabase.from('result_confirmations').insert({
    fixture_id: FIXTURE_ID,


    submitted_by: ADMIN_ID,
  })
  const { data: result, error: resultError } = await supabase
    .from('results')
    .upsert(
      {
        fixture_id: FIXTURE_ID,


        is_abandoned: false,
        finalised_by: ADMIN_ID,
        override_reason: 'backdoor override',
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()
  if (resultError || !result) {
    throw new Error(`Result upsert failed: ${resultError?.message}`)
  }
  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', FIXTURE_ID)
  await supabase
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', FIXTURE_ID)
    .eq('status', 'pending')
  const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
  const notificationRows = managerIds.map((uid) => ({
    user_id: uid,
    type: 'result_confirmed',
    title: 'Result Confirmed',
    body: label,
    data: {
      fixture_id: FIXTURE_ID,


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
    target_id: FIXTURE_ID,
    details: {


      result_id: result.id,
      home_absent: true,
      away_absent: false,
      override: true,
    },
  })
  if (auditError) console.error('Audit log insert failed:', auditError.message)
  console.log(`  result ${result.id} saved (override), fixture confirmed, ${notificationRows.length} notification(s), audit written.`)
  console.log('\nRecalculating standings for Betway Premiership...')
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const summary = await recalc(TOURNAMENT_ID)
  console.log('recalculateStandings:', summary)
  console.log('\n--- verify ---')
  const { data: vf } = await supabase
    .from('fixtures')
    .select('id, status')
    .eq('id', FIXTURE_ID)
    .single()
  const { data: vr } = await supabase
    .from('results')
    .select('home_score, away_score, override_reason')
    .eq('fixture_id', FIXTURE_ID)
    .maybeSingle()
  const ok = vf?.status === 'confirmed' &&
    vr?.home_score === 3 &&
    vr?.away_score === 0 &&
    vr?.override_reason === 'backdoor override'
  console.log(`${ok ? 'OK' : 'FAIL'} ${label} (status: ${vf?.status}, override_reason: ${vr?.override_reason})`)
  
  const { data: gs } = await supabase
    .from('group_standings')
    .select('group_name, played, wins, draws, losses, points')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('team_id', away?.id)
    .maybeSingle()
}
main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
}\n\nmain().catch(e=>{console.error(e?.message||e);process.exit(1)})\nmain().catch(e=>{console.error(e?.message||e);process.exit(1)})\n