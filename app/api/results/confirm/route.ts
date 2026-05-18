import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { fixture_id: string; home_score: number; away_score: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fixture_id, home_score, away_score } = body

  if (!fixture_id || home_score == null || away_score == null) {
    return Response.json(
      { error: 'fixture_id, home_score and away_score are required' },
      { status: 400 }
    )
  }

  // Fetch fixture with home and away team manager info
  const { data: fixture, error: fixtureError } = await supabase
    .from('fixtures')
    .select(`
      id,
      status,
      home_team_id,
      away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, manager_id)
    `)
    .eq('id', fixture_id)
    .single()

  if (fixtureError || !fixture) {
    return Response.json({ error: 'Fixture not found' }, { status: 404 })
  }

  // Check user manages one of the teams in this fixture
  const homeTeam = Array.isArray(fixture.home_team)
    ? fixture.home_team[0]
    : fixture.home_team
  const awayTeam = Array.isArray(fixture.away_team)
    ? fixture.away_team[0]
    : fixture.away_team

  const isHomeManager = homeTeam?.manager_id === user.id
  const isAwayManager = awayTeam?.manager_id === user.id

  if (!isHomeManager && !isAwayManager) {
    return Response.json(
      { error: 'You are not a manager of either team in this fixture' },
      { status: 403 }
    )
  }

  // Upsert confirmation (on conflict with fixture_id + submitted_by, update scores)
  const { error: insertError } = await supabase
    .from('result_confirmations')
    .upsert(
      {
        fixture_id,
        submitted_by: user.id,
        home_score,
        away_score,
      },
      { onConflict: 'fixture_id,submitted_by' }
    )

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  return Response.json({ confirmed: true })
}
