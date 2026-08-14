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

const supabase = createSupabaseClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: fixtures, error: fetchError } = await supabase
    .from('fixtures')
    .select('id, scheduled_date')
    .gte('scheduled_date', '2026-08-11T22:00:00Z')
    .lt('scheduled_date', '2026-08-12T22:00:00Z')
    .eq('status', 'scheduled')

  if (fetchError) console.error('Fetch error:', fetchError.message)
  else console.log('Found fixtures count:', fixtures?.length)
}
main()
