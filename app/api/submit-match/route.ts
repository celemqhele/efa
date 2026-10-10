import { after, NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getSastDateKey } from '@/lib/app-time'
import { recalculateStandings } from '@/lib/standings-engine'
import { insertNotificationsAndPush, notifyAllAdmins } from '@/lib/notify'
import { notifyBackdoorSubmitted, notifyBackdoorDisputed } from '@/lib/backdoor-notify'
import { KO_ROUNDS } from '@/lib/tournament-rounds'
import { advanceWinner } from '@/lib/tournament-progression'
import { analyzeImageBuffer, matchStatsToDbColumns } from '@/lib/ocr'
import { normalizeToLandscape } from '@/lib/whatsapp'
import { APP_BASE, MAX_POSTPONE_DAYS, buildState, dateKeyOf, deadlineBlock, homeSide, awaySide, isMineSubmission, isRealResult, labelDate, loadFixture, postponeWindow, resolveViewer, teamName, uploadToBucket, windowBlock, type Viewer } from '@/lib/submit-match'

function parseScore(value: FormDataEntryValue | null): number | null {
  if (value === null) return null
  const raw = String(value).trim()
  if (!/^\d{1,2}$/.test(raw)) return null
  return Number(raw)
}

async function audit(admin: any, userId: string | null, action: string, fixtureId: string, details: Record<string, any>) {
  await admin.from('audit_log').insert({
    admin_id: userId,
    action,
    target_type: 'fixture',
    target_id: fixtureId,
    details,
  })
}

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// — GET: portal state (used by the client to refresh after a mutation) —

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return error('Please log in first.', 401)

  const code = request.nextUrl.searchParams.get('code')?.trim() ?? ''
  if (!code) return error('Missing match code.')

  const admin = await createAdminClient()
  const fixture = await loadFixture(admin, code)
  if (!fixture) return error('Match code not found.', 404)

  const viewer = await resolveViewer(admin, user.id, fixture)
  if (!viewer.side && !viewer.isAdmin) return error('You are not one of the two managers for this match.', 403)

  const state = await buildState(admin, fixture, viewer, code)
  return NextResponse.json({ ok: true, ...state })
}
// — POST: mutations —

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return error('Please log in first.', 401)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return error('Invalid request.')
  }

  const action = String(form.get('action') ?? '')
  const code = String(form.get('code') ?? '').trim()
  if (!code) return error('Missing match code.')

  const admin = await createAdminClient()
  const fixture = await loadFixture(admin, code)
  if (!fixture) return error('Match code not found.', 404)

  const viewer = await resolveViewer(admin, user.id, fixture)
  if (!viewer.side && !viewer.isAdmin) return error('You are not one of the two managers for this match.', 403)

  switch (action) {
    case 'result':
      return submitResult(admin, fixture, viewer, form, code)
    case 'backdoor':
      return submitBackdoor(admin, fixture, viewer, form, code)
    case 'backdoorCancel':
      return cancelBackdoor(admin, fixture, viewer, form, code)
    case 'backdoorDispute':
      return disputeBackdoor(admin, fixture, viewer, form, code)
    case 'postpone':
      return requestPostpone(admin, fixture, viewer, form, code)
    case 'postponeRespond':
      return respondToPostpone(admin, fixture, viewer, form, code)
    default:
      return error('Unknown action.')
  }
}

// — 1. Submit result —

