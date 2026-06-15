export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { getLeagueFolders } from '@/lib/logo-resolver'
import Shell from './_shell'

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function SelectTeamPage() {
  const supabase = await createClient()

  // Fetch all team rows from DB — covers all phases/tournaments
  const { data: _rawTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
  const rawTeams = (_rawTeams ?? []) as any[]

  // Build lookup: logo_team_slug → best DB row (prefer managed row to detect "taken")
  const dbBySlug = new Map<string, { id: string; name: string; logo_league_folder: string; manager_id: string | null }>()
  for (const t of rawTeams) {
    if (!t.logo_team_slug) continue
    const existing = dbBySlug.get(t.logo_team_slug)
    if (!existing || (!existing.manager_id && t.manager_id)) {
      dbBySlug.set(t.logo_team_slug, {
        id: t.id,
        name: t.name,
        logo_league_folder: t.logo_league_folder ?? '',
        manager_id: t.manager_id,
      })
    }
  }

  // Build full club list from logos directory (covers clubs not yet in any tournament)
  const logosRoot = path.join(process.cwd(), 'public', 'logos')
  const clubMap = new Map<string, {
    slug: string
    name: string
    logoFolder: string
    id: string | null
    manager_id: string | null
  }>()

  for (const folder of getLeagueFolders()) {
    const folderPath = path.join(logosRoot, folder, '128x128')
    let files: string[]
    try { files = fs.readdirSync(folderPath) } catch { continue }

    for (const file of files) {
      if (!file.endsWith('.png')) continue
      const slug = file.replace('.png', '')
      if (clubMap.has(slug)) continue // already added from an earlier league folder

      const db = dbBySlug.get(slug)
      clubMap.set(slug, {
        slug,
        name: db?.name ?? slugToName(slug),
        logoFolder: db?.logo_league_folder ?? folder,
        id: db?.id ?? null,
        manager_id: db?.manager_id ?? null,
      })
    }
  }

  // Also include any DB teams whose logos aren't in the folder scan
  for (const [slug, db] of Array.from(dbBySlug.entries())) {
    if (!clubMap.has(slug)) {
      clubMap.set(slug, {
        slug,
        name: db.name,
        logoFolder: db.logo_league_folder,
        id: db.id,
        manager_id: db.manager_id,
      })
    }
  }

  const clubs = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return <Shell data={{ clubs }} />
}

