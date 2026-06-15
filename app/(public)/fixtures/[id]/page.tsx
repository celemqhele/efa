import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateProbability } from '@/lib/probability-engine'
import { getTeamDNAFromDB } from '@/lib/dna-engine'
import Shell from './_shell'

export const revalidate = 30
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FixtureDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fixture with teams + tournament
  const { data: _fixture } = await supabase
    .from('fixtures')
    .select(
      `*,
      tournament:tournaments(*),
      home_team:teams!fixtures_home_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*)),
      away_team:teams!fixtures_away_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*))`
    )
    .eq('id', id)
    .single() as any
  const fixture = _fixture as any

  if (!fixture) notFound()

  // Result + match stats
  const { data: _result } = await supabase
    .from('results')
    .select('*, match_stats(*)')
    .eq('fixture_id', id)
    .maybeSingle() as any
  const result = _result as any

  const matchStats = result?.match_stats ?? null

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
    homeTeam,
    awayTeam,
    tournament,
    homeManager,
    awayManager,
    user,
    isHomeManager,
    isAwayManager,
    isManager,
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
    reactionCounts,
    userReactionEmojis,
    comments,
    topLevel,
    replies,
    homeCoachNote,
    awayCoachNote,
  }

  return <Shell data={data} />
}