async function submitResult(admin: any, fixture: any, viewer: Viewer, form: FormData, code: string) {
  const dateKey = dateKeyOf(fixture)
  const todayKey = getSastDateKey()
  const homeScore = parseScore(form.get('homeScore'))
  const awayScore = parseScore(form.get('awayScore'))
  const shot = form.get('screenshot')
  const forfeit = String(form.get('forfeit') ?? '').trim()

  if (homeScore === null || awayScore === null) return error('Type both scores as numbers (e.g. 2 and 1).')
  if (!(shot instanceof File) || shot.size === 0) return error('Upload the result screenshot as proof.')
  if (shot.size > 8 * 1024 * 1024) return error('Screenshot is too large (max 8MB).')

  if (viewer.side === null && !viewer.isAdmin) return error('Only the two managers can submit a result.')

  const winBlock = windowBlock(dateKey)
  if (winBlock) return error(winBlock)
  if (fixture.postponed_confirmed && dateKey > todayKey) {
    return error(`This match was postponed to ${labelDate(dateKey)}. Submit the real result on or after that day.`)
  }
  if (fixture.status === 'abandoned') return error('This match has been abandoned.')

  // — Resubmission / replacement handling (mirrors the bot's resetAndResubmit) —
  // A postponed-placeholder is a first-time submission. A finished result can be
  // overridden up to MAX_WHATSAPP_RESETS (2) times via whatsapp_reset_count, and
  // a backdoor result can always be replaced by the real score (bot category 2:
  // real score within 7 days is a first-time submission — not counted).
  // limit(1) — a mutual report pair (or an upheld dispute) can leave TWO
  // approved rows on the fixture, and maybeSingle() errors on more than one row.
  const { data: activeBackdoor } = await admin
    .from('backdoor_submissions')
    .select('id')
    .eq('fixture_id', fixture.id)
    .eq('status', 'approved')
    .limit(1)
  const isBackdoorResult = !!(activeBackdoor && activeBackdoor.length)
  const isResubmit = !!fixture.result && !fixture.postponed_confirmed && !isBackdoorResult

  // Deadline rule (mirrors buildState): once the match's scheduled day has
  // passed, a settled (real) result is final for managers — no score changes
  // and no backdoor-replacement edits. Admin can still correct any score.
  if (!viewer.isAdmin && deadlineBlock(dateKey) && isRealResult(fixture.result) && !fixture.postponed_confirmed) {
    return error('This match is past its deadline, so its result can no longer be changed.')
  }

  if (isResubmit) {
    const resetCount = fixture.whatsapp_reset_count || 0
    if (resetCount >= 2 && !viewer.isAdmin) {
      return error('This result has already been changed twice. Contact the admin to change it for you.')
    }
  }
  // Any replacement of an already-on-file (non-placeholder) score wipes the old
  // result's stats + confirmations first so the corrected score is the only one
  // on file (mirrors restoreAndResubmit steps 1-2 in the bot).
  if (fixture.result && !fixture.postponed_confirmed) {
    await admin.from('match_stats').delete().eq('result_id', fixture.result.id)
    await admin.from('result_confirmations').delete().eq('fixture_id', fixture.id)
  }

  let screenshotUrl: string
  try {
    const ext = (shot.type === 'image/png' ? 'png' : shot.name?.endsWith('.png') ? 'png' : 'jpg')
    screenshotUrl = await uploadToBucket('match-screenshots', `result-${fixture.id}-${Date.now()}.${ext}`, shot)
  } catch (e) {
    console.error('[submit-match] result screenshot upload failed:', e)
    return error('Screenshot upload failed. Try again.', 500)
  }

  const isReplacing = !!fixture.result
  const isFuture = dateKey > todayKey
  let overrideReason = isReplacing
    ? fixture.postponed_confirmed
      ? 'postponement placeholder replaced'
      : isResubmit
        ? 'result resubmitted by manager'
        : 'backdoor result replaced by real score'
    : null

  let finalHomeScore = homeScore
  let finalAwayScore = awayScore
  let isAbandoned = false
  let abandonedType: 'home' | 'away' | null = null
  const isForfeit = forfeit === 'yes' || forfeit === 'true'

  if (isForfeit) {
    if (homeScore === awayScore) {
      return error('A forfeited match needs a clear loser — the scores cannot be level.')
    }
    const homeForfeit = homeScore < awayScore
    const origHome = homeScore
    const origAway = awayScore
    if (homeForfeit) {
      finalAwayScore += 3
    } else {
      finalHomeScore += 3
    }
    isAbandoned = true
    abandonedType = homeForfeit ? 'home' : 'away'
    overrideReason = 'match marked as forfeit'

    const forfeitingManagerId = homeForfeit ? fixture.home_team?.manager_id : fixture.away_team?.manager_id
    const opponentTeamId = homeForfeit ? fixture.away_team_id : fixture.home_team_id
    if (forfeitingManagerId) {
      await admin.from('forfeit_balances').insert({
        fixture_id: fixture.id,
        forfeiting_manager_id: forfeitingManagerId,
        opponent_team_id: opponentTeamId,
        opponent_score: homeForfeit ? finalAwayScore : finalHomeScore,
        forfeiting_score: homeForfeit ? finalHomeScore : finalAwayScore,
        half_time_note: `Forfeit: ${finalHomeScore}-${finalAwayScore} (adjusted from ${origHome}-${origAway})`,
      })
    }
  } else if (!isFuture && fixture.home_team_id && fixture.away_team_id) {
    const managerIds = [fixture.home_team?.manager_id, fixture.away_team?.manager_id].filter(Boolean)
    if (managerIds.length > 0) {
      const { data: balances } = await admin
        .from('forfeit_balances')
        .select('id, forfeiting_score, opponent_score, forfeiting_manager_id, opponent_team_id, fixture_id')
        .in('forfeiting_manager_id', managerIds)
        .gt('remaining', 0)

      if (balances && balances.length > 0) {
        const hName = teamName(fixture.home_team)
        const aName = teamName(fixture.away_team)
        // Every applied balance gets its own `forfeit_note:` line so all source
        // matches are cited on the result/fixture page, not just the last one.
        const forfeitNotes: string[] = []
        for (const bal of balances) {
          const forfeitingIsHome = bal.forfeiting_manager_id === fixture.home_team?.manager_id
          const forfScore = bal.forfeiting_score ?? 0
          const oppScore = bal.opponent_score ?? 0
          if (forfeitingIsHome) {
            finalHomeScore += forfScore
            finalAwayScore += oppScore
          } else {
            finalAwayScore += forfScore
            finalHomeScore += oppScore
          }
          await admin.from('forfeit_balances').update({ remaining: 0 }).eq('id', bal.id)

          const forfeiterTeam = forfeitingIsHome ? hName : aName
          const winnerTeam = forfeitingIsHome ? aName : hName
          const noteSentence = `${forfeiterTeam} forfeited a match that ended in ${bal.opponent_score}-${bal.forfeiting_score}, so this ${homeScore}-${awayScore} win became ${finalHomeScore}-${finalAwayScore} in favour of ${winnerTeam}.`
          forfeitNotes.push(`forfeit_note:${bal.fixture_id}:${noteSentence}`)
        }
        if (forfeitNotes.length > 0) overrideReason = forfeitNotes.join('\n')
      }
    }
  }

  // Confirmation row (mirrors writeResultToDb) so the fixture page's "both
  // managers submitted" panel sees this score too.
  const { error: confErr } = await admin.from('result_confirmations').upsert(
    { fixture_id: fixture.id, submitted_by: viewer.userId, home_score: finalHomeScore, away_score: finalAwayScore },
    { onConflict: 'rc_unique_fixture_submitted' }
  )
  if (confErr) console.error('[submit-match] confirmation upsert failed:', confErr.message)

  const { data: resultRow, error: resultErr } = await admin
    .from('results')
    .upsert(
      {
        fixture_id: fixture.id,
        home_score: finalHomeScore,
        away_score: finalAwayScore,
        screenshot_url: screenshotUrl,
        finalised_by: viewer.userId,
        is_abandoned: isAbandoned,
        ...(abandonedType ? { abandoned_type: abandonedType } : {}),
        ...(overrideReason ? { override_reason: overrideReason } : {}),
      },
      { onConflict: 'fixture_id' }
    )
    .select('id')
    .single()
  if (resultErr || !resultRow) {
    console.error('[submit-match] results upsert failed:', resultErr?.message)
    return error('Failed to save the result. Try again or ask the admin.', 500)
  }

  const { error: fixErr } = await admin
    .from('fixtures')
    .update({
      status: isFuture ? 'confirmed_pending' : 'confirmed',
      postponed_confirmed: false,
      ...(isResubmit ? { whatsapp_reset_count: (fixture.whatsapp_reset_count || 0) + 1 } : {}),
    })
    .eq('id', fixture.id)
  if (fixErr) {
    console.error('[submit-match] fixture status update failed:', fixErr.message)
    return error('Result was saved but the fixture status could not be updated. Ask the admin to re-check.', 500)
  }

  if (!isFuture) {
    await admin
      .from('backdoor_submissions')
      .update({ status: 'void_game_played' })
      .eq('fixture_id', fixture.id)
      .in('status', ['pending', 'approved'])
  }

  if (isReplacing || !isFuture) {
    try {
      await recalculateStandings(fixture.tournament_id)
    } catch (e) {
      console.error('[submit-match] standings recalc failed:', e)
    }
  }

  if (!isFuture && KO_ROUNDS.includes(fixture.round_type ?? '')) {
    try {
      await advanceWinner(
        admin,
        fixture.tournament_id,
        fixture.id,
        homeScore,
        awayScore,
        fixture.home_team_id ?? null,
        fixture.away_team_id ?? null
      )
    } catch (e) {
      console.error('[submit-match] knockout progression failed:', e)
    }
  }

  await audit(admin, viewer.userId, 'portal_result_submitted', fixture.id, {
    home_score: homeScore,
    away_score: awayScore,
    is_replacement: isReplacing,
    why: overrideReason ?? 'first submission',
    side: viewer.side,
  })

  const matchLabel = `${teamName(fixture.home_team)} ${homeScore}-${awayScore} ${teamName(fixture.away_team)}`
  try {
    await notifyAllAdmins(admin, {
      type: 'match_result',
      title: 'Result Submitted (Portal)',
      body: matchLabel,
      data: { fixture_id: fixture.id },
    })
  } catch (e) {
    console.error('[submit-match] admin notify failed:', e)
  }

  // OCR the proof screenshot in the background (after the response) so the
  // manager is not kept waiting. The typed score gates the stats: a screenshot
  // showing the identical scoreline keeps stats as-is; a reversed scoreline
  // (manager typed 2-3 but the screenshot reads 3-2) means the two sides are
  // swapped on screen, so home/away stats are flipped to match the typed sides;
  // any other mismatch means no stats are written at all.
  const shotBuffer = Buffer.from(await shot.arrayBuffer())
  const mimeType = shot.type || 'image/jpeg'
  after(async () => {
    try {
      const analysis = await analyzeImageBuffer(await normalizeToLandscape(shotBuffer), mimeType)
      const ocrHome = analysis.homeScore
      const ocrAway = analysis.awayScore
      const ocrStats = analysis.matchStats
      if (ocrHome == null || ocrAway == null || !ocrStats) return

      let stats = ocrStats
      if (ocrHome === homeScore && ocrAway === awayScore) {
        // exact match — keep stats as read
      } else if (ocrHome === awayScore && ocrAway === homeScore) {
        // scoreline is swapped: flip every stat so home/away line up with the
        // typed (manager) sides
        stats = {}
        for (const [key, val] of Object.entries(ocrStats)) {
          stats[key] = { home: val.away, away: val.home }
        }
      } else {
        // no match — no stats
        return
      }

      const dbStats = matchStatsToDbColumns(stats)
      if (!dbStats) return

      // Wipe any previous stats for this fixture (e.g. a replaced placeholder)
      // then write the OCR result, mirroring the finalise-result flow.
      await admin.from('match_stats').delete().eq('result_id', resultRow.id)
      const { error: statsErr } = await admin.from('match_stats').insert({ result_id: resultRow.id, ...dbStats })
      if (statsErr) console.error('[submit-match] background match_stats insert failed:', statsErr.message)
    } catch (e) {
      console.error('[submit-match] background OCR failed:', e)
    }
  })

  return NextResponse.json({
    ok: true,
    title: isReplacing ? 'Result updated' : 'Result submitted',
    message: `${matchLabel}${isResubmit ? ' This overrides the previous score.' : isBackdoorResult ? ' This replaces the backdoor result.' : isReplacing ? ' The placeholder result has been replaced.' : ''}${
      isFuture ? ' Saved as pending until ' + labelDate(dateKey) + '.' : ''
    }`,
    shareLink: `${APP_BASE}/submit-match/${code}`,
    shareText: `My result for ${matchLabel} is in. Confirm it here:`,
  })
}

