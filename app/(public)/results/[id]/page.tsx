import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResultDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: _result } = await supabase
    .from('results')
    .select(`
      *,
      match_stats (*),
      fixtures (
        id, matchday, scheduled_date, round_type, tournament_id,
        home_team:teams!home_team_id (
          id, name, logo_league_folder, logo_team_slug,
          manager:profiles!manager_id (username)
        ),
        away_team:teams!away_team_id (
          id, name, logo_league_folder, logo_team_slug,
          manager:profiles!manager_id (username)
        ),
        tournament:tournaments (name, type)
      )
    `)
    .eq('id', id)
    .single() as any
  const result = _result as any

  if (!result) notFound()

  const fixture = result.fixtures as any
  const stats = result.match_stats as any
  const home = fixture?.home_team
  const away = fixture?.away_team
  const tournament = fixture?.tournament

  const tournamentColor =
    tournament?.type === 'league' ? 'text-[#c9a84c]' :
    tournament?.type === 'tournament_club' ? 'text-yellow-400' :
    tournament?.type === 'tournament_international' ? 'text-green-400' :
    'text-text-muted'

  const data = { result, stats, fixture, home, away, tournament, tournamentColor }

  return <Shell data={data} />
}
