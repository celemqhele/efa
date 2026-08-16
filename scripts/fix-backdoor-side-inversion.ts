/**
 * One-off: correct the 5 fixtures whose backdoor results were applied to the
 * WRONG side due to the side_claimed inversion bug in the backdoor approval
 * paths (web review page + WhatsApp admin decision awarded the 3-0 to the
 * non-responding team instead of the reporter).
 *
 * side_claimed means "who is NOT responding" (the absent side), so the 3-0
 * backdoor win belongs to the OPPOSITE team.
 *
 * Fixtures corrected:
 *   UCL (7174e29f-64c7-4f77-97f2-0fefe15d7e35):
 *     09248200  Al Ettifaq 3-0 Al Hilal   -> Al Ettifaq 0-3 Al Hilal
 *     035b51e8  Al Hilal 0-3 Al Ettifaq   -> Al Hilal 3-0 Al Ettifaq
 *     c67764d7  Burnley 0-3 Barcelona     -> Burnley 3-0 Barcelona
 *     0682a030  Barcelona 0-3 Burnley     -> Barcelona 3-0 Burnley
 *   UEL (80e86b39-1314-403d-ad91-ff7666fdde80):
 *     0766556f  Bayer Leverkusen 0-3 Al Khaleej -> Bayer Leverkusen 3-0 Al Khaleej
 *
 * Per fixture (override path, mirrors handleBackdoorSide with isOverride):
 *   - inserts a result_confirmations row
 *   - upserts the result with override_reason 'backdoor override'
 *   - keeps the fixture confirmed
 *   - voids pending backdoor_submissions
 *   - notifies both managers
 *   - writes an audit_log finalise_result entry
 * Then recalculates standings for both tournaments.
 *
 * Run: npx tsx scripts/fix-backdoor-side-inversion.ts
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

// fixture_id -> { home_score, away_score, home_absent, away_absent }
const FIXES: Record<string, { home_score: number; away_score: number; home_absent: boolean; away_absent: boolean }> = {
  '09248200-6e9e-40ca-9c39-5504aae48585': { home_score: 0, away_score: 3, home_absent: true, away_absent: false },   // Al Ettifaq absent -> Al Hilal win
  '035b51e8-356f-4ecd-8a8e-a22f45e54286': { home_score: 3, away_score: 0, home_absent: false, away_absent: true },  // Al Ettifaq absent -> Al Hilal win
  'c67764d7-ea0e-4edd-9824-b78548930449': { home_score: 3, away_score: 0, home_absent: false, away_absent: true },  // Barcelona absent -> Burnley win
  '0682a030-5e9f-4634-80b3-a62b0c8c1d96': { home_score: 3, away_score: 0, home_absent: false, away_absent: true },  // Burnley absent -> Barcelona win
  '0766556f-a2e5-44ac-b0e1-fe5c6a987317': { home_score: 3, away_score: 0, home_absent: false, away_absent: true },  // Al Khaleej absent -> Leverkusen win
}

const TOURNAMENTS = [
  '7174e29f-64c7-4f77-97f2-0fefe15d7e35', // EFA Champions League (Season 3)
  '80e86b39-1314-403d-ad91-ff7666fdde80', // EFA Europa League (Season 3)
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const fixtureIds = Object.keys(FIXES)

  const { data: fixtures, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, tournament_id, matchday, round_type,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .in('id', fixtureIds)

  if (fetchError || !fixtures) {
    throw new Error(`Fixture fetch failed: ${fetchError?.message}`)
  }

  for (const raw of fixtures) {
    const fixture = raw as any
    const fix = FIXES[fixture.id]
    const home = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
    const away = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
    const label = `${home?.name ?? 'Home'} ${fix.home_score}-${fix.away_score} ${away?.name ?? 'Away'}`
    console.log(`[${fixture.id}] ${label} (status: ${fixture.status})`)

    const { data: existing } = await supabase
      .from('results')
      .select('home_score, away_score, override_reason')
      .eq('fixture_id', fixture.id)
      .maybeSingle()

    if (fixture.status !== 'confirmed' || !existing) {
      throw new Error(`Fixture ${fixture.id} is ${fixture.status} / no existing result — expected confirmed override.`)
    }

    await supabase.from('result_confirmations').insert({
      fixture_id: fixture.id,
      home_score: fix.home_score,
      away_score: fix.away_score,
      submitted_by: ADMIN_ID,
    })

    const { data: result, error: resultError } = await supabase
      .from('results')
      .upsert(
        {
          fixture_id: fixture.id,
          home_score: fix.home_score,
          away_score: fix.away_score,
          is_abandoned: false,
          finalised_by: ADMIN_ID,
          override_reason: 'backdoor override',
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
        home_score: String(fix.home_score),
        away_score: String(fix.away_score),
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
        home_score: fix.home_score,
        away_score: fix.away_score,
        result_id: result.id,
        home_absent: fix.home_absent,
        away_absent: fix.away_absent,
        override: true,
        note: 'side_claimed inversion correction — backdoor win awarded to reporting (present) team',
      },
    })
    if (auditError) console.error('Audit log insert failed:', auditError.message)

    console.log(`  result ${result.id} saved (override), fixture confirmed, ${notificationRows.length} notification(s), audit written.`)
  }

  for (const tournamentId of TOURNAMENTS) {
    console.log(`\nRecalculating standings for ${tournamentId}...`)
    const engine = await import('../lib/standings-engine.ts')
    const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
    if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
    const summary = await recalc(tournamentId)
    console.log('recalculateStandings:', summary)
  }

  console.log('\n--- verify ---')
  for (const fixtureId of fixtureIds) {
    const fix = FIXES[fixtureId]
    const { data: vf } = await supabase
      .from('fixtures')
      .select('id, status')
      .eq('id', fixtureId)
      .single()
    const { data: vr } = await supabase
      .from('results')
      .select('home_score, away_score, override_reason')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    const ok = vf?.status === 'confirmed' &&
      vr?.home_score === fix.home_score &&
      vr?.away_score === fix.away_score &&
      vr?.override_reason === 'backdoor override'
    console.log(`${ok ? 'OK ' : 'FAIL'} ${fixtureId} ${vr?.home_score}-${vr?.away_score} (status: ${vf?.status}, override_reason: ${vr?.override_reason})`)
    if (!ok) throw new Error(`Verification FAILED for ${fixtureId}`)
  }

  console.log('\nDone — all backdoor side-inversion fixtures corrected and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
