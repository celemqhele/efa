export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { sortStandingsRows } from '@/lib/standings-core'
import Shell from './_shell'

export default async function SeasonsPage() {
  const supabase = await createClient()

  const { data: rawSeasons } = await (supabase
    .from('seasons')
    .select(`
      id, name, status, start_date, end_date,
      tournaments(id, name, type, status, division)
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
    const leagueTs = (s.tournaments ?? [])
      .filter((t: any) => t.type === 'league')
      .sort((a: any, b: any) => (a.division ?? 1) - (b.division ?? 1))
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
        division: t.division ?? null,
        fixture_count: totalMap[t.id] ?? 0,
        completed_count: doneMap[t.id] ?? 0,
        knockout_ready:
          (t.type === 'tournament_club' || t.type === 'tournament_international') &&
          (groupTotalMap[t.id] ?? 0) > 0 &&
          (groupDoneMap[t.id] ?? 0) === (groupTotalMap[t.id] ?? 0) &&
          (sfCountMap[t.id] ?? 0) === 0,
      })),
      league_tournaments: leagueTs.map((t: any) => ({
        id: t.id,
        name: t.name,
        division: t.division ?? 1,
        status: t.status,
        fixture_count: totalMap[t.id] ?? 0,
        completed_count: doneMap[t.id] ?? 0,
      })),
      league_total_fixtures: leagueTs.reduce((sum: number, t: any) => sum + (totalMap[t.id] ?? 0), 0),
      league_completed_fixtures: leagueTs.reduce((sum: number, t: any) => sum + (doneMap[t.id] ?? 0), 0),
    }
  })

  // For active seasons, load the finished league standings + which teams are
  // already committed to a cup, so cups can be started after the league ends.
  for (const s of seasons) {
    if (s.status !== 'active') continue
    if (s.league_tournaments.length === 0) continue

    const finalStandingsByDivision: Record<number, any[]> = {}
    const finalStandings: any[] = []
    for (const lt of s.league_tournaments) {
      const { data: rows } = await supabase
        .from('standings')
        .select('team_id, points, goals_for, goals_against, gd_penalty, teams(name, logo_league_folder, logo_team_slug)')
        .eq('tournament_id', lt.id)

      if (rows) {
        const mapped = sortStandingsRows(rows as any[]).map((r: any, i: number) => ({
          position: i + 1,
          team_id: r.team_id,
          name: r.teams?.name ?? '',
          logo_league_folder: r.teams?.logo_league_folder ?? '',
          logo_team_slug: r.teams?.logo_team_slug ?? '',
          division: lt.division,
        }))
        finalStandingsByDivision[lt.division] = mapped
        finalStandings.push(...mapped)
      }
    }
    s.final_standings_by_division = finalStandingsByDivision
    s.final_standings = finalStandings

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

  // Users with the club they currently manage — Start Phase participants are
  // user-owned slots (mirrors resolveUserClubId / the slot model).
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

  return (
    <Shell
      data={{
        seasons,
        users,
      }}
    />
  )
}