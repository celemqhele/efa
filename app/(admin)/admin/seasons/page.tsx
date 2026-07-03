export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { getLeagueFolders, slugToDisplayName } from '@/lib/logo-resolver'
import Shell from './_shell'

export default async function SeasonsPage() {
  const supabase = await createClient()

  const { data: rawSeasons } = await (supabase
    .from('seasons')
    .select(`
      id, name, status, start_date, end_date,
      tournaments(id, name, type, status)
    `)
    .order('created_at', { ascending: false }) as any)

  const { data: fixtureCounts } = await supabase
    .from('fixtures')
    .select('tournament_id, status, round_type')

  const totalMap: Record<string, number> = {}
  const doneMap: Record<string, number> = {}
  const groupTotalMap: Record<string, number> = {}
  const groupDoneMap: Record<string, number> = {}
  const sfCountMap: Record<string, number> = {}

  const doneSts = new Set(['confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both'])

  for (const f of (fixtureCounts ?? []) as any[]) {
    const tid = f.tournament_id
    totalMap[tid] = (totalMap[tid] ?? 0) + 1
    if (doneSts.has(f.status)) doneMap[tid] = (doneMap[tid] ?? 0) + 1

    if (f.round_type === 'group') {
      groupTotalMap[tid] = (groupTotalMap[tid] ?? 0) + 1
      if (doneSts.has(f.status)) groupDoneMap[tid] = (groupDoneMap[tid] ?? 0) + 1
    }
    if (f.round_type === 'sf') sfCountMap[tid] = (sfCountMap[tid] ?? 0) + 1
  }

  const seasons = (rawSeasons ?? []).map((s: any) => {
    const leagueT = s.tournaments?.find((t: any) => t.type === 'league')
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      start_date: s.start_date,
      end_date: s.end_date,
      tournaments: (s.tournaments ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        fixture_count: totalMap[t.id] ?? 0,
        completed_count: doneMap[t.id] ?? 0,
        knockout_ready:
          (t.type === 'tournament_club' || t.type === 'tournament_international') &&
          (groupTotalMap[t.id] ?? 0) > 0 &&
          (groupDoneMap[t.id] ?? 0) === (groupTotalMap[t.id] ?? 0) &&
          (sfCountMap[t.id] ?? 0) === 0,
      })),
      league_total_fixtures: leagueT ? (totalMap[leagueT.id] ?? 0) : 0,
      league_completed_fixtures: leagueT ? (doneMap[leagueT.id] ?? 0) : 0,
    }
  })

  const { data: rawTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  const dbBySlug = new Map<string, { id: string; name: string; logo_league_folder: string; manager_id: string | null }>()
  for (const t of (rawTeams ?? []) as any[]) {
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
        name: db?.name ?? slugToDisplayName(slug),
        logo_league_folder: db?.logo_league_folder ?? folder,
        logo_team_slug: slug,
        manager_id: db?.manager_id ?? null,
      })
    }
  }

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

  const allTeams = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  const completedSeason = (rawSeasons ?? []).find((s: any) => s.status === 'completed')
  let prevSeasonStandings: { team_id: string; team_name: string }[] | null = null

  if (completedSeason) {
    const prevLeague = completedSeason.tournaments?.find((t: any) => t.type === 'league')
    if (prevLeague) {
      const { data: prevStandings } = await supabase
        .from('standings')
        .select('team_id, teams(name)')
        .eq('tournament_id', prevLeague.id)
        .order('points', { ascending: false })
        .order('goal_difference', { ascending: false })

      if (prevStandings) {
        prevSeasonStandings = prevStandings.map((s: any) => ({
          team_id: s.team_id,
          team_name: s.teams?.name ?? '',
        }))
      }
    }
  }

  return (
    <Shell
      data={{
        seasons,
        allTeams,
        prevSeasonStandings,
      }}
    />
  )
}
