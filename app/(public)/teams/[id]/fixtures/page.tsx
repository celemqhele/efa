import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TeamFixturesPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // Get the team details
  const { data: _team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single() as any
  const team = _team as any

  if (!team) notFound()

  // Resolve all sibling team IDs for this club (same slug across phases)
  const { data: siblingTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('logo_league_folder', team.logo_league_folder)
    .eq('logo_team_slug', team.logo_team_slug)
  
  const siblingIdsAll = (siblingTeams ?? []).map((t: any) => t.id)
  const siblingIds = siblingIdsAll.length > 0 ? siblingIdsAll : [id]
  const teamOrFilter = siblingIds
    .flatMap((tid) => [`home_team_id.eq.${tid}`, `away_team_id.eq.${tid}`])
    .join(',')

  // Fetch all fixtures for this team
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg, home_team_id, away_team_id,
      tournament:tournaments(id, name, type, status),
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .or(teamOrFilter)
    .order('scheduled_date', { ascending: false })

  const fixtureIds = (allFixtures ?? []).map((f: any) => f.id)
  const { data: resultsData } = fixtureIds.length > 0
    ? await supabase
        .from('results')
        .select('id, fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, { id: string; home_score: number; away_score: number }> = {}
  for (const r of resultsData ?? []) {
    resultsByFixture[(r as any).fixture_id] = r as any
  }

  // Split into upcoming and past
  const upcoming = (allFixtures ?? [])
    .filter((f: any) => f.status === 'scheduled' || f.status === 'awaiting_confirmation')
    .reverse()
  
  const past = (allFixtures ?? [])
    .filter((f: any) => f.status !== 'scheduled' && f.status !== 'awaiting_confirmation')

  const data = { team, siblingIds, upcoming, past, resultsByFixture }

  return <Shell data={data} />
}
