/**
 * One-off: apply backdoor override in favour of TUT FC
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

try { loadEnvFile('.env.local') } catch {}
try { loadEnvFile('.env.supabase') } catch {}

const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!url) {
if (!url || !key || key.length < 10) {
  if (m) url = " https://\ + m[1] + \.supabase.co\
  if (m) url = " https://\ + m[1] + \.supabase.co\
}
process.env.NEXT_PUBLIC_SUPABASE_URL = url

const ADMIN_ID = '87d8afba-296d-4512-9811-3d32a76eb37a'
const FIXTURE_ID = '86587fcd-90c3-4a0f-8fa8-399eeb9698fb'
const TOURNAMENT_ID = '18d4f540-0246-42ae-8699-64d13d0a2ae7'
const HOME_SCORE = 3
const AWAY_SCORE = 0
const OVERRIDE_REASON = 'backdoor override'

const supabase = createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  const { data: fixture, error: fetchError } = await supabase
    .from('fixtures')
    .select(
      id, status, tournament_id, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    )
    .eq('id', FIXTURE_ID)
    .single()
  if (fetchError || !fixture) throw new Error('Fixture not found')
  const homeTeam: any = (fixture as any).home_team
  const awayTeam: any = (fixture as any).away_team

  const { data: result, error: resultError } = await supabase
    .from('results')
    .upsert({ fixture_id: FIXTURE_ID, home_score: HOME_SCORE, away_score: AWAY_SCORE, submitted_by: ADMIN_ID, override_reason: OVERRIDE_REASON }, { onConflict: 'fixture_id' })
    .select()
    .single()
  if (resultError) throw new Error(resultError.message)

  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', FIXTURE_ID)
  await supabase.from('backdoor_submissions').update({ status: 'voided', reviewed_by: ADMIN_ID, reviewed_at: new Date().toISOString() }).eq('fixture_id', FIXTURE_ID).in('status', ['pending', 'submitted'])

  const mids: string[] = []
  if (homeTeam?.manager_id) mids.push(homeTeam.manager_id)
  if (awayTeam?.manager_id) mids.push(awayTeam.manager_id)
  for (const mid of mids) {
    await supabase.from('notifications').insert({ user_id: mid, title: 'Backdoor result applied', body: ${homeTeam?.name} -  (admin backdoor override), type: 'result', data: { fixture_id: FIXTURE_ID, result_id: (result as any).id } })
  }
  await supabase.from('audit_log').insert({ admin_id: ADMIN_ID, action: 'finalise_result', target_type: 'fixture', target_id: FIXTURE_ID, details: { home_score: HOME_SCORE, away_score: AWAY_SCORE, override: true, override_reason: OVERRIDE_REASON } })

  try {
    const mod = await import('./standings-engine')
    if ((mod as any).recalculateStandings) await (mod as any).recalculateStandings(TOURNAMENT_ID)
  } catch (e) {}
  console.log('done')
}

main().catch(e => { console.error(e); process.exit(1) })



