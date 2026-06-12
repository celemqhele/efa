import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getTeamDNA, buildTeamStatsMixed } from '@/lib/dna-engine'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('team_id')
  if (!teamId) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

  const db = await createAdminClient()

  const { data: team } = await db.from('teams').select('id, name').eq('id', teamId).single()
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const { data: fixtures } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, scheduled_date')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'confirmed')
    .order('scheduled_date', { ascending: false })
    .limit(5)

  if (!fixtures?.length) {
    return NextResponse.json({
      team: team.name,
      profiles: [],
      analysis: 'No confirmed fixtures found for this team.',
    })
  }

  const { data: results } = await db
    .from('results')
    .select('id, fixture_id, home_score, away_score')
    .in('fixture_id', fixtures.map((f: any) => f.id))

  if (!results?.length) {
    return NextResponse.json({
      team: team.name,
      profiles: [],
      analysis: 'Results found but no stats data available yet.',
    })
  }

  const resultIds = results.map((r: any) => r.id)
  const { data: statsList } = await db
    .from('match_stats')
    .select('*')
    .in('result_id', resultIds)

  if (!statsList?.length) {
    return NextResponse.json({
      team: team.name,
      profiles: [],
      analysis: 'No match stats recorded for this team\'s fixtures.',
    })
  }

  const resultMap: Record<string, any> = {}
  for (const r of results) resultMap[r.id] = r

  const games = statsList.flatMap((ms: any) => {
    const result = resultMap[ms.result_id]
    if (!result) return []
    const fixture = fixtures.find((f: any) => f.id === result.fixture_id)
    if (!fixture) return []
    const isHome = (fixture as any).home_team_id === teamId
    return [{ stats: ms, isHome, goalsAgainst: isHome ? result.away_score : result.home_score }]
  })

  if (games.length < 1) {
    return NextResponse.json({
      team: team.name,
      profiles: [],
      analysis: 'Insufficient match data to analyze DNA.',
    })
  }

  const dnaProfiles = getTeamDNA(buildTeamStatsMixed(games))

  const gameSummaries = games.map((g: any) => ({
    possession: g.isHome ? g.stats.home_possession : g.stats.away_possession,
    shots: g.isHome ? g.stats.home_shots : g.stats.away_shots,
    shotsOnTarget: g.isHome ? g.stats.home_shots_on_target : g.stats.away_shots_on_target,
    passes: g.isHome ? g.stats.home_passes : g.stats.away_passes,
    tackles: g.isHome ? g.stats.home_tackles : g.stats.away_tackles,
    goalsAgainst: g.goalsAgainst,
  }))

  const profileExplanations = dnaProfiles.map((p: any) => ({
    label: p.label,
    level: p.level,
    score: p.score,
    iconName: p.iconName,
    color: p.color,
  }))

  return NextResponse.json({
    team: team.name,
    teamId,
    profiles: profileExplanations,
    gamesAnalyzed: games.length,
    gameSummaries,
  })
}
