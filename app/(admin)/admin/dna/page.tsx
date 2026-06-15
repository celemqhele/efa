export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export default async function AdminDNAPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name', { ascending: true })

  const { data: existingDNA } = await supabase
    .from('team_dna')
    .select('*')

  const dnaMap = new Map<string, any>()
  if (existingDNA) {
    for (const row of existingDNA) dnaMap.set(row.team_id, row)
  }

  return (
    <Shell data={{ teams: teams ?? [], dnaMap: Object.fromEntries(dnaMap) }} />
  )
}
