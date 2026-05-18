import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type MatchStatsInsert = Database['public']['Tables']['match_stats']['Insert']

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    fixture_id: string
    home_score: number
    away_score: number
    override_reason?: string
    screenshot_url?: string
    stats?: Partial<Omit<MatchStatsInsert, 'id' | 'result_id'>>
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fixture_id, home_score, away_score, override_reason, screenshot_url, stats } = body

  if (!fixture_id || home_score == null || away_score == null) {
    return Response.json(
      { error: 'fixture_id, home_score and away_score are required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()

  // Fetch fixture with team manager info to check conflict of interest
  const { data: fixture, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, manager_id, name),
      away_team:teams!fixtures_away_team_id_fkey(id, manager_id, name)
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

  // Conflict of interest check: admin must not be one of the players
  const isHomeManager = homeTeam?.manager_id === user.id
  const isAwayManager = awayTeam?.manager_id === user.id

  if (isHomeManager || isAwayManager) {
    return Response.json(
      { error: 'A different admin must finalise this result.' },
      { status: 403 }
    )
  }

  // Insert result
  const { data: result, error: resultError } = await adminSupabase
    .from('results')
    .insert({
      fixture_id,
      home_score,
      away_score,
      finalised_by: user.id,
      screenshot_url: screenshot_url ?? null,
      override_reason: override_reason ?? null,
    })
    .select('id')
    .single()

  if (resultError || !result) {
    return Response.json({ error: resultError?.message ?? 'Failed to insert result' }, { status: 500 })
  }

  // Insert match stats if provided
  if (stats && Object.keys(stats).length > 0) {
    const { error: statsError } = await adminSupabase
      .from('match_stats')
      .insert({ result_id: result.id, ...stats })

    if (statsError) {
      // Non-fatal: log but continue
      console.error('Failed to insert match stats:', statsError.message)
    }
  }

  // Update fixture status to confirmed
  await adminSupabase
    .from('fixtures')
    .update({ status: 'confirmed' })
    .eq('id', fixture_id)

  // Notify both team managers
  const notifications: Database['public']['Tables']['notifications']['Insert'][] = []

  if (homeTeam?.manager_id) {
    notifications.push({
      user_id: homeTeam.manager_id,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: `${homeTeam.name ?? 'Home'} ${home_score}–${away_score} ${awayTeam?.name ?? 'Away'}`,
      data: { fixture_id, home_score: String(home_score), away_score: String(away_score) },
    })
  }

  if (awayTeam?.manager_id) {
    notifications.push({
      user_id: awayTeam.manager_id,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: `${homeTeam?.name ?? 'Home'} ${home_score}–${away_score} ${awayTeam.name ?? 'Away'}`,
      data: { fixture_id, home_score: String(home_score), away_score: String(away_score) },
    })
  }

  if (notifications.length > 0) {
    await adminSupabase.from('notifications').insert(notifications)
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'finalise_result',
    target_type: 'fixture',
    target_id: fixture_id,
    details: {
      home_score,
      away_score,
      result_id: result.id,
      override_reason: override_reason ?? null,
    },
  })

  return Response.json({ success: true, result_id: result.id })
}
