import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const revalidate = 0

export default async function ResultSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>
}) {
  const supabase = await createClient()

  const resolvedSearchParams = await searchParams

  const selectFixture = `
    id, matchday, round_type, leg, scheduled_date, status, tournament_id,
    home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager_id),
    away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager_id),
    tournament:tournaments!fixtures_tournament_id_fkey(id, name, type)
  `

  const { data: pendingFixtures } = await supabase
    .from('fixtures')
    .select(selectFixture)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .order('scheduled_date', { ascending: true })

  const { data: completedFixtures } = await supabase
    .from('fixtures')
    .select(selectFixture)
    .eq('status', 'confirmed')
    .order('scheduled_date', { ascending: false })
    .limit(500)

  const { data: allConfirmations } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score, submitted_by, confirmed_at')

  const confirmationsByFixture: Record<string, any[]> = {}
  for (const c of (allConfirmations ?? []) as any[]) {
    if (!confirmationsByFixture[c.fixture_id]) confirmationsByFixture[c.fixture_id] = []
    confirmationsByFixture[c.fixture_id]!.push(c)
  }

  const relevantFixtures = [...(pendingFixtures ?? []), ...(completedFixtures ?? [])]

  const { data: teamNameMappings } = await supabase
    .from('team_name_mappings')
    .select('id, ocr_name, team_id')

  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .order('name', { ascending: true })

  return (
    <Shell
      data={{
        pendingFixtures: relevantFixtures as any,
        confirmationsByFixture: confirmationsByFixture as any,
        teamNameMappings: teamNameMappings ?? [],
        allTeams: allTeams ?? [],
        defaultFixtureId: resolvedSearchParams.fixture,
      }}
    />
  )
}
