import { createClient, createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'
import { notifyBackdoorDecision } from '@/lib/backdoor-notify'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const submissionIds: string[] = body?.submissionIds

  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return Response.json(
      { error: 'submissionIds (non-empty array) required' },
      { status: 400 }
    )
  }

  const db = await createAdminClient()

  const { data: submissions, error: subErr } = await db
    .from('backdoor_submissions')
    .select('id, fixture_id, side_claimed')
    .in('id', submissionIds)

  if (subErr) return Response.json({ error: subErr.message }, { status: 500 })
  if (!submissions?.length) return Response.json({ error: 'Submissions not found' }, { status: 404 })

  const fixtureId = submissions[0].fixture_id
  if (submissions.some((s: any) => s.fixture_id !== fixtureId)) {
    return Response.json({ error: 'Submissions span multiple fixtures' }, { status: 400 })
  }

  const { data: fixture, error: fxErr } = await db
    .from('fixtures')
    .select('id, tournament_id, round_type, status, home_team_id, away_team_id')
    .eq('id', fixtureId)
    .single()

  if (fxErr || !fixture) return Response.json({ error: 'Fixture not found' }, { status: 404 })

  const isOverride = ['confirmed', 'awaiting_confirmation', 'completed'].includes(fixture.status ?? '')

  let homeScore = 0
  let awayScore = 0
  if (submissions.length === 2) {
    homeScore = 0; awayScore = 0
  } else if (submissions.length === 1) {
    if (submissions[0].side_claimed === 'home') {
      homeScore = 0; awayScore = 3
    } else {
      homeScore = 3; awayScore = 0
    }
  }

  const { error: rcErr } = await db.from('result_confirmations').insert({
    fixture_id: fixtureId,
    home_score: homeScore,
    away_score: awayScore,
    submitted_by: user.id,
  })
  if (rcErr) return Response.json({ error: rcErr.message }, { status: 500 })

  const { error: resErr } = await db.from('results').upsert({
    fixture_id: fixtureId,
    home_score: homeScore,
    away_score: awayScore,
    finalised_by: user.id,
    ...(isOverride ? { override_reason: 'backdoor override' } : {}),
  }, { onConflict: 'fixture_id' })
  if (resErr) return Response.json({ error: resErr.message }, { status: 500 })

  const { error: fxUpdateErr } = await db
    .from('fixtures')
    .update({ status: 'confirmed' })
    .eq('id', fixtureId)
  if (fxUpdateErr) return Response.json({ error: fxUpdateErr.message }, { status: 500 })

  await db
    .from('backdoor_submissions')
    .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .in('id', submissionIds)

  // Void any OTHER pending submissions for the same fixture — approving one
  // writes a result that confirms the fixture, so a counterpart submission
  // must not be left reviewable/approvable afterwards.
  await db
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', fixtureId)
    .eq('status', 'pending')
    .not('id', 'in', `(${submissionIds.join(',')})`)

  if (fixture.tournament_id) {
    try { await recalculateStandings(fixture.tournament_id) } catch (e) {}
  }

  if (
    fixture.tournament_id &&
    ['r16', 'qf', 'sf', 'final'].includes(fixture.round_type ?? '')
  ) {
    try {
      await advanceWinner(
        db,
        fixture.tournament_id,
        fixtureId,
        homeScore,
        awayScore,
        fixture.home_team_id ?? null,
        fixture.away_team_id ?? null
      )
    } catch (e) {
      console.error('[backdoor-approve] knockout progression failed:', e)
    }
  }

  try {
    await notifyBackdoorDecision(db, submissionIds, 'approved')
  } catch (e) {}

  return Response.json({
    success: true,
    fixture_id: fixtureId,
    home_score: homeScore,
    away_score: awayScore,
  })
}
