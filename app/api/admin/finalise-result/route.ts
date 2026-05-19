import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  generateTBCKnockouts,
  fillFinalSlot,
  awardTrophy,
} from '@/lib/tournament-progression'
import type { Database } from '@/lib/supabase/types'

type MatchStatsInsert = Database['public']['Tables']['match_stats']['Insert']

// ─── Standings helpers ────────────────────────────────────────────────────────

async function updateLeagueStandings(
  db: any,
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
) {
  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const draw = homeScore === awayScore

  const [{ data: hr }, { data: ar }] = await Promise.all([
    db.from('standings').select('*').eq('tournament_id', tournamentId).eq('team_id', homeTeamId).single(),
    db.from('standings').select('*').eq('tournament_id', tournamentId).eq('team_id', awayTeamId).single(),
  ])

  await Promise.all([
    db.from('standings').update({
      played: (hr?.played ?? 0) + 1,
      wins: (hr?.wins ?? 0) + (homeWin ? 1 : 0),
      draws: (hr?.draws ?? 0) + (draw ? 1 : 0),
      losses: (hr?.losses ?? 0) + (awayWin ? 1 : 0),
      goals_for: (hr?.goals_for ?? 0) + homeScore,
      goals_against: (hr?.goals_against ?? 0) + awayScore,
      points: (hr?.points ?? 0) + (homeWin ? 3 : draw ? 1 : 0),
      form: (String(hr?.form ?? '') + (homeWin ? 'W' : draw ? 'D' : 'L')).slice(-5),
      unbeaten_run: homeWin || draw ? (hr?.unbeaten_run ?? 0) + 1 : 0,
      clean_sheets: (hr?.clean_sheets ?? 0) + (awayScore === 0 ? 1 : 0),
    }).eq('tournament_id', tournamentId).eq('team_id', homeTeamId),

    db.from('standings').update({
      played: (ar?.played ?? 0) + 1,
      wins: (ar?.wins ?? 0) + (awayWin ? 1 : 0),
      draws: (ar?.draws ?? 0) + (draw ? 1 : 0),
      losses: (ar?.losses ?? 0) + (homeWin ? 1 : 0),
      goals_for: (ar?.goals_for ?? 0) + awayScore,
      goals_against: (ar?.goals_against ?? 0) + homeScore,
      points: (ar?.points ?? 0) + (awayWin ? 3 : draw ? 1 : 0),
      form: (String(ar?.form ?? '') + (awayWin ? 'W' : draw ? 'D' : 'L')).slice(-5),
      unbeaten_run: awayWin || draw ? (ar?.unbeaten_run ?? 0) + 1 : 0,
      clean_sheets: (ar?.clean_sheets ?? 0) + (homeScore === 0 ? 1 : 0),
    }).eq('tournament_id', tournamentId).eq('team_id', awayTeamId),
  ])
}

