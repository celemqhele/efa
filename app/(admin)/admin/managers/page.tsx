export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import ManagersClient from './ManagersClient'

export default async function ManageManagersPage() {
  const supabase = await createClient()

  const [{ data: rawTeams }, { data: rawProfiles }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, logo_league_folder, logo_team_slug, manager_id')
      .order('name', { ascending: true }),
    (supabase as any)
      .from('profiles')
      .select('id, username, avatar_url, role, whatsapp_number')
      .order('username', { ascending: true }),
  ])

  // Deduplicate teams by logo slug — same club can appear across multiple phases
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

  // Build userId → team map (from the deduplicated set)
  const managedTeamByUser: Record<string, TeamRow> = {}
  for (const team of teams) {
    if (team.manager_id) managedTeamByUser[team.manager_id] = team
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Managers</h1>
        <p className="text-slate-400 text-sm mt-1">
          Assign or remove managers for each club in the league.
        </p>
      </div>
      <ManagersClient
        teams={teams}
        profiles={rawProfiles ?? []}
        managedTeamByUser={managedTeamByUser}
      />
    </div>
  )
}

