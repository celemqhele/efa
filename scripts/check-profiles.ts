import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: dna } = await supabase.from('team_dna').select('team_id, primary_profile, primary_score, primary_level, primary_about')
  const { data: teams } = await supabase.from('teams').select('id, name')
  const teamMap = new Map(teams?.map(t => [t.id, t.name]) ?? [])
  
  const counts = new Map<string, number>()
  for (const row of dna ?? []) {
    const name = teamMap.get(row.team_id) ?? row.team_id
    const aboutPreview = (row.primary_about ?? '').slice(0, 60)
    console.log(`${name.padEnd(25)} ${(row.primary_profile ?? 'NONE').padEnd(22)} ${(row.primary_score?.toFixed(2) ?? '??').padEnd(6)} ${(row.primary_level ?? '').padEnd(6)} ${aboutPreview}`)
    counts.set(row.primary_profile, (counts.get(row.primary_profile) ?? 0) + 1)
  }
  
  console.log('\nProfile distribution:')
  for (const [profile, count] of counts) {
    console.log(`  ${profile}: ${count}`)
  }
}
main().then(() => process.exit(0))
