export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import SelectTeamClient from './SelectTeamClient'

export default async function SelectTeamPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  return <SelectTeamClient teams={teams ?? []} />
}
