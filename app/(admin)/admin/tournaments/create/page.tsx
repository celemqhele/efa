import { createClient } from '@/lib/supabase/server'
import CreateTournamentClient from './CreateTournamentClient'

export const revalidate = 0

export default async function CreateTournamentPage() {
  const supabase = await createClient()

  // Existing seasons
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, status, start_date, end_date')
    .order('created_at', { ascending: false })

  // All teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .order('name', { ascending: true })

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
        allTeams={teams ?? []}
        activeLeagueName={activeLeague?.name ?? null}
        leagueStandings={leagueStandings}
      />
    </div>
  )
}
