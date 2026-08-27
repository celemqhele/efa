export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import eFootballTeams from '@/lib/efootball-2027-teams.json'
import { slugToDisplayName } from '@/lib/logo-resolver'
import { sortStandingsRows } from '@/lib/standings-core'
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

  // For active seasons, load the finished league standings + which teams are
  // already committed to a cup, so cups can be started after the league ends.
  for (const s of seasons) {
    if (s.status !== 'active') continue
    const leagueT = s.tournaments.find((t: any) => t.type === 'league')
    if (!leagueT || !leagueT.id) continue

    const { data: rows } = await supabase
      .from('standings')
      .select('team_id, points, goals_for, goals_against, gd_penalty, teams(name, logo_league_folder, logo_team_slug)')
      .eq('tournament_id', leagueT.id)

    if (rows) {
      s.final_standings = sortStandingsRows(rows as any[]).map((r: any, i: number) => ({
        position: i + 1,
        team_id: r.team_id,
        name: r.teams?.name ?? '',
        logo_league_folder: r.teams?.logo_league_folder ?? '',
        logo_team_slug: r.teams?.logo_team_slug ?? '',
      }))
    }

    const cupTs = s.tournaments.filter(
      (t: any) => t.type === 'tournament_club' || t.type === 'tournament_international'
    )
    const cupTaken: Record<string, string> = {}
    if (cupTs.length > 0) {
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select('team_id, tournament_id')
        .in('tournament_id', cupTs.map((t: any) => t.id))

      const typeById = new Map<string, string>(cupTs.map((t: any) => [t.id as string, t.type as string]))
      for (const p of (parts ?? []) as any[]) {
        cupTaken[p.team_id] = typeById.get(p.tournament_id) ?? ''
      }
    }
    s.cup_taken = cupTaken
  }

  const { data: rawTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

  // teams already present in the DB (have ids / manager assignments)
  const dbByKey = new Map<string, {
    id: string
    name: string
    logo_league_folder: string
    logo_team_slug: string
    manager_id: string | null
  }>()
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

  // Build the full allowed team set from config (no filesystem access), enriched
  // with DB ids / manager assignments where they exist.
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

  // Preserve any DB teams not covered by the current season config (legacy /
  // custom league teams that were previously surfaced from the teams table).
  for (const db of dbByKey.values()) {
    const key = `${db.logo_league_folder}::${db.logo_team_slug}`
    if (!clubMap.has(key)) clubMap.set(key, db)
  }

  const allTeams = Array.from(clubMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Shell
      data={{
        seasons,
        allTeams,
      }}
    />
  )
}
