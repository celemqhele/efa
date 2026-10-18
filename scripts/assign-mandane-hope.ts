/**
 * One-off: assign the EFA user "mandane" (6a97a4e2-6312-4689-9beb-35a1c07a8af4)
 * as manager of Hope (69f95372-9c41-4755-82ee-a368912e4a83), going through the
 * same lib/manager-mgmt.assignManagerToClub the admin route uses so the unowned
 * tournament seats (Motsepe Foundation Championship, CAF Confederations League,
 * Nedbank Cup) are reclaimed and any managerless auto-forfeits are withdrawn.
 *
 * Run: npx tsx scripts/assign-mandane-hope.ts
 */
import { loadEnvFile } from 'process'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { assignManagerToClub } from '../lib/manager-mgmt'

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

const USER_ID = '6a97a4e2-6312-4689-9beb-35a1c07a8af4'
const TEAM_ID = '69f95372-9c41-4755-82ee-a368912e4a83'

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[assign] user:  ${USER_ID}`)
  console.log(`[assign] team:  ${TEAM_ID} (Hope)`)

  const result = await assignManagerToClub(supabase, {
    teamId: TEAM_ID,
    userId: USER_ID,
    adminId: null,
  })
  console.log('[assign] outcome:', JSON.stringify(result, null, 2))
  if (!result.ok) throw new Error(result.code === 'SACK_COOLDOWN'
    ? `Cooldown until ${result.cooldownEndsAt}`
    : result.message)

  const { data: team, error: tErr } = await supabase
    .from('teams')
    .select('id, name, manager_id')
    .eq('id', TEAM_ID)
    .single()
  if (tErr || !team) throw new Error(`team verification failed: ${tErr?.message}`)
  console.log('[assign] team:', JSON.stringify(team, null, 2))
  if (team.manager_id !== USER_ID) throw new Error('Verification FAILED — teams.manager_id not set')

  const { data: seats } = await supabase
    .from('tournament_participants')
    .select('id, tournament_id, user_id, team_id')
    .eq('team_id', TEAM_ID)
  console.log('[assign] seats:', JSON.stringify(seats, null, 2))

  const { data: tenure } = await supabase
    .from('manager_tenures')
    .select('id, team_id, manager_username, started_at, ended_at')
    .eq('team_id', TEAM_ID)
    .is('ended_at', null)
  console.log('[assign] open tenures:', JSON.stringify(tenure, null, 2))

  console.log('\nDone — mandane now manages Hope.')
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
