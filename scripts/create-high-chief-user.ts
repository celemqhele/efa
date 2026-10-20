/**
 * One-off: create the EFA user "high_chief" (+27 79 527 6855) with the default password.
 *
 * Run: npx tsx scripts/create-high-chief-user.ts
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

const USERNAME = 'high_chief'
const PASSWORD = 'Efootball@2026'
const PHONE = '27795276855'
const EMAIL = `${USERNAME}@efa.local`

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[create] username: ${USERNAME}`)
  console.log(`[create] phone:    ${PHONE}`)

  // Username uniqueness is case-insensitive in practice (profiles stores the
  // exact case but logins lowercase it), so reject either spelling.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', USERNAME)
    .maybeSingle()
  if (existing) throw new Error(`Username "@${existing.username}" already exists (profile ${existing.id})`)

  const { data: phoneClash } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('phone', PHONE)
    .maybeSingle()
  if (phoneClash) throw new Error(`Phone ${PHONE} already belongs to @${phoneClash.username} (profile ${phoneClash.id})`)

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: USERNAME },
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
      .update({ username: USERNAME, phone: PHONE })
      .eq('id', profileId)
    if (error) throw new Error(`profiles update failed: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({ id: profileId, username: USERNAME, phone: PHONE })
    if (error) throw new Error(`profiles insert failed: ${error.message}`)
  }

  const { data: verify, error: vErr } = await supabase
    .from('profiles')
    .select('id, username, role, phone, must_change_password')
    .eq('id', profileId)
    .single()
  if (vErr || !verify) throw new Error(`verification failed: ${vErr?.message}`)
  console.log('[create] profile:', JSON.stringify(verify, null, 2))

  if (verify.username !== USERNAME) throw new Error('Verification FAILED — profile fields do not match')
  if (verify.phone !== PHONE) throw new Error(`Verification FAILED — phone is ${verify.phone}`)
  if (verify.must_change_password !== true) {
    console.warn('[create] WARNING: must_change_password is not true — first-login prompt will not fire')
  }

  console.log('\nDone — user created and verified.')
  console.log(`Username: ${USERNAME}`)
  console.log(`Password: ${PASSWORD}`)
  console.log(`Profile:  ${profileId}`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
