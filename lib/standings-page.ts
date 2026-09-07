import { buildLiveStandings } from './standings-core'

export interface StandingsPageData {
  tournaments: any[]
  activeTournamentId: string | null
  activeTournament: any | null
  leagueStandings: any[]
  groupStandings: Record<string, any[]>
}

// Single source of truth for the standings page data — shared by the public
// /standings route and the admin /admin/standings route so both always render
// the same live data. Any page that renders standings calls this and passes the
// result straight to the standings Shell.
export async function loadStandingsPageData(supabase: any, selectedTournamentId: string | null): Promise<StandingsPageData> {
  const { data: _tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, settings, division')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const tournaments = (_tournaments ?? []) as any[]

  const requestedTournament = selectedTournamentId
    ? tournaments?.find((t: any) => t.id === selectedTournamentId)
    : null

  const activeTournamentId = requestedTournament?.id ?? tournaments?.[0]?.id ?? null
  const activeTournament = tournaments?.find((t: any) => t.id === activeTournamentId)

  let leagueStandings: any[] = []
  let groupStandings: Record<string, any[]> = {}

  if (activeTournamentId && activeTournament) {
    const result = await buildLiveStandings(supabase, activeTournamentId, activeTournament.type)
    leagueStandings = result.leagueStandings
    groupStandings = result.groupStandings
  }

  return { tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings }
}