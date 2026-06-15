import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const sql = readFileSync(new URL('../supabase/migrations/029_redesign_tournament_types.sql', import.meta.url), 'utf8')

const client = createClient(
  'https://dtxnqtfqsehofezdmdbd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc',
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
