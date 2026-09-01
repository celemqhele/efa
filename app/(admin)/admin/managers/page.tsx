export const dynamic = 'force-dynamic'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { filterTeams } from '@/lib/allowed-teams'
import Shell from './_shell'

export default async function ManageManagersPage() {
  const supabase = await createClient()

  const [{ data: rawTeams }, { data: rawProfiles }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .order('name', { ascending: true }),
    (supabase as any)
      .from('profiles')
      .select('id, username, avatar_url, role, phone')
      .order('username', { ascending: true }),
  ])

  const adminSupabase = await createAdminClient()
  const { data: availRows } = await adminSupabase
    .from('manager_availability')
    .select('profile_id')
  const hasAvailability = new Set((availRows ?? []).map((r: any) => r.profile_id))

  type TeamRow = any
  const seen = new Map<string, TeamRow>()
  for (const team of (rawTeams ?? []) as any[]) {
    const key =
      team.logo_league_folder && team.logo_team_slug
        ? `${team.logo_league_folder}|${team.logo_team_slug}`
        : `id:${team.id}`
    const existing = seen.get(key)
    if (!existing || (!existing.manager_id && team.manager_id)) {
      seen.set(key, team)
    }
  }
  const teams = filterTeams(Array.from(seen.values())).sort((a, b) => a.name.localeCompare(b.name))

  const managedTeamByUser: Record<string, TeamRow> = {}
  for (const team of teams) {
    if (team.manager_id) managedTeamByUser[team.manager_id] = team
  }

  return (
    <Shell
      data={{
        teams,
        profiles: rawProfiles ?? [],
        managedTeamByUser,
        hasAvailabilityIds: Array.from(hasAvailability),
      }}
    />
  )
}
