/**
 * One-off: create the EFA user "NAITOR" with the default password
 * (assigned to Algeria afterwards by a separate SQL step).
 *
 * Run: npx tsx scripts/create-naitor-user.ts
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

const USERNAME = 'NAITOR'
const PASSWORD = 'Efootball@2026'
const EMAIL = `${USERNAME.toLowerCase()}@efa.local`

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`[create] username: ${USERNAME}`)

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', USERNAME)
    .maybeSingle()
  if (existing) {
    // Username matches 1:1; check case-insensitive duplicates too
    const { data: existingAny } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', USERNAME.toLowerCase())
      .maybeSingle()
    if (existingAny) throw new Error(`Username "@${USERNAME}" already exists (profile ${existingAny.id})`)
  }

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
      .update({ username: USERNAME })
      .eq('id', profileId)
    if (error) throw new Error(`profiles update failed: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({ id: profileId, username: USERNAME })
    if (error) throw new Error(`profiles insert failed: ${error.message}`)
  }

  const { data: verify, error: vErr } = await supabase
    .from('profiles')
    .select('id, username, role')
    .eq('id', profileId)
    .single()
  if (vErr || !verify) throw new Error(`verification failed: ${vErr?.message}`)
  console.log('[create] profile:', JSON.stringify(verify, null, 2))

  if (verify.username !== USERNAME) {
    throw new Error('Verification FAILED — username does not match')
  }

  console.log('\nDone — user created and verified.')
  console.log(`Username: ${USERNAME}`)
  console.log(`Password: ${PASSWORD}`)
}

main().catch((e) => {
  console.error('ERROR:', e?.message ?? e)
  process.exit(1)
})
