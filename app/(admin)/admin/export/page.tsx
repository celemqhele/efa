import { createClient } from '@/lib/supabase/server'
import { buildLiveStandings } from '@/lib/standings-core'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    date?: string
    tournaments?: string
    types?: string
  }>
}

const VALID_TYPES = ['fixtures', 'results', 'standings'] as const
type ExportType = (typeof VALID_TYPES)[number]

type CardData = {
  key: string
  tournament: { id: string; name: string; type: string }
  type: ExportType
  fixtures: any[]
  results: any[]
  standings: any[]
  groupStandings: Record<string, any[]>
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${days[obj.getDay()]} ${d} ${months[m - 1]} ${y}`
}

export default async function ExportPage({ searchParams }: Props) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: _tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const tournaments = (_tournaments ?? []) as any[]

  const today = new Date().toISOString().split('T')[0]
  const selectedDate = sp.date ?? today
  const formattedDate = formatDate(selectedDate)

  const defaultTournamentId = tournaments?.[0]?.id ?? ''
  const selectedTournamentIds: string[] = sp.tournaments
    ? sp.tournaments.split(',').filter(Boolean)
    : defaultTournamentId
    ? [defaultTournamentId]
    : []

  const selectedTypes: ExportType[] = sp.types
    ? sp.types
        .split(',')
        .filter((t): t is ExportType => VALID_TYPES.includes(t as ExportType))
    : ['fixtures']

  const dateStart = `${selectedDate}T00:00:00`
  const dateEnd = `${selectedDate}T23:59:59`

  const cards: CardData[] = []

  for (const tournamentId of selectedTournamentIds) {
    const tournament = tournaments?.find((t) => t.id === tournamentId)
    if (!tournament) continue

    for (const cardType of selectedTypes) {
      let fixtures: any[] = []
      let results: any[] = []
      let standings: any[] = []
      let groupStandings: Record<string, any[]> = {}

      if (cardType === 'fixtures') {
        const { data } = await supabase
          .from('fixtures')
          .select(
            `id, matchday, scheduled_date, status,
            home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
            away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)`
          )
          .eq('tournament_id', tournamentId)
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
        fixtures = data ?? []
      }

      if (cardType === 'results') {
        const { data: ftFixtures } = await supabase
          .from('fixtures')
          .select(
            `id, matchday, scheduled_date, status,
            home_team:teams!fixtures_home_team_id_fkey(name, logo_league_folder, logo_team_slug),
            away_team:teams!fixtures_away_team_id_fkey(name, logo_league_folder, logo_team_slug)`
          )
          .eq('tournament_id', tournamentId)
          .eq('status', 'confirmed')
          .gte('scheduled_date', dateStart)
          .lte('scheduled_date', dateEnd)
          .order('scheduled_date', { ascending: true })

        const fixtureIds = (ftFixtures ?? []).map((f: any) => f.id)
        const { data: scoreRows } = fixtureIds.length
          ? await supabase
              .from('results')
              .select('fixture_id, home_score, away_score')
              .in('fixture_id', fixtureIds)
          : { data: [] }

        const scoresByFixture: Record<string, any> = {}
        for (const row of scoreRows ?? []) {
          scoresByFixture[(row as any).fixture_id] = row
        }

        results = (ftFixtures ?? [])
          .map((f: any) => ({ ...f, result: scoresByFixture[f.id] ?? null }))
          .filter((f: any) => f.result)
      }

      if (cardType === 'standings') {
        const { leagueStandings, groupStandings: gs } = await buildLiveStandings(supabase, tournamentId, tournament.type)
        standings = leagueStandings
        groupStandings = gs
      }

      cards.push({ key: `${tournamentId}-${cardType}`, tournament, type: cardType, fixtures, results, standings, groupStandings })
    }
  }

  return (
    <Shell data={{
      cards,
      tournaments,
      selectedDate,
      defaultTournamentIds: selectedTournamentIds,
      defaultTypes: selectedTypes,
      formattedDate,
    }} />
  )
}

