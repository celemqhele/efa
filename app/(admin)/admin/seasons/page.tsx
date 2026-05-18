export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import SeasonManager from './SeasonManager'

export default async function SeasonsPage() {
  const supabase = await createClient()

  // All seasons ordered newest first
  const { data: rawSeasons } = await supabase
    .from('seasons')
    .select(`
      id, name, status, start_date, end_date,
      tournaments(id, name, type, status)
    `)
    .order('created_at', { ascending: false })

  // Fixture counts per tournament
  const { data: fixtureCounts } = await supabase
    .from('fixtures')
    .select('tournament_id, status')

  const totalMap: Record<string, number> = {}
  const doneMap: Record<string, number> = {}
  const doneSts = new Set(['confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both'])
  for (const f of fixtureCounts ?? []) {
    totalMap[f.tournament_id] = (totalMap[f.tournament_id] ?? 0) + 1
    if (doneSts.has(f.status)) {
      doneMap[f.tournament_id] = (doneMap[f.tournament_id] ?? 0) + 1
    }
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
      })),
      league_total_fixtures: leagueT ? (totalMap[leagueT.id] ?? 0) : 0,
      league_completed_fixtures: leagueT ? (doneMap[leagueT.id] ?? 0) : 0,
    }
  })

  // All teams (for wizard team selection)
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name')

  // Previous completed season's final standings (for UCL/Europa auto-population)
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
    <SeasonManager
      seasons={seasons}
      allTeams={allTeams ?? []}
      prevSeasonStandings={prevSeasonStandings}
    />
  )
}
