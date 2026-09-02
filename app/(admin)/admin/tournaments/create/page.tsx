import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 0

export default async function CreateTournamentPage() {
  const supabase = await createClient()

  // Existing seasons
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, status, start_date, end_date')
    .order('created_at', { ascending: false })

  // All profiles + the club each one currently manages. Participants are
  // user-owned slots, so creation only offers users who manage a club
  // (mirrors resolveUserClubId / the slot model).
  const [{ data: profiles }, { data: managedTeams }] = await Promise.all([
    supabase.from('profiles').select('id, username').order('username'),
    supabase.from('teams').select('id, name, logo_league_folder, logo_team_slug, manager_id').not('manager_id', 'is', null),
  ])

  const clubByUser = new Map<string, { id: string; name: string; logo_league_folder: string; logo_team_slug: string }>()
  for (const t of (managedTeams ?? []) as any[]) {
    if (t.manager_id && !clubByUser.has(t.manager_id)) {
      clubByUser.set(t.manager_id, {
        id: t.id,
        name: t.name,
        logo_league_folder: t.logo_league_folder,
        logo_team_slug: t.logo_team_slug,
      })
    }
  }

  const users = ((profiles ?? []) as any[])
    .filter((p: any) => clubByUser.has(p.id))
    .map((p: any) => ({
      id: p.id,
      username: p.username ?? 'unknown',
      club: clubByUser.get(p.id)!,
    }))

  return <Shell data={{ seasons: seasons ?? [], users }} />
}