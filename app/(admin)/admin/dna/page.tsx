export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import DNAAssignClient from './DNAAssignClient'
import { DNA_PROFILES } from '@/lib/dna-engine'

export default async function AdminDNAPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .order('name', { ascending: true })

  const { data: existingDNA } = await supabase
    .from('team_dna')
    .select('*')

  const dnaMap = new Map<string, any>()
  if (existingDNA) {
    for (const row of existingDNA) {
      dnaMap.set(row.team_id, row)
    }
  }

  const profiles = DNA_PROFILES.map(p => ({ label: p.label, iconName: p.iconName, color: p.color }))

  return (
    <DNAAssignClient
      teams={teams ?? []}
      dnaMap={Object.fromEntries(dnaMap)}
      profiles={profiles}
    />
  )
}
