/**
 * One-off: void the stale pending backdoor submission for Belgium vs USA
 * (fixture 965d33c3) now that the real match result has been played.
 *
 * Context: the admin reverted the 30 Aug backdoor approvals for this fixture
 * (see .opencode/context/backdoor/backdoor-approval-revert_2026-08-30.md), which
 * left the submission back at 'pending'. The match was then played for real via
 * the WhatsApp result path (1-2, fixture confirmed), but that path did not void
 * pending backdoor submissions — so this one stayed 'pending' reviewable.
 *
 * This script marks it 'void_game_played' so it can no longer be approved.
 *
 * Run: npx tsx scripts/void-backdoor-belgium-usa-30aug.ts
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

const FIXTURE_ID = '965d33c3-6c46-4d33-9569-8e8b753e735b' // Belgium v USA

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[void] fixture: ${FIXTURE_ID}`)

  const { data: fixture } = await supabase
    .from('fixtures')
    .select('status')
    .eq('id', FIXTURE_ID)
    .single()
  console.log(`[void] fixture status: ${fixture?.status}`)

  const { data: result } = await supabase
    .from('results')
    .select('home_score, away_score')
    .eq('fixture_id', FIXTURE_ID)
    .maybeSingle()
  console.log(`[void] real result: ${result ? `${result.home_score}-${result.away_score}` : 'none'}`)

  const { data: before } = await supabase
    .from('backdoor_submissions')
    .select('id, status')
    .eq('fixture_id', FIXTURE_ID)
  console.log(`[void] before: ${(before ?? []).map((s) => `${s.id}=${s.status}`).join(', ')}`)

  const { error } = await supabase
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', FIXTURE_ID)
    .eq('status', 'pending')
  if (error) throw new Error(`void update failed: ${error.message}`)

  const { data: after } = await supabase
    .from('backdoor_submissions')
    .select('id, status')
    .eq('fixture_id', FIXTURE_ID)
    .eq('status', 'pending')

  const { data: voided } = await supabase
    .from('backdoor_submissions')
    .select('id, status')
    .eq('fixture_id', FIXTURE_ID)
    .eq('status', 'void_game_played')

  console.log(`[void] remaining pending: ${(after ?? []).length}`)
  console.log(`[void] voided: ${(voided ?? []).map((s) => `${s.id}=${s.status}`).join(', ')}`)

  const ok = fixture?.status === 'confirmed' && !!result && (after ?? []).length === 0 && (voided ?? []).length > 0
  if (!ok) throw new Error('Verification FAILED')

  console.log('\nDone — Belgium vs USA pending backdoor voided and verified.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
