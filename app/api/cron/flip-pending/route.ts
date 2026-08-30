import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'

// Promotes 'confirmed_pending' fixtures whose due date has arrived to
// 'confirmed', recalculates standings for their tournaments, and advances
// knockout progression. Scheduled to run daily at 00:00 SAST (22:00 UTC).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()

  // 1. Find pending fixtures whose due date has arrived (about to be promoted)
  const todayKey = new Date().toISOString().slice(0, 10)
  const { data: duePending } = await supabase
    .from('fixtures')
    .select('id, tournament_id, round_type, home_team_id, away_team_id, status, results!results_fixture_id_fkey(home_score, away_score)')
    .eq('status', 'confirmed_pending')
    .lte('scheduled_date', todayKey)

  const fixtures = (duePending ?? []) as any[]
  if (fixtures.length === 0) {
    return NextResponse.json({ flipped: 0, tournaments: 0, advanced: 0 })
  }

  // 2. Flip them via the DB function (fires on_fixture_confirmed admin notifications)
  await supabase.rpc('flip_pending_results')

  // 3. Recalculate standings for each affected tournament (league + group)
  const tournamentIds = [...new Set(fixtures.map((f) => f.tournament_id).filter(Boolean))] as string[]
  let recalcFailed = 0
  for (const tid of tournamentIds) {
    try {
      await recalculateStandings(tid)
    } catch (e) {
      recalcFailed++
      console.error('[flip-pending] standings recalc failed for tournament:', tid, e)
    }
  }

  // 4. Advance knockout progression for confirmed KO fixtures
  let advanced = 0
  const koFixtures = fixtures.filter((f) => ['r16', 'qf', 'sf', 'final'].includes(f.round_type ?? ''))
  for (const fx of koFixtures) {
    const res = Array.isArray(fx.results) ? fx.results[0] : fx.results
    if (!res) continue
    try {
      await advanceWinner(
        supabase,
        fx.tournament_id,
        fx.id,
        res.home_score,
        res.away_score,
        fx.home_team_id ?? null,
        fx.away_team_id ?? null
      )
      advanced++
    } catch (e) {
      console.error('[flip-pending] knockout progression failed for fixture:', fx.id, e)
    }
  }

  return NextResponse.json({
    flipped: fixtures.length,
    tournaments: tournamentIds.length,
    recalcFailed,
    advanced,
  })
}
