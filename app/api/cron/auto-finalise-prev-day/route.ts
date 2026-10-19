import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recalculateStandings } from '@/lib/standings-engine'
import { advanceWinner } from '@/lib/tournament-progression'
import { notifyBackdoorDecision } from '@/lib/backdoor-notify'
import { applyCarryOverBalances } from '@/lib/forfeit-balance-apply'
import { insertNotificationsAndPush } from '@/lib/notify'
import { getSastDateKey } from '@/lib/app-time'
import { GRACE_DAYS, POSTPONE_RESPONSE_HOURS } from '@/lib/submit-match'
import { KO_ROUNDS } from '@/lib/tournament-rounds'

// Daily at 02:00 SAST (00:00 UTC): any match due on a PREVIOUS matchday that is
// still unplayed ('scheduled', no result) is finalised automatically, so a game
// nobody has submitted is never left dangling —
//   * no backdoor application  -> confirmed 0-0 (both absent, no points)
//   * backdoor application(s)  -> auto-approved (single claim: 3-0 to the
//     claimant; both sides claimed: 0-0), mirroring the admin approve flow.
// It runs the MORNING AFTER the match day (was two days after) as an interim
// placeholder: the grace window (match day + GRACE_DAYS) is still open, so the
// managers can submit the real score and replace it, but the table and the next
// round are no longer held up waiting for a game that may never be played.
//
// A second pass then sweeps up claims that arrived too late for the first one:
// any pending backdoor on a match that is already due is approved (replacing a
// placeholder score) or voided (when a real result is on file), no matter when
// it was filed or what the fixture status became in the meantime.
//
// Passing ?dryRun=1 logs the intended outcome per fixture without writing;
// ?cutoff=YYYY-MM-DD overrides the overdue date for a manual catch-up run.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const supabase = await createAdminClient()

  // Overdue cutoff: a fixture is finalised on the MORNING AFTER its match day,
  // so an unplayed game becomes a confirmed 0-0 placeholder straight away
  // instead of sitting 'scheduled' and holding up the table / the next round.
  // The managers keep the rest of the grace day (match day + GRACE_DAYS) to
  // submit the real score, which replaces the placeholder — the 0-0 void and an
  // auto-approved backdoor are deliberately not "real" results (no finalised_by
  // / screenshot), so submitResult still accepts a first-time score for them.
  // `?cutoff=YYYY-MM-DD` overrides it for a manual catch-up run.
  const cutoffParam = new URL(request.url).searchParams.get('cutoff')
  const finaliseCutoff = /^\d{4}-\d{2}-\d{2}$/.test(cutoffParam ?? '')
    ? (cutoffParam as string)
    : getSastDateKey(new Date(), -GRACE_DAYS)

  // The postponed-confirmed flag is dropped only once the MOVED day is a full
  // grace day behind us: the agreed placeholder has already been scored, and
  // the flag is what keeps the "postponed to ..." context on the fixture while
  // the managers can still play it on the moved day.
  const postponedClearCutoff = getSastDateKey(new Date(), -(GRACE_DAYS + 1))

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
    .lte('scheduled_date', finaliseCutoff)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let targets = ((fixtures ?? []) as any[]).filter((f) => {
    const results = Array.isArray(f.results) ? f.results : f.results ? [f.results] : []
    return (
      results.length === 0 &&
      !vacantIds.has(f.home_team_id) &&
      !vacantIds.has(f.away_team_id)
    )
  })

  // A postponement request in flight holds the fixture open while its 24-hour
  // answer window runs (the reviewer can still accept or decline). Inside that
  // window we skip auto-finalise; a request already past POSTPONE_RESPONSE_HOURS
  // is declined here as well (the daily expire cron normally gets there first)
  // so the fixture still gets finalised instead of hanging forever.
  const skippedPendingRequest: string[] = []
  const expiredPendingRequest: string[] = []
  if (targets.length > 0) {
    const { data: pendingPostpone } = await supabase
      .from('postpone_requests')
      .select('id, fixture_id, created_at')
      .eq('status', 'pending')
      .in('fixture_id', targets.map((t) => t.id))
    const responseMs = POSTPONE_RESPONSE_HOURS * 60 * 60 * 1000
    const nowMs = Date.now()
    const staleIds: string[] = []
    const byFixture = new Map<string, { id: string; fresh: boolean }[]>()
    for (const p of (pendingPostpone ?? []) as any[]) {
      const fid = String(p.fixture_id)
      const fresh = nowMs - new Date(p.created_at).getTime() < responseMs
      byFixture.set(fid, [...(byFixture.get(fid) ?? []), { id: String(p.id), fresh }])
    }
    for (const [fid, reqs] of byFixture.entries()) {
      if (reqs.some((r) => r.fresh)) skippedPendingRequest.push(fid)
      else staleIds.push(...reqs.map((r) => r.id))
    }
    if (staleIds.length > 0) {
      const nowIso = new Date().toISOString()
      await supabase
        .from('postpone_requests')
        .update({ status: 'declined', responded_at: nowIso, updated_at: nowIso })
        .in('id', staleIds)
      expiredPendingRequest.push(...staleIds)
    }
    const skippedSet = new Set(skippedPendingRequest)
    targets = targets.filter((t) => !skippedSet.has(String(t.id)))
  }

  const stats = {
    finalised: 0,
    approved: 0,
    lateApproved: 0,
    staleClaimsVoided: 0,
    failed: 0,
    tournaments: 0,
    recalcFailed: 0,
    advanced: 0,
    postponedCleared: 0,
    skippedPendingRequest: 0,
    expiredPendingRequest: 0,
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
  stats.skippedPendingRequest = skippedPendingRequest.length
  stats.expiredPendingRequest = expiredPendingRequest.length

  // ── Pass 2: claims that arrived AFTER the match was auto-finalised ─────────
  // Pass 1 only looks at fixtures still 'scheduled'. A report can also arrive
  // AFTER the match was settled with a placeholder (the both-absent 0-0, or an
  // automatic 3-0 for a managerless club) or after the deadline, and that claim
  // used to sit pending forever because nothing revisited a 'confirmed' fixture.
  // Every pending claim whose match is due is resolved here, no matter when it
  // was filed: a non-real result (or none) approves the backdoor, while a real
  // result on file voids the superseded claim instead of overwriting it.
  const skippedSet2 = new Set(skippedPendingRequest)
  const { data: lateFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, tournament_id, round_type, status, scheduled_date,
      home_team_id, away_team_id,
      backdoor_submissions(id, status, side_claimed),
      results!results_fixture_id_fkey(fixture_id, home_score, away_score, finalised_by, screenshot_url, override_reason),
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .not('scheduled_date', 'is', null)
    .lte('scheduled_date', finaliseCutoff)
    .in('status', ['confirmed', 'awaiting_confirmation'])
    .not('postponed_confirmed', 'is', true)

  for (const fx of (lateFixtures ?? []) as any[]) {
    if (skippedSet2.has(String(fx.id))) continue
    const submissions = ((fx.backdoor_submissions ?? []) as any[]).filter((s) => s.status === 'pending')
    if (submissions.length === 0) continue
    const resRows = Array.isArray(fx.results) ? fx.results : fx.results ? [fx.results] : []
    const res = resRows[0]
    // A real score on file means the match was played: the pending claim is
    // stale, so close it out rather than overwriting a real result.
    if (res && (res.finalised_by || res.screenshot_url)) {
      stats.staleClaimsVoided += submissions.length
      if (!dryRun) {
        await supabase
          .from('backdoor_submissions')
          .update({ status: 'void_game_played' })
          .in('id', submissions.map((s) => s.id))
      }
      continue
    }
    // The fixture is already decided by rule, not by the claim: an unowned club
    // (no manager on either side) or an automatic "X absent" 3-0. Approve the
    // claim but leave the result untouched, because the standings trigger reads
    // those reasons as absence flags - rewriting them would turn the same score
    // into a normal win and move abandon counts.
    //
    // "Both teams absent" is deliberately NOT in this group: that 0-0 is exactly
    // the placeholder a late claim must be able to overturn (a 3-0 win to the
    // manager who reported), so it falls through to the approve path below.
    const reason = String(res?.override_reason ?? '').toLowerCase()
    const decidedByRule =
      !teamManagerId(fx.home_team) ||
      !teamManagerId(fx.away_team) ||
      (reason.includes('absent') && !reason.includes('both'))
    if (decidedByRule) {
      stats.lateApproved += 1
      if (!dryRun) {
        await supabase
          .from('backdoor_submissions')
          .update({ status: 'approved', reviewed_at: new Date().toISOString() })
          .in('id', submissions.map((s) => s.id))
      }
      continue
    }
    try {
      const outcome = await autoApprove(supabase, fx, submissions, dryRun)
      stats.lateApproved += 1
      if (fx.tournament_id) tournamentIds.add(fx.tournament_id)
      if (KO_ROUNDS.includes(fx.round_type ?? '')) {
        advances.push({ fx, homeScore: outcome.homeScore, awayScore: outcome.awayScore })
      }
    } catch (e) {
      stats.failed += 1
      console.error('[auto-finalise] late backdoor approve failed:', fx.id, e)
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

  // Postponed-confirmed fixtures whose moved date has now passed. The agreed
  // 3-0 (or a real score submitted on the new day) already counted in the
  // standings; dropping the flag is what takes the fixture off every upcoming
  // list and off the admin due-fixture strip. A fixture still waiting for its
  // moved day is untouched, and a real result already cleared its own flag.
  const { data: movedPast } = await supabase
    .from('fixtures')
    .select('id, tournament_id, round_type, home_team_id, away_team_id')
    .eq('postponed_confirmed', true)
    .not('scheduled_date', 'is', null)
    .lte('scheduled_date', postponedClearCutoff)

  for (const fx of (movedPast ?? []) as any[]) {
    try {
      await supabase.from('fixtures').update({ postponed_confirmed: false }).eq('id', fx.id)
      stats.postponedCleared += 1

      // Nobody submitted a real score on the moved day: the agreed placeholder
      // is the final one, so the knockout still needs its winner pushed through.
      if (KO_ROUNDS.includes(fx.round_type ?? '')) {
        const { data: result } = await supabase
          .from('results')
          .select('home_score, away_score')
          .eq('fixture_id', fx.id)
          .maybeSingle()
        if (result) {
          await advanceWinner(
            supabase,
            fx.tournament_id,
            fx.id,
            (result as any).home_score,
            (result as any).away_score,
            fx.home_team_id ?? null,
            fx.away_team_id ?? null
          )
          stats.advanced += 1
        }
      }
    } catch (e) {
      console.error('[auto-finalise] postponed flag clear failed for fixture:', fx.id, e)
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

  // Absorb carry-over forfeit balances for either manager, mirroring a normally
  // played match (the admin approve route does the same).
  const carry = await applyCarryOverBalances(supabase, {
    fixtureId: fx.id,
    homeManagerId: teamManagerId(fx.home_team),
    awayManagerId: teamManagerId(fx.away_team),
    homeTeamName: teamName(fx.home_team) ?? 'Home',
    awayTeamName: teamName(fx.away_team) ?? 'Away',
  }, homeScore, awayScore)
  homeScore = carry.homeScore
  awayScore = carry.awayScore

  // A late claim replaces the auto 0-0 placeholder, which already wrote its own
  // confirmation row - clear it so the match does not end up with two.
  await supabase.from('result_confirmations').delete().eq('fixture_id', fx.id)

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
        // Always write the reason, even when there is no carry-over note: the
        // approval replaces a placeholder whose reason may say 'Both teams
        // absent'. The standings trigger reads that text, so leaving it behind
        // would score this 3-0 as a 0-0 double absence.
        override_reason: carry.noteLines.length > 0 ? carry.noteLines.join('\n') : null,
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