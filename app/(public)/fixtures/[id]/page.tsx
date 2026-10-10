import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { calculateProbability } from '@/lib/probability-engine'
import { getTeamDNAFromDB } from '@/lib/dna-engine'
import { getSiblingMatchday, computeAggregate, flipAggregate } from '@/lib/aggregate'
import { parseForfeitAdjusted } from '@/lib/forfeit-note'
import { gracePeriodEnded } from '@/lib/submit-match'
import { ogMeta, formatMatchday, roundLabel } from '@/lib/og'
import Shell from './_shell'

export const revalidate = 30
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Shared by generateMetadata and the page body so the link preview does not
// double the fixture query on every request.
const getFixture = cache(async (supabase: any, id: string) => {
  const { data } = await supabase
    .from('fixtures')
    .select(
      `*,
      tournament:tournaments(*),
      home_team:teams!fixtures_home_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*)),
      away_team:teams!fixtures_away_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*))`
    )
    .eq('id', id)
    .single() as any
  return data as any
})

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const fixture = await getFixture(supabase, id)

  if (!fixture) {
    return ogMeta({
      title: 'Fixture not found',
      description: 'This EFA fixture could not be found.',
      path: `/fixtures/${id}`,
    })
  }

  const home = fixture.home_team?.name ?? 'Home'
  const away = fixture.away_team?.name ?? 'Away'
  const tourney = fixture.tournament?.name
  const matchday = fixture.matchday
  const when = formatMatchday(fixture.scheduled_date)
  const round = roundLabel(fixture.round_type, fixture.leg)

  const subtitle = [tourney, matchday ? `Matchday ${matchday}` : null, when, round]
    .filter(Boolean)
    .join(' · ')

  const description =
    `${home} vs ${away}${subtitle ? ` — ${subtitle}.` : '.'} ` +
    'Team form, head-to-head record, and match preview on the official EFA site.'

  return ogMeta({
    title: `${home} vs ${away}`,
    description,
    path: `/fixtures/${id}`,
    subtitle: subtitle || undefined,
    badge: fixture.is_postponed
      ? 'POSTPONED'
      : fixture.round_type === 'final'
        ? (fixture.leg ?? 1) > 1 ? 'FINAL — LEG 2' : 'FINAL — LEG 1'
        : round || undefined,
    home: fixture.home_team?.logo_league_folder && fixture.home_team?.logo_team_slug
      ? { folder: fixture.home_team.logo_league_folder, slug: fixture.home_team.logo_team_slug }
      : undefined,
    away: fixture.away_team?.logo_league_folder && fixture.away_team?.logo_team_slug
      ? { folder: fixture.away_team.logo_league_folder, slug: fixture.away_team.logo_team_slug }
      : undefined,
  })
}

