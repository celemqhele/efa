import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { getLeagueFolders } from '@/lib/logo-resolver'
import CreateTournamentClient from './CreateTournamentClient'

export const revalidate = 0

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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

  // Build lookup: logo_team_slug ? best DB row
  const dbBySlug = new Map<string, { id: string; name: string; logo_league_folder: string; manager_id: string | null }>()
  for (const t of rawTeams ?? []) {
    if (!t.logo_team_slug) continue
    // If multiple rows exist for a slug, prefer the one with a manager for status display, 
    // or just keep the first one found.
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

  // 2. Build full club list from logos directory
  const logosRoot = path.join(process.cwd(), 'public', 'logos')
  const clubMap = new Map<string, {
    id: string | null
    name: string
    logo_league_folder: string
    logo_team_slug: string
    manager_id: string | null
  }>()

  for (const folder of getLeagueFolders()) {
    const folderPath = path.join(logosRoot, folder, '128x128')
    let files: string[]
    try { files = fs.readdirSync(folderPath) } catch { continue }

    for (const file of files) {
      if (!file.endsWith('.png')) continue
      const slug = file.replace('.png', '')
      if (clubMap.has(slug)) continue

      const db = dbBySlug.get(slug)
      clubMap.set(slug, {
        id: db?.id ?? null,
        name: db?.name ?? slugToName(slug),
        logo_league_folder: db?.logo_league_folder ?? folder,
        logo_team_slug: slug,
        manager_id: db?.manager_id ?? null,
      })
    }
  }

  // Also include any DB teams whose logos aren't in the folder scan
  for (const [slug, db] of Array.from(dbBySlug.entries())) {
    if (!clubMap.has(slug)) {
      clubMap.set(slug, {
        id: db.id,
        name: db.name,
        logo_league_folder: db.logo_league_folder,
        logo_team_slug: slug,
        manager_id: db.manager_id,
      })
    }
  }

  const allClubs = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Active league tournament + standings for UCL/Europa auto-population
  const { data: activeLeague } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('type', 'league')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  let leagueStandings: { team_id: string; points: number; rank?: number }[] = []
  if (activeLeague) {
    const { data: standings } = await supabase
      .from('standings')
      .select('team_id, points')
      .eq('tournament_id', activeLeague.id)
      .order('points', { ascending: false })
    leagueStandings = standings ?? []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Tournament</h1>
        <p className="text-slate-400 text-sm mt-1">Set up a new season tournament.</p>
      </div>

      <CreateTournamentClient
        seasons={seasons ?? []}
        allTeams={allClubs}
        activeLeagueName={activeLeague?.name ?? null}
        leagueStandings={leagueStandings}
      />
    </div>
  )
}

