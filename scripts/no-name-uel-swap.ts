/**
 * One-off: replace Barcelona with a placeholder "No Name" club in the
 * EFA Europa League (Season 3) and award 3-0 wins to all opponents.
 *
 * Scope is STRICTLY the UEL tournament (80e86b39-1314-403d-ad91-ff7666fdde80).
 * Barcelona remains in the UCL and EFA Premier League untouched.
 *
 * Per fixture:
 *   - swaps home/away team id to the new No Name team
 *   - upserts the result (opponent wins 3-0, plain — no absent/forfeit flags)
 *     (on_result_insert trigger confirms the fixture + updates group_standings)
 *   - syncs result_confirmations scores
 *   - clears stale notifications for the fixture and inserts a fresh
 *     result_confirmed notification for the opponent's manager
 * Then recalculates group standings for the whole UEL tournament.
 *
 * Run: npx tsx scripts/no-name-uel-swap.ts
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
const UEL_ID = '80e86b39-1314-403d-ad91-ff7666fdde80' // EFA Europa League (Season 3)
const BARCELONA_ID = '1d70ba4a-35a9-4153-9305-1d215d7635f0'
const UCL_ID = '7174e29f-64c7-4f77-97f2-0fefe15d7e35' // EFA Champions League (Season 3)
const PARTICIPANT_ID = 'f6b6aebc-23c8-4c69-a7bb-bc6e05601d61' // UEL participant row (Barcelona, Group B)

// Final awarded scores, written after the swap (home_team vs away_team).
const FIXTURES = [
  { id: 'c89f4869-59e6-498e-ad20-5d43307f6020', home_score: 3, away_score: 0 }, // Bayer Leverkusen 3-0 No Name (was 3-0)
  { id: 'b01f0d96-049c-410a-9dc8-683bd19172c1', home_score: 0, away_score: 3 }, // No Name 0-3 Real Betis (was Barcelona 3-0)
  { id: '3ab0098c-a472-446f-96f2-654fc7233b89', home_score: 3, away_score: 0 }, // Al Khaleej 3-0 No Name (was 1-7)
  { id: '26cc1021-06c3-4990-b78e-15cd040e439f', home_score: 3, away_score: 0 }, // Real Madrid 3-0 No Name
  { id: '93b7a224-0c6d-4007-ac40-314ca0a427ff', home_score: 0, away_score: 3 }, // No Name 0-3 Real Madrid
  { id: 'c70a0b95-ee69-4615-86fe-cda30e7d45a1', home_score: 0, away_score: 3 }, // No Name 0-3 Bayer Leverkusen
  { id: '166b977d-9d5f-4401-ae8b-9c25add37d69', home_score: 0, away_score: 3 }, // No Name 0-3 Al Khaleej
  { id: 'df826bb0-c176-4c3a-a53f-73455fa56ecc', home_score: 3, away_score: 0 }, // Real Betis 3-0 No Name
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // ---- 1. Create (or reuse) the No Name placeholder team ----
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('name', 'No Name')
    .maybeSingle()

  let noNameId = existing?.id ?? null
  if (!noNameId) {
    const { data: created, error: createErr } = await supabase
      .from('teams')
      .insert({
        name: 'No Name',
        logo_league_folder: 'custom',
        logo_team_slug: 'noname',
      })
      .select('id')
      .single()
    if (createErr || !created) throw new Error(`Team create failed: ${createErr?.message}`)
    noNameId = created.id
    console.log(`[team] created No Name (${noNameId})`)
  } else {
    console.log(`[team] reusing existing No Name (${noNameId})`)
  }

  // ---- 2. Swap participant + fixtures in the UEL tournament only ----
  const { error: partErr } = await supabase
    .from('tournament_participants')
    .update({ team_id: noNameId })
    .eq('id', PARTICIPANT_ID)
  if (partErr) throw new Error(`Participant swap failed: ${partErr.message}`)

  const { data: swappedHome, error: homeErr } = await supabase
    .from('fixtures')
    .update({ home_team_id: noNameId })
    .eq('tournament_id', UEL_ID)
    .eq('home_team_id', BARCELONA_ID)
    .select('id')
  if (homeErr) throw new Error(`Fixture home swap failed: ${homeErr.message}`)

  const { data: swappedAway, error: awayErr } = await supabase
    .from('fixtures')
    .update({ away_team_id: noNameId })
    .eq('tournament_id', UEL_ID)
    .eq('away_team_id', BARCELONA_ID)
    .select('id')
  if (awayErr) throw new Error(`Fixture away swap failed: ${awayErr.message}`)

  console.log(`[swap] participant updated; fixtures swapped: home=${swappedHome?.length ?? 0}, away=${swappedAway?.length ?? 0}`)

  // ---- 3. Award 3-0 wins (plain results) + notifications ----
  for (const fx of FIXTURES) {
    const { data: fixture, error: fetchError } = await supabase
      .from('fixtures')
      .select(`
        id, status, tournament_id,
        home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
        away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
      `)
      .eq('id', fx.id)
      .single()
    if (fetchError || !fixture) throw new Error(`Fixture not found: ${fx.id}`)

    const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
    const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
    const label = `${home?.name ?? 'Home'} ${fx.home_score}-${fx.away_score} ${away?.name ?? 'Away'}`
    console.log(`[${fx.id}] ${label} (status: ${fixture.status})`)

    // Idempotent guard: skip if already applied with matching score.
    const { data: existingResult } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', fx.id)
      .maybeSingle()
    const alreadyApplied = fixture.status === 'confirmed' &&
      existingResult?.home_score === fx.home_score &&
      existingResult?.away_score === fx.away_score
    if (alreadyApplied) {
      console.log('  already applied — skipping.')
      continue
    }

    const { data: result, error: resultError } = await supabase
      .from('results')
      .upsert(
        {
          fixture_id: fx.id,
          home_score: fx.home_score,
          away_score: fx.away_score,
          is_abandoned: false,
          finalised_by: ADMIN_ID,
        },
        { onConflict: 'fixture_id' }
      )
      .select('id')
      .single()
    if (resultError || !result) throw new Error(`Result upsert failed for ${fx.id}: ${resultError?.message}`)

    await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fx.id)

    // Sync any existing result confirmations to the awarded score.
    await supabase
      .from('result_confirmations')
      .update({ home_score: fx.home_score, away_score: fx.away_score })
      .eq('fixture_id', fx.id)

    // Stale notifications: drop old result/backdoor notes for this fixture,
    // then notify the opponent's manager of the awarded 3-0.
    await supabase
      .from('notifications')
      .delete()
      .eq('data->>fixture_id', fx.id)
      .in('type', ['result_confirmed', 'backdoor_submitted', 'backdoor_approved'])

    const opponentManager = home?.manager_id && home?.id !== noNameId ? home.manager_id : away?.manager_id
    if (opponentManager) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: opponentManager,
        type: 'result_confirmed',
        title: 'Result Confirmed',
        body: label,
        data: {
          fixture_id: fx.id,
          home_score: String(fx.home_score),
          away_score: String(fx.away_score),
        },
      })
      if (notifError) console.error('Notification insert failed:', notifError.message)
    }

    const { error: auditError } = await supabase.from('audit_log').insert({
      admin_id: ADMIN_ID,
      action: 'finalise_result',
      target_type: 'fixture',
      target_id: fx.id,
      details: {
        home_score: fx.home_score,
        away_score: fx.away_score,
        result_id: result.id,
        note: 'UEL No Name replacement — awarded opponent win',
      },
    })
    if (auditError) console.error('Audit log insert failed:', auditError.message)

    console.log(`  result saved, fixture confirmed, confirmations synced, notification sent.`)
  }

  // ---- 4. Recalculate the whole UEL standings table ----
  console.log('\nRecalculating standings for EFA Europa League...')
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const summary = await recalc(UEL_ID)
  console.log('recalculateStandings:', summary)

  // ---- 5. Verify ----
  console.log('\n--- verify ---')
  const { count: uelNoName } = await supabase
    .from('fixtures')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', UEL_ID)
    .or(`home_team_id.eq.${noNameId},away_team_id.eq.${noNameId}`)
  const { count: uelBarca } = await supabase
    .from('fixtures')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', UEL_ID)
    .or(`home_team_id.eq.${BARCELONA_ID},away_team_id.eq.${BARCELONA_ID}`)
  const { count: uclBarca } = await supabase
    .from('fixtures')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', UCL_ID)
    .or(`home_team_id.eq.${BARCELONA_ID},away_team_id.eq.${BARCELONA_ID}`)

  console.log(`UEL fixtures with No Name: ${uelNoName} (expect 8)`)
  console.log(`UEL fixtures with Barcelona: ${uelBarca} (expect 0)`)
  console.log(`UCL fixtures with Barcelona: ${uclBarca} (expect 6 — untouched)`)

  if (uelNoName !== 8 || uelBarca !== 0) {
    throw new Error('Verification FAILED: UEL fixture swap is wrong')
  }

  for (const fx of FIXTURES) {
    const { data: f } = await supabase
      .from('fixtures')
      .select('id, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
      .eq('id', fx.id)
      .single()
    const { data: r } = await supabase
      .from('results')
      .select('home_score, away_score')
      .eq('fixture_id', fx.id)
      .maybeSingle()
    const h = Array.isArray(f?.home_team) ? f?.home_team[0]?.name : f?.home_team?.name
    const a = Array.isArray(f?.away_team) ? f?.away_team[0]?.name : f?.away_team?.name
    const ok = f?.status === 'confirmed' && r && r.home_score === fx.home_score && r.away_score === fx.away_score
    console.log(`${ok ? 'OK ' : 'FAIL'} ${h} ${r?.home_score ?? '-'}-${r?.away_score ?? '-'} ${a} (status: ${f?.status})`)
    if (!ok) throw new Error(`Verification FAILED for ${fx.id}`)
  }

  console.log('\nDone — Barcelona replaced by No Name in UEL, all 8 opponents awarded 3-0 wins, standings recalculated.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
