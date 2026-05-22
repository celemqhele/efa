import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  generateTBCKnockouts,
  fillFinalSlot,
  awardTrophy,
} from '@/lib/tournament-progression'
import type { Database } from '@/lib/supabase/types'

type MatchStatsInsert = Database['public']['Tables']['match_stats']['Insert']

// ─── Auto-sack helper ─────────────────────────────────────────────────────────

async function checkAndAutoSack(
  db: any,
  teamId: string,
  adminUserId: string,
  threshold = 4
): Promise<void> {
  const { data: recent } = await db
    .from('fixtures')
    .select(`
      id, home_team_id, away_team_id,
      results(home_score, away_score, override_reason)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('status', 'confirmed')
    .order('scheduled_date', { ascending: false })
    .limit(threshold)

  if (!recent || recent.length < threshold) return

  const allAbsent = (recent as any[]).every((f) => {
    const result = Array.isArray(f.results) ? f.results[0] : f.results
    if (!result?.override_reason) return false
    const reason: string = (result.override_reason as string).toLowerCase()
    if (!reason.includes('absent')) return false
    if (reason.includes('both')) return true
    const isHome = f.home_team_id === teamId
    return isHome
      ? result.home_score === 0 && result.away_score === 3
      : result.home_score === 3 && result.away_score === 0
  })

  if (!allAbsent) return

  const { data: team } = await db
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', teamId)
    .single()

  if (!team?.manager_id) return

  const sackUserId = team.manager_id

  let allClubIds: string[] = [teamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await db
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', teamId)
    allClubIds = [teamId, ...(siblings ?? []).map((s: any) => s.id)]
  }

  await db.from('teams').update({ manager_id: null }).in('id', allClubIds)

  await db
    .from('manager_tenures' as any)
    .update({ ended_at: new Date().toISOString() })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  await db.from('notifications').insert({
    user_id: sackUserId,
    type: 'manager_sacked',
    title: 'Automatically Removed as Manager',
    body: `You have been removed as manager of ${team.name} after ${threshold} consecutive absences.`,
    data: { team_id: teamId, team_name: team.name, reason: 'consecutive_absences' },
  })

  await db.from('audit_log').insert({
    admin_id: adminUserId,
    action: 'auto_sack_manager',
    target_type: 'team',
    target_id: teamId,
    details: {
      team_name: team.name,
      sacked_user_id: sackUserId,
      reason: `${threshold} consecutive absences`,
    },
  })
}

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
    db.from('standings').select('*').eq('tournament_id', tournamentId).eq('team_id', homeTeamId).maybeSingle(),
    db.from('standings').select('*').eq('tournament_id', tournamentId).eq('team_id', awayTeamId).maybeSingle(),
  ])

  await Promise.all([
    db.from('standings').upsert({
      tournament_id: tournamentId,
      team_id: homeTeamId,
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
    }, { onConflict: 'tournament_id,team_id' }),

    db.from('standings').upsert({
      tournament_id: tournamentId,
      team_id: awayTeamId,
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
    }, { onConflict: 'tournament_id,team_id' }),
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
    db.from('group_standings').select('*').eq('tournament_id', tournamentId).eq('team_id', homeTeamId).maybeSingle(),
    db.from('group_standings').select('*').eq('tournament_id', tournamentId).eq('team_id', awayTeamId).maybeSingle(),
  ])

  await Promise.all([
    db.from('group_standings').upsert({
      tournament_id: tournamentId,
      team_id: homeTeamId,
      played: (hr?.played ?? 0) + 1,
      wins: (hr?.wins ?? 0) + (homeWin ? 1 : 0),
      draws: (hr?.draws ?? 0) + (draw ? 1 : 0),
      losses: (hr?.losses ?? 0) + (awayWin ? 1 : 0),
      goals_for: (hr?.goals_for ?? 0) + homeScore,
      goals_against: (hr?.goals_against ?? 0) + awayScore,
      points: (hr?.points ?? 0) + (homeWin ? 3 : draw ? 1 : 0),
    }, { onConflict: 'tournament_id,team_id' }),

    db.from('group_standings').upsert({
      tournament_id: tournamentId,
      team_id: awayTeamId,
      played: (ar?.played ?? 0) + 1,
      wins: (ar?.wins ?? 0) + (awayWin ? 1 : 0),
      draws: (ar?.draws ?? 0) + (draw ? 1 : 0),
      losses: (ar?.losses ?? 0) + (homeWin ? 1 : 0),
      goals_for: (ar?.goals_for ?? 0) + awayScore,
      goals_against: (ar?.goals_against ?? 0) + homeScore,
      points: (ar?.points ?? 0) + (awayWin ? 3 : draw ? 1 : 0),
    }, { onConflict: 'tournament_id,team_id' }),
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
    home_absent?: boolean
    away_absent?: boolean
    override_reason?: string
    screenshot_url?: string
    stats?: Partial<Omit<MatchStatsInsert, 'id' | 'result_id'>>
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fixture_id, override_reason, screenshot_url, stats } = body
  const home_absent = body.home_absent ?? false
  const away_absent = body.away_absent ?? false
  const bothAbsent = home_absent && away_absent

  let home_score: number
  let away_score: number
  if (bothAbsent) {
    home_score = 0
    away_score = 0
  } else if (home_absent) {
    home_score = 0
    away_score = 3
  } else if (away_absent) {
    home_score = 3
    away_score = 0
  } else {
    home_score = body.home_score
    away_score = body.away_score
  }

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
      matchday,
      home_team_id,
      away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, manager_id, name),
      away_team:teams!fixtures_away_team_id_fkey(id, manager_id, name)
    `)
    .eq('id', fixture_id)
    .single()

  if (fixtureError || !fixtureRaw) {
    return Response.json({ error: fixtureError?.message ?? 'Fixture not found' }, { status: 404 })
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

  const effectiveOverrideReason = bothAbsent
    ? 'Both teams absent — result void (0–0, no points)'
    : home_absent
    ? `${(homeTeam as any)?.name ?? 'Home team'} absent — forfeit (0–3)`
    : away_absent
    ? `${(awayTeam as any)?.name ?? 'Away team'} absent — forfeit (3–0)`
    : (override_reason ?? null)

  // ── Upsert result (handles re-submissions without duplicate key error) ──────
  const { data: result, error: resultError } = await adminSupabase
    .from('results')
    .upsert(
      {
        fixture_id,
        home_score,
        away_score,
        finalised_by: user.id,
        screenshot_url: screenshot_url ?? null,
        override_reason: effectiveOverrideReason,
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()

  if (resultError || !result) {
    return Response.json({ error: resultError?.message ?? 'Failed to upsert result' }, { status: 500 })
  }

  // ── Match stats: wipe old rows for this result then insert fresh ────────────
  if (stats && Object.keys(stats).length > 0) {
    await adminSupabase.from('match_stats').delete().eq('result_id', result.id)
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

  // ── Absent team tracking ──────────────────────────────────────────────────
  try {
    const absentTeamIds: string[] = []
    if (home_absent && fixture.home_team_id) absentTeamIds.push(fixture.home_team_id)
    if (away_absent && fixture.away_team_id) absentTeamIds.push(fixture.away_team_id)

    for (const tid of absentTeamIds) {
      const { data: teamRow } = await adminSupabase
        .from('teams').select('abandon_count').eq('id', tid).single()
      await adminSupabase
        .from('teams')
        .update({ abandon_count: (teamRow?.abandon_count ?? 0) + 1 })
        .eq('id', tid)

      await checkAndAutoSack(adminSupabase, tid, user.id)
    }
  } catch (err) {
    console.error('[finalise-result] absence tracking error:', err)
  }

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

    if (!bothAbsent) {
      if (roundType === 'league' && homeTeamId && awayTeamId) {
        await updateLeagueStandings(adminSupabase, tournamentId, homeTeamId, awayTeamId, home_score, away_score)
      } else if (roundType === 'group' && homeTeamId && awayTeamId) {
        await updateGroupStandings(adminSupabase, tournamentId, homeTeamId, awayTeamId, home_score, away_score)
      }
    }

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
      if (bothAbsent) {
        const { data: allSFs } = await adminSupabase
          .from('fixtures')
          .select('home_team_id, away_team_id')
          .eq('tournament_id', tournamentId)
          .eq('round_type', 'sf')

        const sfTeamIds = new Set<string>(
          (allSFs ?? []).flatMap((f: any) => [f.home_team_id, f.away_team_id]).filter(Boolean)
        )

        const { data: groupStandings } = await adminSupabase
          .from('group_standings')
          .select('team_id, points, goals_for, goals_against')
          .eq('tournament_id', tournamentId)

        const eliminated = (groupStandings ?? []).filter((s: any) => !sfTeamIds.has(s.team_id))
        const sortedElim = [...eliminated].sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points
          const gdA = (a.goals_for ?? 0) - (a.goals_against ?? 0)
          const gdB = (b.goals_for ?? 0) - (b.goals_against ?? 0)
          if (gdB !== gdA) return gdB - gdA
          return (b.goals_for ?? 0) - (a.goals_for ?? 0)
        })
        const bestEliminated = sortedElim[0]

        if (bestEliminated) {
          await fillFinalSlot(adminSupabase, tournamentId, fixture_id, 1, 0, bestEliminated.team_id, null)
        }
      } else {
        await fillFinalSlot(
          adminSupabase,
          tournamentId,
          fixture_id,
          home_score,
          away_score,
          homeTeamId,
          awayTeamId
        )
      }
    } else if (roundType === 'final') {
      if (!bothAbsent) {
        await awardTrophy(adminSupabase, tournamentId, home_score, away_score, homeTeamId, awayTeamId)
      }
    }
  } catch (err) {
    console.error('[finalise-result] progression error:', err)
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  const homeTeamObj = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  const awayTeamObj = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team

  const notifications: Database['public']['Tables']['notifications']['Insert'][] = []

  const notifTitle = bothAbsent
    ? 'Match Voided'
    : home_absent || away_absent
    ? 'Forfeit Recorded'
    : 'Result Confirmed'

  const notifBody = `${homeTeamObj?.name ?? 'Home'} ${home_score}–${away_score} ${awayTeamObj?.name ?? 'Away'}${
    bothAbsent
      ? ' (both absent — no points)'
      : home_absent
      ? ` (${homeTeamObj?.name ?? 'Home'} absent)`
      : away_absent
      ? ` (${awayTeamObj?.name ?? 'Away'} absent)`
      : ''
  }`

  if (homeTeamObj?.manager_id) {
    notifications.push({
      user_id: homeTeamObj.manager_id,
      type: 'result_confirmed',
      title: notifTitle,
      body: notifBody,
      data: { fixture_id, home_score: String(home_score), away_score: String(away_score) },
    })
  }

  if (awayTeamObj?.manager_id) {
    notifications.push({
      user_id: awayTeamObj.manager_id,
      type: 'result_confirmed',
      title: notifTitle,
      body: notifBody,
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
      override_reason: effectiveOverrideReason,
      home_absent,
      away_absent,
    },
  })

  return Response.json({ success: true, result_id: result.id })
}
