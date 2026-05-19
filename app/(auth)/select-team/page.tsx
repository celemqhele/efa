export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import SelectTeamClient from './SelectTeamClient'

export default async function SelectTeamPage() {
  const supabase = await createClient()

  const { data: rawTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  // Deduplicate rows with the same logo (same club added twice).
  // For duplicates, prefer the row that already has a manager_id.
  type TeamRow = NonNullable<typeof rawTeams>[number]
  const seen = new Map<string, TeamRow>()
  for (const team of rawTeams ?? []) {
    const key =
      team.logo_league_folder && team.logo_team_slug
        ? `${team.logo_league_folder}|${team.logo_team_slug}`
        : `id:${team.id}`
    const existing = seen.get(key)
    if (!existing || (!existing.manager_id && team.manager_id)) {
      seen.set(key, team)
    }
  }
  const teams = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))

  return <SelectTeamClient teams={teams} />
}
