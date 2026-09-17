import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'
import { notifyBackdoorDecision } from '@/lib/backdoor-notify'
import { insertNotificationsAndPush } from '@/lib/notify'
import { getSastDateKey } from '@/lib/app-time'

const KO_ROUNDS = ['r16', 'qf', 'sf', 'final']

// Daily at 02:00 SAST (00:00 UTC): any match due on a previous matchday that is
// still unplayed ('scheduled', no result) is finalised automatically —
//   * no backdoor application  -> confirmed 0-0 (both absent, no points)
//   * backdoor application(s)  -> auto-approved (single claim: 3-0 to the
//     claimant; both sides claimed: 0-0), mirroring the admin approve flow.
// Passing ?dryRun=1 logs the intended outcome per fixture without writing.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = await createAdminClient()

  // Previous SAST matchday: at 02:00 SAST this is the day whose fixtures are
  // due; anything with scheduled_date <= yesterday is overdue/unplayed.
  const yesterday = getSastDateKey(new Date(), -1)

  // Vacant placeholder team(s) are owned by sweep_vacant_slots (hourly) — skip
  // them so a vacancy resolves to its 0-3/3-0/0-0, never a "both absent" 0-0.
  const { data: vacantRows } = await supabase
    .from('teams')
    .select('id')
    .eq('logo_league_folder', 'custom')
    .eq('logo_team_slug', 'vacant')
  const vacantIds = new Set((vacantRows ?? []).map((t) => t.id))

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select(`
      id, tournament_id, round_type, status, scheduled_date,
      home_team_id, away_team_id,
      results!results_fixture_id_fkey(fixture_id),
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .eq('status', 'scheduled')
    .not('scheduled_date', 'is', null)
    .lte('scheduled_date', yesterday)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targets = ((fixtures ?? []) as any[]).filter((f) => {
    const results = Array.isArray(f.results) ? f.results : f.results ? [f.results] : []
    return (
      results.length === 0 &&
      !vacantIds.has(f.home_team_id) &&
      !vacantIds.has(f.away_team_id)
    )
  })

  const stats = {
    finalised: 0,
    approved: 0,
    failed: 0,
    tournaments: 0,
    recalcFailed: 0,
    advanced: 0,
  }
  const tournamentIds = new Set<string>()
  const advances: { fx: any; homeScore: number; awayScore: number }[] = []

  for (const fx of targets) {
    try {
      const { data: pending } = await supabase
        .from('backdoor_submissions')
        .select('id, side_claimed')
        .eq('fixture_id', fx.id)
        .eq('status', 'pending')
      const submissions = (pending ?? []) as any[]

      const outcome = submissions.length === 0
        ? await finaliseZeroZero(supabase, fx, dryRun)
        : await autoApprove(supabase, fx, submissions, dryRun)

      if (submissions.length === 0) stats.finalised += 1
      else stats.approved += 1

      if (fx.tournament_id) tournamentIds.add(fx.tournament_id)
      if (KO_ROUNDS.includes(fx.round_type ?? '')) {
        advances.push({ fx, homeScore: outcome.homeScore, awayScore: outcome.awayScore })
      }
    } catch (e) {
      stats.failed += 1
      console.error('[auto-finalise] fixture failed:', fx.id, e)
    }
  }

  for (const tid of tournamentIds) {
    try {
      await recalculateStandings(tid)
    } catch (e) {
      stats.recalcFailed += 1
      console.error('[auto-finalise] standings recalc failed for tournament:', tid, e)
    }
  }
  stats.tournaments = tournamentIds.size

  for (const { fx, homeScore, awayScore } of advances) {
    try {
      await advanceWinner(
        supabase,
        fx.tournament_id,
        fx.id,
        homeScore,
        awayScore,
        fx.home_team_id ?? null,
        fx.away_team_id ?? null
      )
      stats.advanced += 1
    } catch (e) {
      console.error('[auto-finalise] knockout progression failed for fixture:', fx.id, e)
    }
  }

  return NextResponse.json({
    dryRun,
    processed: targets.length,
    ...stats,
  })
}

function labelOf(fx: any): string {
  const h = teamName(fx.home_team)
  const a = teamName(fx.away_team)
  return `${h ?? 'Home'} vs ${a ?? 'Away'}`
}

function teamName(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.name ?? null
  return t?.name ?? null
}

function teamManagerId(t: any): string | null {
  if (Array.isArray(t)) return t[0]?.manager_id ?? null
  return t?.manager_id ?? null
}

// No pending backdoor -> confirmed 0-0 void (both absent, no points).
async function finaliseZeroZero(supabase: any, fx: any, dryRun: boolean) {
  const label = `${teamName(fx.home_team) ?? 'Home'} 0-0 ${teamName(fx.away_team) ?? 'Away'}`
  const overrideReason = 'Both teams absent — auto-finalised (0-0, no points)'

  if (dryRun) {
    console.log('[auto-finalise][dry-run] 0-0 ->', fx.id, label)
    return { homeScore: 0, awayScore: 0 }
  }

  await supabase.from('result_confirmations').insert({
    fixture_id: fx.id,
    home_score: 0,
    away_score: 0,
    submitted_by: null,
  })

  const { data: result, error: resErr } = await supabase
    .from('results')
    .upsert(
      {
        fixture_id: fx.id,
        home_score: 0,
        away_score: 0,
        is_abandoned: false,
        finalised_by: null,
        override_reason: overrideReason,
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()
  if (resErr) throw new Error(`[0-0] results upsert: ${resErr.message}`)

  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fx.id)

  await supabase
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', fx.id)
    .eq('status', 'pending')

  const managerIds = [teamManagerId(fx.home_team), teamManagerId(fx.away_team)]
    .filter((id): id is string => !!id)
  if (managerIds.length > 0) {
    await insertNotificationsAndPush(
      supabase,
      managerIds.map((user_id) => ({
        user_id,
        type: 'result_confirmed',
        title: 'Result Confirmed',
        body: label,
        data: { fixture_id: fx.id, home_score: '0', away_score: '0' },
      }))
    )
  }

  await supabase.from('audit_log').insert({
    admin_id: null,
    action: 'finalise_result',
    target_type: 'fixture',
    target_id: fx.id,
    details: {
      home_score: 0,
      away_score: 0,
      result_id: result?.id,
      home_absent: true,
      away_absent: true,
      auto_finalised: true,
    },
  })

  return { homeScore: 0, awayScore: 0 }
}

// Pending backdoor(s) -> auto-approve in the submitter's favour, mirroring
// the admin approve route. A single claim awards 3-0 to the claimant (the side
// OPPOSITE side_claimed); claims from both teams resolve to 0-0.
async function autoApprove(supabase: any, fx: any, submissions: any[], dryRun: boolean) {
  const ids = submissions.map((s) => s.id)
  let homeScore = 0
  let awayScore = 0
  if (submissions.length === 2) {
    // both teams claimed -> both absent
    homeScore = 0; awayScore = 0
  } else if (submissions[0].side_claimed === 'home') {
    homeScore = 0; awayScore = 3
  } else {
    homeScore = 3; awayScore = 0
  }

  if (dryRun) {
    console.log('[auto-finalise][dry-run] approve ->', fx.id, labelOf(fx), `${homeScore}-${awayScore}`, ids)
    return { homeScore, awayScore }
  }

  await supabase.from('result_confirmations').insert({
    fixture_id: fx.id,
    home_score: homeScore,
    away_score: awayScore,
    submitted_by: null,
  })

  const { data: result, error: resErr } = await supabase
    .from('results')
    .upsert(
      {
        fixture_id: fx.id,
        home_score: homeScore,
        away_score: awayScore,
        finalised_by: null,
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()
  if (resErr) throw new Error(`[approve] results upsert: ${resErr.message}`)

  await supabase.from('fixtures').update({ status: 'confirmed' }).eq('id', fx.id)

  await supabase
    .from('backdoor_submissions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .in('id', ids)

  // Void any OTHER pending submissions for the same fixture.
  await supabase
    .from('backdoor_submissions')
    .update({ status: 'void_game_played' })
    .eq('fixture_id', fx.id)
    .eq('status', 'pending')
    .not('id', 'in', `(${ids.join(',')})`)

  try {
    await notifyBackdoorDecision(supabase, ids, 'approved')
  } catch (e) {
    console.error('[auto-finalise] approve notify failed:', e)
  }

  await supabase.from('audit_log').insert({
    admin_id: null,
    action: 'finalise_result',
    target_type: 'fixture',
    target_id: fx.id,
    details: {
      home_score: homeScore,
      away_score: awayScore,
      result_id: result?.id,
      auto_approved_backdoor: true,
    },
  })

  return { homeScore, awayScore }
}