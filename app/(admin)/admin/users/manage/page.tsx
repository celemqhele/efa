import { createClient, createAdminClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 0

export default async function UsersManagePage() {
  const supabase = await createClient()

  // All profiles
  const { data: _profiles } = await supabase
    .from('profiles')
    .select('id, username, role, avatar_url, created_at')
    .order('created_at', { ascending: false })
  const profiles = (_profiles ?? []) as any[]

  // All teams (to find which team each user manages)
  const { data: _teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id, abandon_count')
  const teams = (_teams ?? []) as any[]

  // Build user -> team map
  const teamByManager: Record<string, any> = {}
  for (const team of teams) {
    if (team.manager_id) teamByManager[team.manager_id] = team
  }

  // Pending team change requests with user + team info
  const { data: changeRequests } = await supabase
    .from('team_change_requests')
    .select(`
      id, status, created_at,
      requesting_user:profiles!team_change_requests_requesting_user_id_fkey(id, username, avatar_url),
      requested_team:teams!team_change_requests_requested_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      current_team:teams!team_change_requests_current_team_id_fkey(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Pending manager applications — use admin client to bypass RLS and see all
  const adminSupabase = await createAdminClient()
  const { data: managerApplications } = await adminSupabase
    .from('manager_applications' as any)
    .select(`
      id, created_at,
      applicant:profiles!manager_applications_applicant_id_fkey(id, username, avatar_url),
      team:teams!manager_applications_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager_id)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  // Build profile lookup for resolving manager usernames in applications
  const profileMap: Record<string, string> = {}
  for (const p of profiles) {
    profileMap[p.id] = p.username ?? ''
  }

  return <Shell data={{
    profiles,
    teams,
    teamByManager,
    changeRequests: changeRequests ?? [],
    managerApplications: managerApplications ?? [],
    profileMap,
  }} />
}
