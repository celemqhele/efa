/**
 * One-off script to overturn the backdoor submission for Kaizer Chiefs vs Gomora United
 * Fixture: 5932e368-8509-49ae-9033-f433343a3c51
 * Submission: 81345270-78c9-4fdf-a653-de643511c917 (Away submitter 27697333125 / ozilotf)
 * Action:
 *   - delete results, match_stats, result_confirmations for the fixture
 *   - update backdoor_submission status to 'declined'
 *   - update fixture status to 'scheduled'
 *   - recalculate standings for tournament 5a267e10-0edd-42f0-8f04-b28ec40713f8
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

const FIXTURE_ID = '5932e368-8509-49ae-9033-f433343a3c51'
const SUBMISSION_ID = '81345270-78c9-4fdf-a653-de643511c917'
const TOURNAMENT_ID = '5a267e10-0edd-42f0-8f04-b28ec40713f8' // Motsepe Foundation Championship

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('[overturn] fixture:', FIXTURE_ID)

  // 1. Get result ID for fixture
  const { data: results } = await supabase
    .from('results')
    .select('id')
    .eq('fixture_id', FIXTURE_ID)
  const resultIds = (results ?? []).map((r) => r.id)
  console.log(`[overturn] ${resultIds.length} result row(s) to delete`)

  if (resultIds.length > 0) {
    const { error: msErr } = await supabase
      .from('match_stats')
      .delete()
      .in('result_id', resultIds)
    if (msErr) throw new Error(`match_stats delete failed: ${msErr.message}`)
    console.log('[overturn] match_stats cleared')

    const { error: resErr } = await supabase
      .from('results')
      .delete()
      .eq('fixture_id', FIXTURE_ID)
    if (resErr) throw new Error(`results delete failed: ${resErr.message}`)
    console.log('[overturn] results deleted')
  }

  // 2. Delete result_confirmations
  const { error: rcErr } = await supabase
    .from('result_confirmations')
    .delete()
    .eq('fixture_id', FIXTURE_ID)
  if (rcErr) throw new Error(`result_confirmations delete failed: ${rcErr.message}`)
  console.log('[overturn] result_confirmations deleted')

  // 3. Update backdoor_submission to declined
  const { error: subErr } = await supabase
    .from('backdoor_submissions')
    .update({ status: 'declined', reviewed_at: new Date().toISOString() })
    .eq('id', SUBMISSION_ID)
  if (subErr) throw new Error(`backdoor_submissions update failed: ${subErr.message}`)
  console.log('[overturn] backdoor_submission -> declined')

  // 4. Update fixture status to scheduled
  const { error: fxErr } = await supabase
    .from('fixtures')
    .update({ status: 'scheduled' })
    .eq('id', FIXTURE_ID)
  if (fxErr) throw new Error(`fixtures update failed: ${fxErr.message}`)
  console.log('[overturn] fixture -> scheduled')

  // 5. Recalculate standings
  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const summary = await recalc(TOURNAMENT_ID)
  console.log('[overturn] recalculateStandings:', summary)

  // 6. Verify
  const { data: vf } = await supabase
    .from('fixtures')
    .select('id, status')
    .eq('id', FIXTURE_ID)
    .single()
  const { data: vr } = await supabase
    .from('results')
    .select('id')
    .eq('fixture_id', FIXTURE_ID)
    .maybeSingle()
  const { data: sub } = await supabase
    .from('backdoor_submissions')
    .select('id, status')
    .eq('id', SUBMISSION_ID)
    .single()

  const ok = vf?.status === 'scheduled' && !vr && sub?.status === 'declined'
  console.log(
    `${ok ? 'OK ' : 'FAIL'} fixture_status=${vf?.status} result=${vr ? 'STALE!' : 'none'} submission_status=${sub?.status}`
  )
  if (!ok) throw new Error('Verification FAILED')

  console.log('\nDone — backdoor overturned and submission declined successfully.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
