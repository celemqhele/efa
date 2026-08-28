import { createClient } from '@/lib/supabase/server'
import { getLeagueFolders, getLeagueDisplayName } from '@/lib/logo-resolver'
import { slugToName } from '@/lib/registry'
import fs from 'fs'
import path from 'path'

export const revalidate = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return Response.json({ managers: [], teams: [], leagues: [], countries: [] })

  const supabase = await createClient()

  // 1. Search managers (profiles)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${q}%`)
    .limit(10)

  const managers = (profiles ?? []).map((p: any) => ({
    id: p.id,
    label: p.username,
    subtitle: 'Manager',
    href: `/managers/${p.id}`,
    avatar: p.avatar_url,
  }))

  // 2. Search teams (from DB)
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .ilike('name', `%${q}%`)
    .limit(10)

  const teamResults = (teams ?? []).map((t: any) => ({
    id: t.id,
    label: t.name,
    subtitle: 'Team',
    href: `/teams/${t.id}`,
    logoFolder: t.logo_league_folder,
    logSlug: t.logo_team_slug,
  }))

  // 3. Search leagues/clubs by display name
  const leagueResults = getLeagueFolders()
    .filter((f) => getLeagueDisplayName(f).toLowerCase().includes(q))
    .map((f) => ({
      id: f,
      label: getLeagueDisplayName(f),
      subtitle: 'League',
      href: `/standings?league=${encodeURIComponent(f)}`,
      leagueFolder: f,
    }))

  // 4. Search countries/national teams from logo files
  const SCAN_FOLDER = 'fifa-world-cup-2026.football-logos.cc'
  const logosRoot = path.join(process.cwd(), 'public', 'logos', SCAN_FOLDER, '128x128')
  const countryResults: any[] = []
  try {
    const files = fs.readdirSync(logosRoot)
    for (const file of files) {
      if (!file.endsWith('.png')) continue
      const slug = file.replace('.png', '')
      const displayName = slugToName(slug, true)
      if (displayName.toLowerCase().includes(q) || slug.toLowerCase().includes(q)) {
        countryResults.push({
          id: slug,
          label: displayName,
          subtitle: 'Country',
          href: `/standings?country=${encodeURIComponent(slug)}`,
          leagueFolder: SCAN_FOLDER,
          logSlug: slug,
        })
      }
    }
  } catch {}

  return Response.json({
    managers,
    teams: teamResults,
    leagues: leagueResults,
    countries: countryResults,
  })
}
