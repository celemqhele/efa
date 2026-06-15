import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 0

export default async function TeamsManagePage() {
  const supabase = await createClient()

  const { data: _teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id, abandon_count, created_at')
    .order('name', { ascending: true })
  const teams = (_teams ?? []) as any[]

  const managerIds = teams.filter((t) => t.manager_id).map((t) => t.manager_id!)
  const { data: managers } = managerIds.length
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', managerIds)
    : { data: [] }

  const managerMap: Record<string, { username: string; avatar_url: string | null }> = {}
  for (const m of (managers ?? []) as any[]) managerMap[m.id] = m

  return <Shell data={{ teams, managerMap }} />
}
