import { createClient } from '@/lib/supabase/server'
import eFootballTeams from '@/lib/efootball-2027-teams.json'
import { slugToDisplayName } from '@/lib/logo-resolver'
import Shell from './_shell'

export const revalidate = 0

export default async function CreateTournamentPage() {
  const supabase = await createClient()

  // Existing seasons
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, status, start_date, end_date')
    .order('created_at', { ascending: false })

  // 1. Fetch all team rows from DB
  const { data: rawTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  // Build lookup keyed by folder::slug -> best DB row
  const dbByKey = new Map<string, { id: string; name: string; logo_league_folder: string; logo_team_slug: string; manager_id: string | null }>()
  for (const t of (rawTeams ?? []) as any[]) {
    if (!t.logo_team_slug || !t.logo_league_folder) continue
    const key = `${t.logo_league_folder}::${t.logo_team_slug}`
    const existing = dbByKey.get(key)
    if (!existing || (!existing.manager_id && t.manager_id)) {
      dbByKey.set(key, {
        id: t.id,
        name: t.name,
        logo_league_folder: t.logo_league_folder,
        logo_team_slug: t.logo_team_slug,
        manager_id: t.manager_id,
      })
    }
  }

  // 2. Build full club list from the season config (no filesystem access),
  //    enriched with DB ids / manager assignments where they exist.
  const clubMap = new Map<string, {
    id: string
    name: string
    logo_league_folder: string
    logo_team_slug: string
    manager_id: string | null
  }>()
  const leagues = eFootballTeams.leagues as Record<string, string[]>
  for (const [folder, slugs] of Object.entries(leagues)) {
    for (const slug of slugs) {
      const key = `${folder}::${slug}`
      const db = dbByKey.get(key)
      clubMap.set(key, {
        id: db?.id ?? '',
        name: db?.name ?? slugToDisplayName(slug),
        logo_league_folder: folder,
        logo_team_slug: slug,
        manager_id: db?.manager_id ?? null,
      })
    }
  }

  // Also include any DB teams not covered by the season config (legacy/custom)
  for (const db of dbByKey.values()) {
    const key = `${db.logo_league_folder}::${db.logo_team_slug}`
    if (!clubMap.has(key)) clubMap.set(key, db)
  }

  const allClubs = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return <Shell data={{ seasons: seasons ?? [], allTeams: allClubs }} />
}
