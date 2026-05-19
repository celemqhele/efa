import { createClient } from '@/lib/supabase/server'
import ResultSubmitClient from './ResultSubmitClient'

export const revalidate = 0

export default async function ResultSubmitPage({
  searchParams,
}: {
  searchParams: { fixture?: string }
}) {
  const supabase = await createClient()

  // Fixtures needing admin action
  const { data: pendingFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, tournament_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments!fixtures_tournament_id_fkey(id, name, type)
    `)
    .or('status.eq.awaiting_confirmation,status.eq.scheduled')
    .order('scheduled_date', { ascending: true })

  // Filter: awaiting_confirmation OR has a result_confirmation already
  const { data: allConfirmations } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score, submitted_by, confirmed_at')

  const confirmationsByFixture: Record<string, typeof allConfirmations> = {}
  for (const c of allConfirmations ?? []) {
    if (!confirmationsByFixture[c.fixture_id]) confirmationsByFixture[c.fixture_id] = []
    confirmationsByFixture[c.fixture_id]!.push(c)
  }

  // Show all scheduled and awaiting_confirmation fixtures (admin can submit for any)
  const relevantFixtures = pendingFixtures ?? []

  // Team name mappings for OCR
  const { data: teamNameMappings } = await supabase
    .from('team_name_mappings')
    .select('id, ocr_name, team_id')

  // All teams for mapping UI
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit Result</h1>
        <p className="text-slate-400 text-sm mt-1">
          Finalise fixture results via screenshot OCR or manual entry.
        </p>
      </div>

      <ResultSubmitClient
        pendingFixtures={relevantFixtures as any}
        confirmationsByFixture={confirmationsByFixture as any}
        teamNameMappings={teamNameMappings ?? []}
        allTeams={allTeams ?? []}
        defaultFixtureId={searchParams.fixture}
      />
    </div>
  )
}