export default async function FixtureDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fixture with teams + tournament
  const fixture = await getFixture(supabase, id)

  if (!fixture) notFound()

  // Result + match stats
  const { data: _result } = await supabase
    .from('results')
    .select('*, match_stats(*)')
    .eq('fixture_id', id)
    .maybeSingle() as any
  const result = _result as any

  const matchStats = result?.match_stats ?? null

  // Pre-adjustment (pre-penalty) score for forfeit matches, where stored
  let adjustedScore: { home: number; away: number } | null = null
  if (result?.is_abandoned) {
    const { data: forfeitRows } = await supabase
      .from('forfeit_balances')
      .select('half_time_note')
      .eq('fixture_id', id)
    if (forfeitRows) {
      for (const row of forfeitRows) {
        const parsed = parseForfeitAdjusted(row?.half_time_note)
        if (parsed) { adjustedScore = parsed; break }
      }
    }
  }

  // Standings for both teams in this tournament
  const [homeStandingRaw, awayStandingRaw] = await Promise.all([
    supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', fixture.tournament_id)
      .eq('team_id', fixture.home_team_id)
      .maybeSingle() as any,
    supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', fixture.tournament_id)
      .eq('team_id', fixture.away_team_id)
      .maybeSingle() as any,
  ])
  const homeStanding = homeStandingRaw?.data as any
  const awayStanding = awayStandingRaw?.data as any

  // H2H last 5
  const { data: h2hFixtures } = await supabase
    .from('fixtures')
    .select('*, result:results(*)')
    .or(
      `and(home_team_id.eq.${fixture.home_team_id},away_team_id.eq.${fixture.away_team_id}),and(home_team_id.eq.${fixture.away_team_id},away_team_id.eq.${fixture.home_team_id})`
    )
    .not('status', 'eq', 'scheduled')
    .order('created_at', { ascending: false })
    .limit(5)

  const h2hList = (h2hFixtures ?? []).filter((f: any) => f.result)

  // H2H record for probability
  const h2hRecord = {
    homeWins: h2hList.filter(
      (f: any) =>
        f.home_team_id === fixture.home_team_id &&
        f.result.home_score > f.result.away_score
    ).length,
    awayWins: h2hList.filter(
      (f: any) =>
        f.home_team_id === fixture.away_team_id &&
        f.result.home_score > f.result.away_score
    ).length,
    draws: h2hList.filter(
      (f: any) => f.result.home_score === f.result.away_score
    ).length,
  }

  const probability = calculateProbability(homeStanding, awayStanding, h2hRecord)

  // Result confirmations
  const { data: _confirmations } = await supabase
    .from('result_confirmations')
    .select('*')
    .eq('fixture_id', id)
  const confirmations = (_confirmations ?? []) as any[]

  // Comments + profiles
  const { data: commentsRaw } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_user_id_fkey(*)')
    .eq('fixture_id', id)
    .order('created_at', { ascending: true })

  const comments = commentsRaw ?? []
  const topLevel = comments.filter((c: any) => !c.parent_id)
  const replies = comments.filter((c: any) => c.parent_id)

  // Waiting reports
  const { data: waitingReports } = await supabase
    .from('waiting_reports')
    .select('*')
    .eq('fixture_id', id)

  // Postpone requests (latest) so the page can show who requested and whether
  // the opponent accepted/declined — not just a bare "Postponement agreed".
  const { data: _postponeRequests } = await supabase
    .from('postpone_requests')
    .select(
      `*,
      requester:profiles!postpone_requests_requested_by_fkey(id, username),
      responder:profiles!postpone_requests_responded_by_fkey(id, username)`
    )
    .eq('fixture_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const postponeRequest = _postponeRequests as any

  // Reactions
  const { data: _reactionsRaw } = await supabase
    .from('reactions')
    .select('emoji, user_id')
    .eq('fixture_id', id)
  const reactionsRaw = (_reactionsRaw ?? []) as any[]

  const reactionCounts: Record<string, number> = {}
  const userReactionEmojis: string[] = []
  for (const r of reactionsRaw) {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1
    if (user && r.user_id === user.id) userReactionEmojis.push(r.emoji)
  }

  // DNA for both teams
  const { profiles: homeDNA } = await getTeamDNAFromDB(supabase as any, fixture.home_team_id)
  const { profiles: awayDNA } = await getTeamDNAFromDB(supabase as any, fixture.away_team_id)

  // Coach notes for this fixture
  const { data: coachNotesRaw } = await supabase
    .from('fixture_coach_notes')
    .select('*')
    .eq('fixture_id', id)
  const coachNotes = (coachNotesRaw ?? []) as any[]
  const homeCoachNote = coachNotes.find((n: any) => n.team_id === fixture.home_team_id) ?? null
  const awayCoachNote = coachNotes.find((n: any) => n.team_id === fixture.away_team_id) ?? null

  // Sibling fixture for 2-leg aggregate display
  let aggregateScore: { home: number; away: number } | null = null
  let penScore: { home: number; away: number } | null = null
  const siblingMd = getSiblingMatchday(fixture.matchday)
  if (siblingMd && ['qf', 'sf', 'final'].includes(fixture.round_type)) {
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

      // Penalty scores from this fixture's result
      if (result && (result as any).pen_home_score != null) {
        penScore = {
          home: (result as any).pen_home_score,
          away: (result as any).pen_away_score,
        }
      }
    }
  }

  // Derived state
  const homeTeam = (fixture as any).home_team
  const awayTeam = (fixture as any).away_team
  const tournament = (fixture as any).tournament
  const homeManager = homeTeam?.manager
  const awayManager = awayTeam?.manager
  const hasResult = !!result

  const isHomeManager = user?.id && homeManager?.id === user.id
  const isAwayManager = user?.id && awayManager?.id === user.id
  const isManager = isHomeManager || isAwayManager

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }
  const canSubmitMatch = isAdmin || isManager

  const { data: codeRow } = await supabase
    .from('match_codes')
    .select('code')
    .eq('fixture_id', id)
    .maybeSingle()
  const matchCode = codeRow?.code ?? null

  // Managers lose the ability to submit or change the score once the 7-day
  // grace period after the match day has lapsed; admins can always correct it.
  const fixtureDateKey = String((fixture as any)?.scheduled_date ?? '').slice(0, 10)
  const graceEnded = gracePeriodEnded(fixtureDateKey)
  const submitDisabled = canSubmitMatch && !isAdmin && graceEnded

  const conf1 = confirmations?.find((c) => c.submitted_by === homeManager?.id)
  const conf2 = confirmations?.find((c) => c.submitted_by === awayManager?.id)
  const bothSubmitted = conf1 && conf2
  const scoresMatch =
    bothSubmitted &&
    conf1.home_score === conf2.home_score &&
    conf1.away_score === conf2.away_score
  const confirmationStatus = hasResult
    ? 'finalised'
    : bothSubmitted
    ? scoresMatch
      ? 'awaiting_confirmation'
      : 'scores_mismatch'
    : 'pending'

  const data = {
    id,
    fixture,
    result,
    matchStats,
    adjustedScore,
    homeTeam,
    awayTeam,
    tournament,
    homeManager,
    awayManager,
    user,
    isHomeManager,
    isAwayManager,
    isManager,
    canSubmitMatch,
    submitDisabled,
    matchCode,
    probability,
    h2hList,
    homeDNA,
    awayDNA,
    homeStanding,
    awayStanding,
    confirmationStatus,
    conf1,
    conf2,
    hasResult,
    waitingReports,
    postponeRequest,
    reactionCounts,
    userReactionEmojis,
    comments,
    topLevel,
    replies,
    homeCoachNote,
    awayCoachNote,
    aggregateScore,
    penScore,
  }

  return <Shell data={data} />
}
