/**
 * One-off: submit the result for Al Ettifaq (home) 3 – 2 Nantes (away),
 * fixture 04bed437-0998-456f-8c3c-641e19c007bb (EFA Champions League MD11, Group B).
 *
 * Mirrors the admin finalise-result flow but standalone (no auth session needed):
 * - upserts the result (the on_result_insert trigger updates group standings,
 *   sets the fixture to 'confirmed' and scores predictions)
 * - voids pending backdoor submissions for the fixture
 * - notifies both team managers in-app
 * - writes an audit_log entry
 *
 * Run: npx tsx scripts/submit-al-ettifaq-nantes-result.ts
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

const FIXTURE_ID = '04bed437-0998-456f-8c3c-641e19c007bb'
const HOME_SCORE = 3
const AWAY_SCORE = 2
const ADMIN_ID = '87d8afba-296d-4512-9811-3d32a76eb37a' // celemqhele

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: fixture, error: fetchError } = await supabase
    .from('fixtures')
    .select(`
      id, status, tournament_id,
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

  if (fixture.status === 'confirmed') {
    console.error(`Fixture ${FIXTURE_ID} is already confirmed — aborting.`)
    process.exit(1)
  }

  console.log(
    `Submitting result: ${home?.name ?? 'Home'} ${HOME_SCORE}–${AWAY_SCORE} ${away?.name ?? 'Away'} (status: ${fixture.status})`
  )

  const { data: result, error: resultError } = await supabase
    .from('results')
    .upsert(
      {
        fixture_id: FIXTURE_ID,
        home_score: HOME_SCORE,
        away_score: AWAY_SCORE,
        is_abandoned: false,
        finalised_by: ADMIN_ID,
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()

  if (resultError || !result) {
    throw new Error(`Result upsert failed: ${resultError?.message}`)
  }
  console.log(`Result saved (id: ${result.id}).`)

  const { data: updatedFixture, error: statusError } = await supabase
    .from('fixtures')
    .select('status')
    .eq('id', FIXTURE_ID)
    .single()
  if (statusError || updatedFixture?.status !== 'confirmed') {
    console.error('[submit-result] fixture not confirmed after result upsert, status:', updatedFixture?.status)
  } else {
    console.log('Fixture status confirmed.')
  }

  await supabase
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', FIXTURE_ID)
    .eq('status', 'pending')

  const managerIds = [home?.manager_id, away?.manager_id].filter((v): v is string => !!v)
  const body = `${home?.name ?? 'Home'} ${HOME_SCORE}–${AWAY_SCORE} ${away?.name ?? 'Away'}`
  const notificationRows = managerIds.map((uid) => ({
    user_id: uid,
    type: 'result_confirmed',
    title: 'Result Confirmed',
    body,
    data: {
      fixture_id: FIXTURE_ID,
      home_score: String(HOME_SCORE),
      away_score: String(AWAY_SCORE),
    },
  }))
  if (notificationRows.length > 0) {
    const { error: notifError } = await supabase.from('notifications').insert(notificationRows)
    if (notifError) console.error('Notification insert failed:', notifError.message)
  }
  console.log(`Notifications queued for ${notificationRows.length} manager(s).`)

  const { error: auditError } = await supabase.from('audit_log').insert({
    admin_id: ADMIN_ID,
    action: 'finalise_result',
    target_type: 'fixture',
    target_id: FIXTURE_ID,
    details: {
      home_score: HOME_SCORE,
      away_score: AWAY_SCORE,
      result_id: result.id,
      home_absent: false,
      away_absent: false,
    },
  })
  if (auditError) console.error('Audit log insert failed:', auditError.message)
  else console.log('Audit log written.')

  console.log('Done.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
