/**
 * One-off: create the EFA user "TbhoTouch" with the default password and
 * the mobile number +27 73 182 6775.
 *
 * Run: npx tsx scripts/create-tbhotouch-user.ts
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

const USERNAME = 'tbhotouch'
const PASSWORD = 'Efootball@2026'
const EMAIL = `${USERNAME}@efa.local`
const WHATSAPP = '+27731826775'
const PHONE = '+27 73 182 6775'

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[create] username: ${USERNAME}`)
  console.log(`[create] whatsapp: ${WHATSAPP} (${PHONE})`)

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', USERNAME)
    .maybeSingle()
  if (existing) throw new Error(`Username "@${USERNAME}" already exists (profile ${existing.id})`)

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
    .select('id, username, role, phone')
    .eq('id', profileId)
    .single()
  if (vErr || !verify) throw new Error(`verification failed: ${vErr?.message}`)
  console.log('[create] profile:', JSON.stringify(verify, null, 2))

  const ok =
    verify.username === USERNAME &&
    verify.phone === PHONE
  if (!ok) throw new Error('Verification FAILED — profile fields do not match')

  console.log('\nDone — user created and verified.')
  console.log(`Username: ${USERNAME}`)
  console.log(`Password: ${PASSWORD}`)
  console.log(`Mobile:   ${PHONE}`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