// — 2. Report opponent not responding (backdoor) —

async function submitBackdoor(admin: any, fixture: any, viewer: Viewer, form: FormData, code: string) {
  const side = String(form.get('side') ?? '')
  const shot = form.get('screenshot')

  if (side !== 'home' && side !== 'away') return error('Say which team is not responding.')
  if (!(shot instanceof File) || shot.size === 0) return error('Upload the screenshot showing no response.')
  if (shot.size > 8 * 1024 * 1024) return error('Screenshot is too large (max 8MB).')
  if (viewer.side === null && !viewer.isAdmin) return error('Only the two managers can report an opponent.')

  // A manager always reports their opponent: the side is pinned server-side so
  // the form can be pre-selected and can't be pointed at the wrong team.
  if (viewer.side !== null && side === viewer.side) {
    return error('Report the other team — the side that is not responding.')
  }

  if (fixture.postponed_confirmed) {
    return error('This match was postponed and is still to be played. Report the opponent once the new date has passed.')
  }
  if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation') {
    if (fixture.result) {
      return error(
        `This match already has a result (${teamName(fixture.home_team)} ${fixture.result.home_score}-${fixture.result.away_score} ${teamName(fixture.away_team)}).`
      )
    }
    return error('This match is no longer open for opponent-not-responding reports.')
  }

  const { data: windowRow } = await admin.from('backdoor_window').select('enabled').maybeSingle()
  if (windowRow && windowRow.enabled === false) {
    return error('Opponent-not-responding reports are closed right now. They open on Thursday.')
  }

  const submitterKey = viewer.phone ?? viewer.userId
  const { data: existing } = await admin
    .from('backdoor_submissions')
    .select('id, status')
    .eq('submitter_phone', submitterKey)
    .eq('fixture_id', fixture.id)
    .in('status', ['pending', 'approved', 'declined'])
    .maybeSingle()
  if (existing) return error('You have already submitted a backdoor report for this match.')

  let screenshotUrl: string
  try {
    screenshotUrl = await uploadToBucket('backdoor-screenshots', `portal-${Date.now()}.jpg`, shot)
  } catch (e) {
    console.error('[submit-match] backdoor screenshot upload failed:', e)
    return error('Screenshot upload failed. Try again.', 500)
  }

  // Same expiry as the bot flow: next Tuesday 23:59:59.
  const expiresAt = new Date()
  const daysUntilTuesday = (2 - expiresAt.getDay() + 7) % 7 || 7
  expiresAt.setDate(expiresAt.getDate() + daysUntilTuesday)
  expiresAt.setHours(23, 59, 59, 999)

  const { data: submission, error: insertErr } = await admin
    .from('backdoor_submissions')
    .insert({
      fixture_id: fixture.id,
      submitter_phone: submitterKey,
      side_claimed: side,
      screenshot_url: screenshotUrl,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()
  if (insertErr) {
    console.error('[submit-match] backdoor insert failed:', insertErr.message)
    return error('Failed to submit. Try again.', 500)
  }

  try {
    await notifyBackdoorSubmitted(admin, {
      submissionId: submission.id,
      fixtureId: fixture.id,
      nonRespondingSide: side,
      homeName: teamName(fixture.home_team),
      awayName: teamName(fixture.away_team),
      submitterName: viewer.username,
    })
  } catch (e) {
    console.error('[submit-match] admin notify failed:', e)
  }

  await audit(admin, viewer.userId, 'portal_backdoor_submitted', fixture.id, {
    side_claimed: side,
    submission_id: submission.id,
    side: viewer.side,
  })

  return NextResponse.json({
    ok: true,
    title: 'Report submitted',
    message: 'Thanks. Admin will review and get back to you.',
    shareLink: `${APP_BASE}/submit-match/${code}`,
    shareText: `I reported ${side === 'home' ? teamName(fixture.home_team) : teamName(fixture.away_team)} as not responding:`,
  })
}

// — 2b. Cancel a still-pending report, or dispute the report against you —

async function cancelBackdoor(admin: any, fixture: any, viewer: Viewer, form: FormData, _code: string) {
  const id = String(form.get('submissionId') ?? '')
  if (!id) return error('Missing report id.')

  const { data: rows } = await admin
    .from('backdoor_submissions')
    .select('id, status, submitter_phone, is_dispute')
    .eq('fixture_id', fixture.id)
  const row = (rows ?? []).find((r: any) => r.id === id && isMineSubmission(r, viewer))
  if (!row) return error('That report is not yours to cancel.')
  if (row.status !== 'pending') return error('That report has already been reviewed, so it can no longer be cancelled.')

  const { error: delErr } = await admin
    .from('backdoor_submissions')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
  if (delErr) {
    console.error('[submit-match] backdoor cancel failed:', delErr.message)
    return error('Failed to cancel. Try again.', 500)
  }

  await audit(admin, viewer.userId, row.is_dispute ? 'portal_dispute_cancelled' : 'portal_backdoor_cancelled', fixture.id, {
    submission_id: id,
    side: viewer.side,
  })

  return NextResponse.json({
    ok: true,
    title: row.is_dispute ? 'Dispute cancelled' : 'Report cancelled',
    message: row.is_dispute
      ? 'Your dispute has been removed. You can file it again while the report against you is still open.'
      : 'Your report has been removed. You can submit a new one while the match is still open.',
  })
}

async function disputeBackdoor(admin: any, fixture: any, viewer: Viewer, form: FormData, code: string) {
  const shot = form.get('screenshot')
  const note = String(form.get('explanation') ?? '').trim()

  if (viewer.side === null) return error('Only the two managers can dispute a report.')
  if (!(shot instanceof File) || shot.size === 0) return error('Upload a screenshot to support your dispute.')
  if (shot.size > 8 * 1024 * 1024) return error('Screenshot is too large (max 8MB).')
  if (note.length < 5) return error('Explain why the report is wrong (at least 5 characters).')
  if (note.length > 500) return error('Explanation is too long (max 500 characters).')
  if (fixture.postponed_confirmed) {
    return error('This match was postponed and is still to be played. Dispute once the new date has passed.')
  }
  if (fixture.status === 'abandoned') return error('This match has been abandoned.')

  const { data: rows } = await admin
    .from('backdoor_submissions')
    .select('id, status, side_claimed, submitter_phone, is_dispute')
    .eq('fixture_id', fixture.id)
    .neq('status', 'expired')
  const all = rows ?? []
  const isLive = (r: any) => ['pending', 'approved', 'declined'].includes(r.status)
  // The appeal only exists once the report has actually been APPLIED: the
  // opponent's report naming MY side as not responding, already approved.
  const reportsAgainstMe = all.filter(
    (r: any) => r.side_claimed === viewer.side && !isMineSubmission(r, viewer)
  )
  const appliedAgainstMe = reportsAgainstMe.filter((r: any) => r.status === 'approved')
  if (!reportsAgainstMe.length) return error('Nobody has reported you in this match, so there is nothing to dispute.')
  if (!appliedAgainstMe.length) {
    return error('The report against you is still waiting for review. You can only dispute once the backdoor has been applied.')
  }
  if (all.some((r: any) => r.is_dispute && isMineSubmission(r, viewer) && isLive(r))) {
    return error('You have already disputed this backdoor.')
  }
  if (all.some((r: any) => !r.is_dispute && isMineSubmission(r, viewer) && isLive(r))) {
    return error('You already have your own report on this match. Cancel it first to dispute.')
  }

  let screenshotUrl: string
  try {
    screenshotUrl = await uploadToBucket('backdoor-screenshots', `dispute-${Date.now()}.jpg`, shot)
  } catch (e) {
    console.error('[submit-match] dispute screenshot upload failed:', e)
    return error('Screenshot upload failed. Try again.', 500)
  }

  // The dispute claims the OPPOSITE side is the one not responding — that is
  // the original reporter — so approving it hands that side the 0-3 loss
  // through the existing backdoor approve logic.
  const side = viewer.side === 'home' ? 'away' : 'home'

  // Same expiry as a normal report (next Tuesday 23:59:59) so a stale dispute
  // cannot sit pending forever.
  const expiresAt = new Date()
  const daysUntilTuesday = (2 - expiresAt.getDay() + 7) % 7 || 7
  expiresAt.setDate(expiresAt.getDate() + daysUntilTuesday)
  expiresAt.setHours(23, 59, 59, 999)

  const { data: submission, error: insertErr } = await admin
    .from('backdoor_submissions')
    .insert({
      fixture_id: fixture.id,
      submitter_phone: viewer.phone ?? viewer.userId,
      side_claimed: side,
      screenshot_url: screenshotUrl,
      expires_at: expiresAt.toISOString(),
      is_dispute: true,
      dispute_note: note,
    })
    .select('id')
    .single()
  if (insertErr) {
    console.error('[submit-match] dispute insert failed:', insertErr.message)
    return error('Failed to submit the dispute. Try again.', 500)
  }

  const matchLabel = `${teamName(fixture.home_team)} vs ${teamName(fixture.away_team)}`
  try {
    await notifyBackdoorDisputed(admin, {
      submissionId: submission.id,
      fixtureId: fixture.id,
      disputingSide: viewer.side,
      homeName: teamName(fixture.home_team),
      awayName: teamName(fixture.away_team),
      note,
      byName: viewer.username,
    })
  } catch (e) {
    console.error('[submit-match] dispute admin notify failed:', e)
  }

  // The original reporter should know their claim is being contested.
  try {
    const opponent = viewer.side === 'home' ? awaySide(fixture) : homeSide(fixture)
    if (opponent.managerId) {
      await insertNotificationsAndPush(admin, {
        user_id: opponent.managerId,
        type: 'backdoor_submitted',
        title: 'Backdoor report disputed',
        body: `${matchLabel} — your opponent disputed your report. The admin will review both screenshots.`,
        data: { fixture_id: fixture.id, url: `${APP_BASE}/submit-match/${code}` },
      })
    }
  } catch (e) {
    console.error('[submit-match] dispute opponent notify failed:', e)
  }

  await audit(admin, viewer.userId, 'portal_backdoor_disputed', fixture.id, {
    submission_id: submission.id,
    side_claimed: side,
    side: viewer.side,
  })

  return NextResponse.json({
    ok: true,
    title: 'Dispute submitted',
    message: 'The admin will compare your screenshot and explanation with the report already on file and get back to you.',
  })
}

// — 3. Request a postponement —

async function requestPostpone(admin: any, fixture: any, viewer: Viewer, form: FormData, code: string) {
  const newDate = String(form.get('newDate') ?? '').trim()
  const reason = String(form.get('reason') ?? '').trim()

  if (viewer.side === null) return error('Only the two managers can request a postponement.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return error('Pick a new date.')
  if (reason.length < 3) return error('Give a short reason for the postponement.')
  if (reason.length > 300) return error('Reason is too long (max 300 characters).')

  // Managers can only request a postponement up to the match's deadline (its
  // scheduled day). Once the day has passed the match is final as-is: it may be
  // a real played result, or it will be auto-finalised and a real first
  // submission replaces the placeholder inside the 7-day window. Completing an
  // already-pending request (accept/decline) keeps the 7-day response window.
  const dlBlock = deadlineBlock(dateKeyOf(fixture))
  if (dlBlock) return error('This match is past its deadline, so it can no longer be postponed.')
  if (isRealResult(fixture.result)) return error('This match already has a result, so it can no longer be postponed.')
  if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation' && !fixture.result) {
    return error('This match can no longer be postponed.')
  }
  if (fixture.postponed_confirmed) return error('This match was already postponed.')

  const todayKey = getSastDateKey()
  const maxKey = getSastDateKey(new Date(), MAX_POSTPONE_DAYS)
  if (newDate <= todayKey) return error('The new date must be in the future.')
  if (newDate > maxKey) return error(`Pick a date within the next ${MAX_POSTPONE_DAYS} days.`)

  const { data: pending } = await admin
    .from('postpone_requests')
    .select('id')
    .eq('fixture_id', fixture.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) return error('There is already a postponement request waiting for your opponent.')

  const { data: row, error: insertErr } = await admin
    .from('postpone_requests')
    .insert({
      fixture_id: fixture.id,
      requested_by: viewer.userId,
      requested_by_phone: viewer.phone,
      new_date: newDate,
      reason,
    })
    .select('id')
    .single()
  if (insertErr) {
    console.error('[submit-match] postpone request insert failed:', insertErr.message)
    if (String(insertErr.code) === '23505') return error('There is already a postponement request for this match.')
    return error('Failed to send the request. Try again.', 500)
  }

  const opponent = viewer.side === 'home' ? awaySide(fixture) : homeSide(fixture)
  const matchLabel = `${teamName(fixture.home_team)} vs ${teamName(fixture.away_team)}`
  const shareLink = `${APP_BASE}/submit-match/${code}`
  const notifications: any[] = []
  if (opponent.managerId) {
    notifications.push({
      user_id: opponent.managerId,
      type: 'fixture_postponed',
      title: 'Postponement requested',
      body: `${matchLabel} moved to ${labelDate(newDate)} — open the match link to accept or decline.`,
      data: { fixture_id: fixture.id, postpone_request_id: row.id, url: shareLink },
    })
  }
  if (notifications.length) {
    try {
      await insertNotificationsAndPush(admin, notifications)
    } catch (e) {
      console.error('[submit-match] opponent notify failed:', e)
    }
  }
  try {
    await notifyAllAdmins(admin, {
      type: 'fixture_postponed',
      title: 'Postponement requested',
      body: `${matchLabel} — ${labelDate(newDate)} (${reason})`,
      data: { fixture_id: fixture.id },
    })
  } catch (e) {
    console.error('[submit-match] admin notify failed:', e)
  }

  await audit(admin, viewer.userId, 'portal_postpone_requested', fixture.id, {
    new_date: newDate,
    reason,
    side: viewer.side,
  })

  return NextResponse.json({
    ok: true,
    title: 'Postponement requested',
    message: `Asked to move ${matchLabel} to ${labelDate(newDate)}. Your opponent must open the same link to accept.`,
    shareLink,
    shareText: `I asked to postpone ${matchLabel} to ${labelDate(newDate)}. Accept or decline here:`,
  })
}

// — 4. Accept / decline a postponement —

async function respondToPostpone(admin: any, fixture: any, viewer: Viewer, form: FormData, code: string) {
  const accept = String(form.get('accept') ?? '') === '1'

  const { data: request } = await admin
    .from('postpone_requests')
    .select('id, requested_by, new_date, reason, status')
    .eq('fixture_id', fixture.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (!request) return error('There is no postponement waiting for a decision.')
  const windowBlockMsg = postponeWindow(dateKeyOf(fixture))
  if (windowBlockMsg) {
    return error('The 7-day window to answer this postponement has closed. Contact the admin if you still want to move this match.')
  }
  if (String(request.requested_by) === viewer.userId) {
    return error('You raised this request — your opponent has to accept or decline.')
  }
  if (viewer.side === null && !viewer.isAdmin) return error('Only the two managers can answer this.')

  const matchLabel = `${teamName(fixture.home_team)} vs ${teamName(fixture.away_team)}`
  const shareLink = `${APP_BASE}/submit-match/${code}`
  const newDate = String(request.new_date).slice(0, 10)

  if (!accept) {
    const { error: declineErr } = await admin
      .from('postpone_requests')
      .update({ status: 'declined', responded_by: viewer.userId, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', request.id)
    if (declineErr) return error('Failed to save. Try again.', 500)

    await audit(admin, viewer.userId, 'portal_postpone_declined', fixture.id, { new_date: newDate, reason: request.reason })

    try {
      // The requester is whoever sits on the other side of the responder.
      const requesterIsHome = viewer.side !== 'home'
      const requesterId = requesterIsHome ? homeSide(fixture).managerId : awaySide(fixture).managerId
      if (requesterId) {
        await insertNotificationsAndPush(admin, {
          user_id: requesterId,
          type: 'fixture_postponed',
          title: 'Postponement declined',
          body: `${matchLabel}: your opponent declined the move to ${labelDate(newDate)}.`,
          data: { fixture_id: fixture.id },
        })
      }
    } catch (e) {
      console.error('[submit-match] decline notify failed:', e)
    }

    return NextResponse.json({
      ok: true,
      title: 'Postponement declined',
      message: `The match stays on ${labelDate(dateKeyOf(fixture))}.`,
    })
  }

  if (viewer.side === null) return error('Only the two managers can accept this.')

  // The acceptor wins 3-0; the requester loses. Their side is the acceptor side.
  const acceptorSide = viewer.side
  const homeScore = acceptorSide === 'home' ? 3 : 0
  const awayScore = acceptorSide === 'away' ? 3 : 0
  const winner = acceptorSide === 'home' ? teamName(fixture.home_team) : teamName(fixture.away_team)
  const loser = acceptorSide === 'home' ? teamName(fixture.away_team) : teamName(fixture.home_team)

  const { error: acceptErr } = await admin
    .from('postpone_requests')
    .update({ status: 'accepted', responded_by: viewer.userId, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', request.id)
  if (acceptErr) return error('Failed to save. Try again.', 500)

  // Locked placeholder result. override_reason must NOT contain the words
  // 'absent' or 'both' - the standings trigger reads those as no-show flags.
  const { error: resultErr } = await admin.from('results').upsert(
    {
      fixture_id: fixture.id,
      home_score: homeScore,
      away_score: awayScore,
      finalised_by: viewer.userId,
      override_reason: 'postponement agreed',
      is_abandoned: false,
    },
    { onConflict: 'fixture_id' }
  )
  if (resultErr) {
    console.error('[submit-match] postpone result upsert failed:', resultErr.message)
    return error('Failed to record the result. Try again or ask the admin.', 500)
  }

  // The trigger holds future-dated results as 'confirmed_pending' and skips
  // standings; a postponement agreement is final right now, so force
  // 'confirmed' (that is what postponed_confirmed means: confirmed in the
  // database, still shown as due on the moved date).
  const { error: fixErr } = await admin
    .from('fixtures')
    .update({
      status: 'confirmed',
      postponed_confirmed: true,
      is_postponed: true,
      postponed_from: fixture.scheduled_date,
      scheduled_date: newDate,
    })
    .eq('id', fixture.id)
  if (fixErr) {
    console.error('[submit-match] postpone fixture update failed:', fixErr.message)
    return error('Postponement was recorded but the fixture date could not be moved. Ask the admin.', 500)
  }

  try {
    await recalculateStandings(fixture.tournament_id)
  } catch (e) {
    console.error('[submit-match] standings recalc after postpone failed:', e)
  }

  await audit(admin, viewer.userId, 'portal_postpone_accepted', fixture.id, {
    new_date: newDate,
    reason: request.reason,
    home_score: homeScore,
    away_score: awayScore,
    side: viewer.side,
  })

  const managerIds = [homeSide(fixture).managerId, awaySide(fixture).managerId].filter(Boolean)
  try {
    await insertNotificationsAndPush(
      admin,
      managerIds.map((user_id: string) => ({
        user_id,
        type: 'fixture_postponed',
        title: 'Postponement agreed',
        body: `${matchLabel} moved to ${labelDate(newDate)}. Result locked ${homeScore}-${awayScore} to ${winner}.`,
        data: { fixture_id: fixture.id, url: shareLink },
      }))
    )
  } catch (e) {
    console.error('[submit-match] accept notify failed:', e)
  }

  return NextResponse.json({
    ok: true,
    title: 'Postponement accepted',
    message: `${matchLabel} moved to ${labelDate(newDate)}. Result locked ${homeScore}-${awayScore} to ${winner} (${loser} loses the 3-0).`,
    shareLink,
    shareText: `Postponement accepted for ${matchLabel} — moved to ${labelDate(newDate)}:`,
  })
}

