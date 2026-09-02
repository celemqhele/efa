/**
 * One-off: revert backdoor approvals made by the admin on 30 Aug 2026.
 *
 * For each fixture:
 *   - puts the approved backdoor_submissions back to 'pending' (clears reviewed_by / reviewed_at)
 *   - deletes the result / result_confirmations / match_stats written by the approvals
 *   - returns the fixture to 'scheduled'
 * Then recalculates standings for the EFA International Cup.
 *
 * Fixtures reverted (all EFA International Cup 'e2c61a3e-072e-4a07-8024-76de20c2a99a'):
 *   965d33c3  Belgium v USA     0-3 (approved 19:29)
 *   cb7d5f66  Brazil  v Algeria 3-0 (approved 19:16)
 *   5234a927  Egypt   v Norway  3-0 (submissions approved 19:15, result overwritten by
 *                                   finalise-result to 'Norway absent - forfeit (3-0)' at 19:17)
 *
 * Run: npx tsx scripts/revert-backdoor-approvals-30aug.ts
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

const FIXTURE_IDS = [
  '965d33c3-6c46-4d33-9569-8e8b753e735b', // Belgium v USA
  'cb7d5f66-be9a-4278-b278-31d6a7206061', // Brazil v Algeria
  '5234a927-d92b-41b5-b1e6-2f75df5c5bcc', // Egypt v Norway
]
const TOURNAMENT_ID = 'e2c61a3e-072e-4a07-8024-76de20c2a99a' // EFA International Cup

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('[revert] fixtures:', FIXTURE_IDS.join(', '))

  const { data: results } = await supabase
    .from('results')
    .select('id')
    .in('fixture_id', FIXTURE_IDS)
  const resultIds = (results ?? []).map((r) => r.id)
  console.log(`[revert] ${resultIds.length} result row(s) to delete`)

  if (resultIds.length > 0) {
    const { error: msErr } = await supabase
      .from('match_stats')
      .delete()
      .in('result_id', resultIds)
    if (msErr) throw new Error(`match_stats delete failed: ${msErr.message}`)
    console.log(`[revert] match_stats cleared for ${resultIds.length} result(s)`)

    const { error: resErr } = await supabase
      .from('results')
      .delete()
      .in('fixture_id', FIXTURE_IDS)
    if (resErr) throw new Error(`results delete failed: ${resErr.message}`)
    console.log('[revert] results deleted')
  }

  const { error: rcErr } = await supabase
    .from('result_confirmations')
    .delete()
    .in('fixture_id', FIXTURE_IDS)
  if (rcErr) throw new Error(`result_confirmations delete failed: ${rcErr.message}`)
  console.log('[revert] result_confirmations deleted')

  const { error: subErr } = await supabase
    .from('backdoor_submissions')
    .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
    .in('fixture_id', FIXTURE_IDS)
    .eq('status', 'approved')
  if (subErr) throw new Error(`backdoor_submissions update failed: ${subErr.message}`)

  const { data: revertedSubs } = await supabase
    .from('backdoor_submissions')
    .select('id, status, reviewed_by, reviewed_at')
    .in('fixture_id', FIXTURE_IDS)
  console.log(`[revert] backdoor_submissions -> pending (${revertedSubs?.length} row(s))`)

  const { error: fxErr } = await supabase
    .from('fixtures')
    .update({ status: 'scheduled' })
    .in('id', FIXTURE_IDS)
  if (fxErr) throw new Error(`fixtures update failed: ${fxErr.message}`)
  console.log('[revert] fixtures -> scheduled')

  const engine = await import('../lib/standings-engine.ts')
  const recalc = engine.default?.recalculateStandings ?? engine.recalculateStandings
  if (typeof recalc !== 'function') throw new Error('recalculateStandings not found')
  const summary = await recalc(TOURNAMENT_ID)
  console.log('[revert] recalculateStandings:', summary)

  console.log('\n--- verify ---')
  for (const fixtureId of FIXTURE_IDS) {
    const { data: vf } = await supabase
      .from('fixtures')
      .select('id, status')
      .eq('id', fixtureId)
      .single()
    const { data: vr } = await supabase
      .from('results')
      .select('id')
      .eq('fixture_id', fixtureId)
      .maybeSingle()
    const { data: subs } = await supabase
      .from('backdoor_submissions')
      .select('id, status')
      .in('fixture_id', [fixtureId])
    const allPending = (subs ?? []).every((s) => s.status === 'pending')
    const ok = vf?.status === 'scheduled' && !vr && (subs ?? []).length > 0 && allPending
    console.log(
      `${ok ? 'OK ' : 'FAIL'} ${fixtureId} status=${vf?.status} result=${vr ? 'STALE!' : 'none'} subs=${(subs ?? []).map((s) => s.status).join(',')}`
    )
    if (!ok) throw new Error(`Verification FAILED for ${fixtureId}`)
  }

  console.log('\nDone — backdoor approvals reverted and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})