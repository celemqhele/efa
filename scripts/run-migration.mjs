import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const sql = readFileSync(new URL('../supabase/migrations/029_redesign_tournament_types.sql', import.meta.url), 'utf8')

const client = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  const { data, error } = await client.rpc('pgquery', { query: sql })
  if (error) {
    console.error('Migration error:', error)
  } else {
    console.log('Migration result:', data)
  }
}
run()
