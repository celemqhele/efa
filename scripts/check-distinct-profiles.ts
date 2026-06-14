import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data } = await supabase.from('team_dna').select('team_id, primary_profile')
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const p = row.primary_profile || 'NULL'
    counts[p] = (counts[p] || 0) + 1
  }
  console.log(JSON.stringify(counts, null, 2))
}

main().then(() => process.exit(0))
