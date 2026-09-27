import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'
import { getSiblingMatchday, computeAggregate, flipAggregate } from '@/lib/aggregate'
import { parseForfeitAdjusted } from '@/lib/forfeit-note'
import { ogMeta, formatMatchday, roundLabel } from '@/lib/og'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

// Shared by generateMetadata and the page body so the link preview does not
// double the result query on every request.
const getResult = cache(async (supabase: any, id: string) => {
  const { data } = await supabase
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
  return data as any
})

/** "2 - 1", falling back to penalties when a shootout decided it. */
function scoreline(result: any): string | null {
  if (result?.pen_home_score != null && result?.pen_away_score != null) {
    return `${result.home_score ?? 0} - ${result.away_score ?? 0} (${result.pen_home_score}-${result.pen_away_score} pens)`
  }
  if (result?.home_score == null || result?.away_score == null) return null
  return `${result.home_score} - ${result.away_score}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const result = await getResult(supabase, id)

  if (!result) {
    return ogMeta({
      title: 'Result not found',
      description: 'This EFA match result could not be found.',
      path: `/results/${id}`,
    })
  }

  const fixture = result.fixtures
  const home = fixture?.home_team?.name ?? 'Home'
  const away = fixture?.away_team?.name ?? 'Away'
  const line = scoreline(result)
  const tourney = fixture?.tournament?.name
  const matchday = fixture?.matchday
  const when = formatMatchday(fixture?.scheduled_date)
  const round = roundLabel(fixture?.round_type)

  const badge = result.is_abandoned
    ? 'FORFEIT'
    : fixture?.round_type === 'final'
      ? 'FINAL'
      : round || 'FULL TIME'

  const subtitle = [tourney, matchday ? `Matchday ${matchday}` : null, when].filter(Boolean).join(' · ')

  const headline = line ? `${home} ${line} ${away}` : `${home} vs ${away}`

  return ogMeta({
    title: headline,
    description:
      `${headline}${subtitle ? ` — ${subtitle}.` : '.'} ` +
      'Full-time score, scorers, and match stats on the official EFA site.',
    path: `/results/${id}`,
    subtitle: subtitle || undefined,
    badge,
    home: fixture?.home_team?.logo_league_folder && fixture?.home_team?.logo_team_slug
      ? { folder: fixture.home_team.logo_league_folder, slug: fixture.home_team.logo_team_slug }
      : undefined,
    away: fixture?.away_team?.logo_league_folder && fixture?.away_team?.logo_team_slug
      ? { folder: fixture.away_team.logo_league_folder, slug: fixture.away_team.logo_team_slug }
      : undefined,
  })
}

export default async function ResultDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const result = await getResult(supabase, id)

  if (!result) notFound()

  const fixture = result.fixtures as any
  const stats = result.match_stats as any

  // Pre-adjustment (pre-penalty) score for forfeit matches, where stored
  let adjustedScore: { home: number; away: number } | null = null
  if (result?.is_abandoned && fixture?.id) {
    const { data: forfeitRows } = await supabase
      .from('forfeit_balances')
      .select('half_time_note')
      .eq('fixture_id', fixture.id)
    if (forfeitRows) {
      for (const row of forfeitRows) {
        const parsed = parseForfeitAdjusted(row?.half_time_note)
        if (parsed) { adjustedScore = parsed; break }
      }
    }
  }

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
        if (isLeg2) {
          const agg = computeAggregate(siblingResult, result)
          if (agg) aggregateScore = flipAggregate(agg)
        }
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

  const data = { result, stats, fixture, home, away, tournament, tournamentColor, aggregateScore, penScore, adjustedScore }

  return <Shell data={data} />
}