async function updateGroupStandings(
  db: any,
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
) {
  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const draw = homeScore === awayScore

  const [{ data: hr }, { data: ar }] = await Promise.all([
    db.from('group_standings').select('*').eq('tournament_id', tournamentId).eq('team_id', homeTeamId).single(),
    db.from('group_standings').select('*').eq('tournament_id', tournamentId).eq('team_id', awayTeamId).single(),
  ])

  await Promise.all([
    db.from('group_standings').update({
      played: (hr?.played ?? 0) + 1,
      wins: (hr?.wins ?? 0) + (homeWin ? 1 : 0),
      draws: (hr?.draws ?? 0) + (draw ? 1 : 0),
      losses: (hr?.losses ?? 0) + (awayWin ? 1 : 0),
      goals_for: (hr?.goals_for ?? 0) + homeScore,
      goals_against: (hr?.goals_against ?? 0) + awayScore,
      points: (hr?.points ?? 0) + (homeWin ? 3 : draw ? 1 : 0),
    }).eq('tournament_id', tournamentId).eq('team_id', homeTeamId),

    db.from('group_standings').update({
      played: (ar?.played ?? 0) + 1,
      wins: (ar?.wins ?? 0) + (awayWin ? 1 : 0),
      draws: (ar?.draws ?? 0) + (draw ? 1 : 0),
      losses: (ar?.losses ?? 0) + (homeWin ? 1 : 0),
      goals_for: (ar?.goals_for ?? 0) + awayScore,
      goals_against: (ar?.goals_against ?? 0) + homeScore,
      points: (ar?.points ?? 0) + (awayWin ? 3 : draw ? 1 : 0),
    }).eq('tournament_id', tournamentId).eq('team_id', awayTeamId),
  ])
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const { data: fixtureRaw, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select(`
      id,
      tournament_id,
      round_type,
      group_name,
      matchday,
      home_team_id,
      away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, manager_id, name),
      away_team:teams!fixtures_away_team_id_fkey(id, manager_id, name)
    `)
    .eq('id', fixture_id)
    .single()

  if (fixtureError || !fixtureRaw) {
    return Response.json({ error: 'Fixture not found' }, { status: 404 })
  }

  const fixture = fixtureRaw as any

  const homeTeam = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const awayTeam = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team

  if (homeTeam?.manager_id === user.id || awayTeam?.manager_id === user.id) {
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

  // Insert match stats
  if (stats && Object.keys(stats).length > 0) {
    const { error: statsError } = await adminSupabase
      .from('match_stats')
      .insert({ result_id: result.id, ...stats })
    if (statsError) console.error('Failed to insert match stats:', statsError.message)
  }

  // Mark fixture confirmed
  await adminSupabase
    .from('fixtures')
    .update({ status: 'confirmed' })
    .eq('id', fixture_id)

  // ── Standings + tournament progression (non-fatal) ────────────────────────
  try {
    const roundType: string = fixture.round_type ?? ''
    const tournamentId: string = fixture.tournament_id ?? ''
    const homeTeamId: string | null = fixture.home_team_id ?? null
    const awayTeamId: string | null = fixture.away_team_id ?? null

    const { data: tournament } = await adminSupabase
      .from('tournaments')
      .select('id, type')
      .eq('id', tournamentId)
      .single()

    const tType: string = (tournament as any)?.type ?? ''

    // Update standings
    if (roundType === 'league' && homeTeamId && awayTeamId) {
      await updateLeagueStandings(adminSupabase, tournamentId, homeTeamId, awayTeamId, home_score, away_score)
    } else if (roundType === 'group' && homeTeamId && awayTeamId) {
      await updateGroupStandings(adminSupabase, tournamentId, homeTeamId, awayTeamId, home_score, away_score)
    }

    // Tournament progression
    if (roundType === 'group' && (tType === 'ucl' || tType === 'europa')) {
      const { count: pendingGroups } = await adminSupabase
        .from('fixtures')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
        .eq('round_type', 'group')
        .neq('status', 'confirmed')

      if (pendingGroups === 0) {
        await generateTBCKnockouts(adminSupabase, tournamentId)
      }
    } else if (roundType === 'sf') {
      await fillFinalSlot(
        adminSupabase,
        tournamentId,
        fixture_id,
        home_score,
        away_score,
        homeTeamId,
        awayTeamId
      )
    } else if (roundType === 'final') {
      await awardTrophy(adminSupabase, tournamentId, home_score, away_score, homeTeamId, awayTeamId)
    }
  } catch (err) {
    console.error('[finalise-result] progression error:', err)
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const homeTeamObj = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const awayTeamObj = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team

  const notifications: Database['public']['Tables']['notifications']['Insert'][] = []

  if (homeTeamObj?.manager_id) {
    notifications.push({
      user_id: homeTeamObj.manager_id,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: `${homeTeamObj.name ?? 'Home'} ${home_score}–${away_score} ${awayTeamObj?.name ?? 'Away'}`,
      data: { fixture_id, home_score: String(home_score), away_score: String(away_score) },
    })
  }

  if (awayTeamObj?.manager_id) {
    notifications.push({
      user_id: awayTeamObj.manager_id,
      type: 'result_confirmed',
      title: 'Result Confirmed',
      body: `${homeTeamObj?.name ?? 'Home'} ${home_score}–${away_score} ${awayTeamObj.name ?? 'Away'}`,
      data: { fixture_id, home_score: String(home_score), away_score: String(away_score) },
    })
  }

  if (notifications.length > 0) {
    await adminSupabase.from('notifications').insert(notifications)
  }

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
