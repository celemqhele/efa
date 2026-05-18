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

  // Check SAST time window: 13:00–14:05 SAST = 11:00–12:05 UTC
  const nowUtc = new Date()
  const utcHour = nowUtc.getUTCHours()
  const utcMinute = nowUtc.getUTCMinutes()
  const totalMinutesUtc = utcHour * 60 + utcMinute
  const windowStart = 11 * 60       // 11:00 UTC
  const windowEnd = 12 * 60 + 5     // 12:05 UTC

  if (totalMinutesUtc < windowStart || totalMinutesUtc > windowEnd) {
    return Response.json(
      { error: 'Waiting reports can only be submitted between 13:00 and 14:05 SAST' },
      { status: 400 }
    )
  }

  let body: { fixture_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fixture_id } = body

  if (!fixture_id) {
    return Response.json({ error: 'fixture_id is required' }, { status: 400 })
  }

  // Fetch fixture to find which team the user manages
  const { data: fixture, error: fixtureError } = await supabase
    .from('fixtures')
    .select(`
      id,
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

  const homeTeam = Array.isArray(fixture.home_team)
    ? fixture.home_team[0]
    : fixture.home_team
  const awayTeam = Array.isArray(fixture.away_team)
    ? fixture.away_team[0]
    : fixture.away_team

  let reportingTeamId: string | null = null

  if (homeTeam?.manager_id === user.id) {
    reportingTeamId = fixture.home_team_id
  } else if (awayTeam?.manager_id === user.id) {
    reportingTeamId = fixture.away_team_id
  }

  if (!reportingTeamId) {
    return Response.json(
      { error: 'You are not a manager of either team in this fixture' },
      { status: 403 }
    )
  }

  // Upsert waiting report (idempotent per fixture + team)
  const { error: upsertError } = await supabase
    .from('waiting_reports')
    .upsert(
      {
        fixture_id,
        reported_by_team_id: reportingTeamId,
      },
      { onConflict: 'fixture_id,reported_by_team_id' }
    )

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500 })
  }

  return Response.json({ reported: true })
}
