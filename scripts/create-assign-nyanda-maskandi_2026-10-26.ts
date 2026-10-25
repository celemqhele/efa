/**
 * One-off: create the EFA users "nyanda_yephahla" (+27 76 180 7405) and
 * "maskandi_mfana" (+27 79 393 5582) with the default password, then assign
 * them to North West University (900ec824-0d8e-48e4-b60d-a69de8feb520) and
 * Siwelele (60fb79a7-dbb4-42e4-a040-34680092e204).
 *
 * Assignment goes through lib/manager-mgmt.assignManagerToClub — the same
 * function the admin route uses — so each club's 3 unowned tournament seats
 * (Betway Premiership, CAF Champions League, Nedbank Cup) are reclaimed.
 *
 * Run: npx tsx scripts/create-assign-nyanda-maskandi_2026-10-26.ts
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

const PASSWORD = 'Efootball@2026'

const USERS = [
  {
    username: 'nyanda_yephahla',
    phone: '27761807405', // +27 76 180 7405
    teamId: '900ec824-0d8e-48e4-b60d-a69de8feb520',
    teamName: 'North West University',
  },
  {
    username: 'maskandi_mfana',
    phone: '27793935582', // +27 79 393 5582
    teamId: '60fb79a7-dbb4-42e4-a040-34680092e204',
    teamName: 'Siwelele',
  },
]

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createUser(username: string, phone: string): Promise<string> {
  console.log(`\n[create] @${username}  phone ${phone}`)

  // Username uniqueness is case-insensitive in practice (profiles stores the
  // exact case but logins lowercase it), so reject either spelling.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .maybeSingle()
  if (existing) throw new Error(`Username "@${existing.username}" already exists (profile ${existing.id})`)

  const { data: phoneClash } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('phone', phone)
    .maybeSingle()
  if (phoneClash) throw new Error(`Phone ${phone} already belongs to @${phoneClash.username} (profile ${phoneClash.id})`)

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: `${username}@efa.local`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username },
  })
  if (createError || !created?.user) {
    throw new Error(`createUser failed: ${createError?.message ?? 'no user returned'}`)
  }
  const profileId = created.user.id
  console.log(`[create] auth user created: ${profileId}`)

  let profile: { id: string } | null = null
  try {
    const r = await supabase.from('profiles').select('id').eq('id', profileId).single()
    profile = r.data
  } catch {}
  if (profile) {
    const { error } = await supabase
      .from('profiles')
      .update({ username, phone })
      .eq('id', profileId)
    if (error) throw new Error(`profiles update failed: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({ id: profileId, username, phone })
    if (error) throw new Error(`profiles insert failed: ${error.message}`)
  }

  const { data: verify, error: vErr } = await supabase
    .from('profiles')
    .select('id, username, role, phone, must_change_password')
    .eq('id', profileId)
    .single()
  if (vErr || !verify) throw new Error(`verification failed: ${vErr?.message}`)
  console.log('[create] profile:', JSON.stringify(verify, null, 2))

  if (verify.username !== username) throw new Error('Verification FAILED — username mismatch')
  if (verify.phone !== phone) throw new Error(`Verification FAILED — phone is ${verify.phone}`)
  if (verify.must_change_password !== true) {
    console.warn('[create] WARNING: must_change_password is not true — first-login prompt will not fire')
  }

  return profileId
}

async function assign(userId: string, username: string, teamId: string, teamName: string) {
  console.log(`\n[assign] @${username} -> ${teamName} (${teamId})`)

  const result = await assignManagerToClub(supabase, { teamId, userId, adminId: null })
  console.log('[assign] outcome:', JSON.stringify(result, null, 2))
  if (!result.ok) throw new Error(result.code === 'SACK_COOLDOWN'
    ? `Cooldown until ${result.cooldownEndsAt}`
    : result.message)

  const { data: team, error: tErr } = await supabase
    .from('teams')
    .select('id, name, manager_id')
    .eq('id', teamId)
    .single()
  if (tErr || !team) throw new Error(`team verification failed: ${tErr?.message}`)
  if (team.manager_id !== userId) throw new Error('Verification FAILED — teams.manager_id not set')
  console.log('[assign] team:', JSON.stringify(team, null, 2))

  const { data: seats } = await supabase
    .from('tournament_participants')
    .select('id, tournament_id, user_id')
    .eq('team_id', teamId)
  console.log('[assign] seats:', JSON.stringify(seats, null, 2))

  const { data: tenure } = await supabase
    .from('manager_tenures')
    .select('id, team_id, manager_username, started_at, ended_at')
    .eq('team_id', teamId)
    .is('ended_at', null)
  console.log('[assign] open tenures:', JSON.stringify(tenure, null, 2))
}

async function main() {
  for (const u of USERS) {
    const userId = await createUser(u.username, u.phone)
    await assign(userId, u.username, u.teamId, u.teamName)
  }

  console.log('\nDone — both users created and assigned.')
  console.log(`Password for both accounts: ${PASSWORD}`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
