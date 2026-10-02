import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'
import { getSastDateKey } from '@/lib/app-time'
import { KO_ROUNDS } from '@/lib/tournament-rounds'

// Promotes 'confirmed_pending' fixtures whose due date has arrived to
// 'confirmed', recalculates standings for their tournaments, and advances
// knockout progression. Scheduled to run daily at 00:00 SAST (22:00 UTC).
//
// The day key is SAST (see lib/app-time.ts) and it is passed explicitly into the
// flip, because fixtures.scheduled_date holds the matchday the manager sees. It
// used to be derived a second time inside SQL from CURRENT_DATE, which on this
// UTC database is still the previous day at 22:00 UTC - so the flip matched zero
// rows and every held result was released a full 24h late. See
// supabase/migrations/085_confirmed_pending_sast_day.sql.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()

  // 1. Find pending fixtures whose due date has arrived (about to be promoted).
  //    The day key is SAST so fixtures are released at 00:00 on their matchday.
  const todayKey = getSastDateKey()
  const { data: duePending } = await supabase
    .from('fixtures')
    .select('id, tournament_id, round_type, home_team_id, away_team_id, status, results!results_fixture_id_fkey(home_score, away_score)')
    .eq('status', 'confirmed_pending')
    .lte('scheduled_date', todayKey)

  const fixtures = (duePending ?? []) as any[]
  if (fixtures.length === 0) {
    return NextResponse.json({ flipped: 0, tournaments: 0, advanced: 0 })
  }

  // 2. Flip them via the DB function (fires on_fixture_confirmed admin
  //    notifications). todayKey is passed in so the flip uses the same day as
  //    the SELECT above - the two must not disagree. flipped is the function's
  //    real ROW_COUNT, not the pre-query length: reporting the pre-query length
  //    hid a 24h-late no-op as a successful flip.
  const { data: flipped, error: flipError } = await supabase.rpc('flip_pending_results', {
    p_today: todayKey,
  })
  if (flipError) {
    console.error('[flip-pending] flip_pending_results failed:', flipError)
    return NextResponse.json({ error: flipError.message, flipped: 0 }, { status: 500 })
  }
  const flippedCount = (flipped as number | null) ?? 0

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
  const koFixtures = fixtures.filter((f) => KO_ROUNDS.includes(f.round_type ?? ''))
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
    flipped: flippedCount,
    tournaments: tournamentIds.length,
    recalcFailed,
    advanced,
  })
}
