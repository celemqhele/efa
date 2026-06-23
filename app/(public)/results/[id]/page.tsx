import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getSiblingMatchday, computeAggregate } from '@/lib/aggregate'
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

  // Sibling fixture for 2-leg aggregate display
  let aggregateScore: { home: number; away: number } | null = null
  let penScore: { home: number; away: number } | null = null
  const siblingMd = fixture?.matchday ? getSiblingMatchday(fixture.matchday) : null
  if (siblingMd && fixture?.round_type && ['qf', 'sf'].includes(fixture.round_type)) {
    const { data: siblingData } = await supabase
      .from('fixtures')
      .select('*, results(*)')
      .eq('tournament_id', fixture.tournament_id)
      .eq('matchday', siblingMd)
      .maybeSingle() as any

    if (siblingData) {
      const siblingResult = Array.isArray(siblingData.results)
        ? siblingData.results[0]
        : siblingData.results

      if (result && siblingResult) {
        const isLeg2 = [111, 112, 113, 114, 211, 212].includes(fixture.matchday)
        const leg1Result = isLeg2 ? siblingResult : result
        const leg2Result = isLeg2 ? result : siblingResult
        const agg = computeAggregate(leg1Result, leg2Result)
        if (agg) aggregateScore = agg
      }

      if (result && (result as any).pen_home_score != null) {
        penScore = {
          home: (result as any).pen_home_score,
          away: (result as any).pen_away_score,
        }
      }
    }
  }

  const tournamentColor =
    tournament?.type === 'league' ? 'text-[#c9a84c]' :
    tournament?.type === 'tournament_club' ? 'text-yellow-400' :
    tournament?.type === 'tournament_international' ? 'text-green-400' :
    'text-text-muted'

  const data = { result, stats, fixture, home, away, tournament, tournamentColor, aggregateScore, penScore }

  return <Shell data={data} />
}
