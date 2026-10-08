import { createAdminClient } from '@/lib/supabase/server'
import { getSastDateKey } from '@/lib/app-time'

// ─── Web submission portal (shared state) ─────────────────────────────────────
// Used by the page (app/submit-match/[code]/page.tsx) for the first render and
// by the API route (app/api/submit-match/route.ts) for the GET refresh, so the
// rules in one place cannot drift from the other.

export const APP_BASE = 'https://efa-fxyk.vercel.app'

// How far a new postponement date may be moved (future side) and how long the
// two managers still have past the deadline to complete one (request by the
// requester, accept/decline by the reviewer).
export const MAX_POSTPONE_DAYS = 7

// The postpone option Stays open for MAX_POSTPONE_DAYS after the deadline
// (the fixture's scheduled date). Only the lower bound matters here — the
// future side is governed by MAX_POSTPONE_DAYS on the proposed new date.
export function postponeWindow(dateKey: string, now = new Date()): string | null {
  if (!dateKey) return null
  const startKey = getSastDateKey(now, -MAX_POSTPONE_DAYS)
  if (dateKey < startKey) {
    return 'This match is more than 7 days past its deadline, so it can no longer be postponed.'
  }
  return null
}

// A result is 'real' when someone actually recorded the game (a manager proof
// upload or an admin decision). Auto-finalised outcomes (0-0 void / auto-approved
// backdoor) have no finalised_by or screenshot and can still be replaced by an
// agreed postponement inside the 7-day-after-deadline window.
export function isRealResult(result: any): boolean {
  return !!result && (!!result.finalised_by || !!result.screenshot_url)
}

export type Viewer = {
  userId: string
  username: string | null
  role: string | null
  phone: string | null
  teamIds: string[]
  side: 'home' | 'away' | null
  isAdmin: boolean
}

export function dateKeyOf(fixture: any): string {
  if (!fixture?.scheduled_date) return ''
  return String(fixture.scheduled_date).slice(0, 10)
}

// Same window as the bot (webhook route.ts submissionBlockReason): today-7..today+7.
export function windowBlock(dateKey: string, now = new Date()): string | null {
  if (!dateKey) return null
  const startKey = getSastDateKey(now, -7)
  const endKey = getSastDateKey(now, 7)
  if (dateKey >= startKey && dateKey <= endKey) return null
  if (dateKey > endKey) {
    const d = new Date(`${dateKey}T00:00:00.000Z`)
    const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    return `This game is more than 7 days away, so it can't be submitted yet. Come back on the match day (${label}).`
  }
  return 'This match is older than 7 days, so it can no longer be submitted here.'
}

export function labelDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export function teamName(side: any): string {
  const t = Array.isArray(side) ? side[0] : side
  return t?.name ?? 'Team'
}

export function homeSide(fixture: any) {
  const t = Array.isArray(fixture.home_team) ? fixture.home_team[0] : fixture.home_team
  return { id: t?.id ?? fixture.home_team_id, name: t?.name ?? 'Home', managerId: t?.manager_id ?? null }
}

export function awaySide(fixture: any) {
  const t = Array.isArray(fixture.away_team) ? fixture.away_team[0] : fixture.away_team
  return { id: t?.id ?? fixture.away_team_id, name: t?.name ?? 'Away', managerId: t?.manager_id ?? null }
}

export async function loadFixture(admin: any, code: string): Promise<any | null> {
  const { data: codeRow } = await admin
    .from('match_codes')
    .select('fixture_id')
    .eq('code', code)
    .maybeSingle()
  if (!codeRow) return null

  const { data: fixture } = await admin
    .from('fixtures')
    .select(`
      id, tournament_id, round_type, status, scheduled_date, postponed_from,
      is_postponed, postponed_confirmed, whatsapp_reset_count, home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id),
      tournament:tournaments(name),
      result:results!results_fixture_id_fkey(id, home_score, away_score, screenshot_url, override_reason, created_at, is_abandoned, finalised_by)
    `)
    .eq('id', codeRow.fixture_id)
    .single()
  return fixture ?? null
}

export async function resolveViewer(admin: any, userId: string, fixture: any): Promise<Viewer> {
  const { data: profile } = await admin
    .from('profiles')
    .select('username, role, phone')
    .eq('id', userId)
    .maybeSingle()
  const { data: teams } = await admin
    .from('teams')
    .select('id')
    .eq('manager_id', userId)
  const teamIds = (teams ?? []).map((t: any) => String(t.id))
  const side = teamIds.includes(String(fixture.home_team_id))
    ? 'home'
    : teamIds.includes(String(fixture.away_team_id))
      ? 'away'
      : null
  return {
    userId,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    phone: profile?.phone ?? null,
    teamIds,
    side,
    isAdmin: profile?.role === 'admin',
  }
}

export async function uploadToBucket(bucket: string, fileName: string, file: File) {
  const admin = await createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const contentType = file.type || 'image/jpeg'
  const { error } = await admin.storage.from(bucket).upload(fileName, buffer, { contentType, upsert: false })
  if (error) throw error
  const { data, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(fileName, 60 * 60 * 24 * 365)
  if (signError || !data?.signedUrl) throw signError || new Error('failed to sign url')
  return data.signedUrl as string
}

export function isMineSubmission(row: any, viewer: Viewer): boolean {
  if (viewer.phone && row.submitter_phone) {
    const a = String(row.submitter_phone).replace(/\D/g, '')
    const b = viewer.phone.replace(/\D/g, '')
    if (a && b && a === b) return true
  }
  return String(row.submitter_phone ?? '') === viewer.userId
}

export async function usernameLabel(userId: string): Promise<string> {
  const admin = await createAdminClient()
  const { data } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle()
  return data?.username ?? 'Your opponent'
}

// Everything the portal page needs to render: fixture, existing result, backdoor
// reports, any live postponement request, and which of the four actions this
// viewer is allowed to touch right now.
export async function buildState(admin: any, fixture: any, viewer: Viewer, code: string) {
  const dateKey = dateKeyOf(fixture)
  const todayKey = getSastDateKey()
  const isPlaceholder = !!fixture.postponed_confirmed

  const { data: backdoorRows } = await admin
    .from('backdoor_submissions')
    .select('id, side_claimed, status, screenshot_url, submitter_phone, created_at, reviewed_at, is_dispute, dispute_note')
    .eq('fixture_id', fixture.id)
    .neq('status', 'expired')
    .order('created_at', { ascending: false })

  // Row-derived views used by the backdoor panel: the viewer's own live claim
  // (so the panel can show a status card instead of the empty form again) and
  // every report filed AGAINST the viewer's side (transparency + dispute entry).
  const LIVE_BD = ['pending', 'approved', 'declined']
  const myBackdoorRow =
    (backdoorRows ?? []).find((b: any) => LIVE_BD.includes(b.status) && isMineSubmission(b, viewer)) ?? null
  const reportsAgainstMe = viewer.side
    ? (backdoorRows ?? []).filter(
        (b: any) =>
          (b.status === 'pending' || b.status === 'approved') &&
          !isMineSubmission(b, viewer) &&
          b.side_claimed === viewer.side
      )
    : []
  // Only a report that has actually been APPLIED (approved → the backdoor
  // result is on file) can be disputed: while it is still pending there is
  // nothing to appeal, the admin has not decided yet.
  const disputableReports = reportsAgainstMe.filter((b: any) => b.status === 'approved')

  const { data: requestRow } = await admin
    .from('postpone_requests')
    .select('id, requested_by, requested_by_phone, new_date, reason, status, responded_by, created_at')
    .eq('fixture_id', fixture.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pendingRequest = requestRow && requestRow.status === 'pending' ? requestRow : null
  const requestFromViewer = pendingRequest ? String(pendingRequest.requested_by) === viewer.userId : false

  // 1. Submit result
  // The WhatsApp bot lets a manager override an already-submitted score up to
  // MAX_WHATSAPP_RESETS (2) times via fixtures.whatsapp_reset_count, and lets a
  // backdoor result be replaced by the real score within 7 days. Mirror both.
  const resetCount = fixture.whatsapp_reset_count ?? 0
  const hasApprovedBackdoor = (backdoorRows ?? []).some((b: any) => b.status === 'approved')
  let resultBlock: string | null = null
  let resultNote: string | null = null
  if (viewer.side === null && !viewer.isAdmin) resultBlock = 'Only the two managers can submit a result.'
  else if (fixture.postponed_confirmed && dateKey > todayKey) {
    resultBlock = `This match was postponed to ${labelDate(dateKey)}. The real result can only be submitted on or after that day.`
  } else {
    const winBlock = windowBlock(dateKey)
    if (winBlock) resultBlock = winBlock
    else if (fixture.result && !fixture.postponed_confirmed) {
      if (hasApprovedBackdoor) {
        resultNote =
          'A backdoor result is on file for this game. You can still submit the real score here — it replaces the backdoor result. Open up to 7 days after the deadline.'
      } else if (viewer.isAdmin) {
        resultNote = 'This match already has a result. Submitting replaces it (admins are not limited by the change count).'
      } else if (resetCount >= 2) {
        resultBlock = 'This result has already been changed twice. Ask an admin to change it for you.'
      } else {
        resultNote = `A result is already on file. Submitting replaces it — you have used ${resetCount} of 2 allowed changes.`
      }
    }
  }

  // 4. Postpone
  // Managers have MAX_POSTPONE_DAYS (7) after the deadline to complete a
  // postponement: the requester can still file, and the reviewer can still
  // accept or decline. Auto-finalised placeholders (0-0 void / auto-approved
  // backdoor, finalised_by NULL) are still overridable inside the window; a
  // real played result (finalised_by set or screenshot proof) is final.
  let postponeBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) postponeBlock = 'Only the two managers can request a postponement.'
  else if (isPlaceholder) postponeBlock = 'This match was already postponed. The postpone option is closed.'
  else {
    const winBlock = postponeWindow(dateKey)
    if (winBlock) postponeBlock = winBlock
    else if (isRealResult(fixture.result)) postponeBlock = 'This match already has a result and is now over the deadline — it can no longer be postponed.'
    else if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation' && !fixture.result) {
      postponeBlock = 'This match can no longer be postponed.'
    } else if (viewer.isAdmin && viewer.side === null) {
      postponeBlock = 'Managers request postponements from their own login.'
    }
  }

  // 2. Backdoor
  let backdoorBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) backdoorBlock = 'Only the two managers can report an opponent.'
  else if (isPlaceholder) {
    backdoorBlock = 'This match was postponed and is still to be played. Report the opponent once the new date has passed.'
  } else if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation') {
    backdoorBlock = 'This match is no longer open for opponent-not-responding reports.'
  }

  // 2b. Dispute — an APPEAL against a backdoor that has already been applied to
  // this match. Only an approved report creates something to appeal, so this
  // deliberately ignores backdoorBlock (the report action itself is closed).
  let disputeBlock: string | null = null
  if (viewer.side === null) disputeBlock = 'Only the two managers can dispute a report.'
  else if (isPlaceholder) disputeBlock = 'This match was postponed and is still to be played. Dispute once the new date has passed.'
  else if (fixture.status === 'abandoned') disputeBlock = 'This match has been abandoned.'
  else if (!reportsAgainstMe.length) disputeBlock = 'There is no open report against you in this match, so there is nothing to dispute.'
  else if (!disputableReports.length)
    disputeBlock = 'The report against you is still waiting for review. You can only dispute once the backdoor has been applied.'
  else if (myBackdoorRow?.is_dispute)
    disputeBlock =
      myBackdoorRow.status === 'pending'
        ? 'You have already disputed the applied backdoor. The admin is reviewing both screenshots.'
        : myBackdoorRow.status === 'approved'
          ? 'Your dispute was upheld — the result was changed to a 3-0 win for you.'
          : 'Your dispute was declined, so the applied backdoor result stands.'
  else if (myBackdoorRow?.status === 'pending')
    disputeBlock = 'You already have your own report on this match. Cancel it first if you want to dispute instead.'
  else if (myBackdoorRow)
    disputeBlock = 'Your own report on this match is already decided, so there is nothing further for you to file.'
  else if (disputableReports.every((b: any) => b.is_dispute))
    disputeBlock = 'You have already disputed this backdoor.'

  // The menu entry stays clickable whenever there is a live claim to read or a
  // dispute to file — otherwise a confirmed (backdoor-decided) fixture would
  // hide the status the manager came to check.
  const backdoorMenuBlock =
    backdoorBlock && !myBackdoorRow && disputeBlock ? backdoorBlock : null


  // Names behind the postpone request so the status is readable for any viewer
  // (admins who open a manager's link see who asked and who answered).
  const postponeRequest = requestRow
    ? {
        id: requestRow.id,
        status: requestRow.status,
        newDate: String(requestRow.new_date).slice(0, 10),
        reason: requestRow.reason,
        requestedBy: requestRow.requested_by,
        requestedByName: requestRow.requested_by
          ? await usernameLabel(String(requestRow.requested_by))
          : null,
        mine: String(requestRow.requested_by) === viewer.userId,
        respondedBy: requestRow.responded_by ?? null,
        respondedByName: requestRow.responded_by
          ? await usernameLabel(String(requestRow.responded_by))
          : null,
      }
    : null

  let respondTo: any = null
  if (pendingRequest && viewer.side !== null && !requestFromViewer) {
    respondTo = {
      id: pendingRequest.id,
      newDate: String(pendingRequest.new_date).slice(0, 10),
      reason: pendingRequest.reason,
      fromName: postponeRequest?.requestedByName ?? 'Your opponent',
      mine: false,
    }
  }

  return {
    code,
    fixture: {
      id: fixture.id,
      status: fixture.status,
      scheduledDate: dateKey || null,
      postponedFrom: fixture.postponed_from ? String(fixture.postponed_from).slice(0, 10) : null,
      isPostponed: !!fixture.is_postponed,
      postponedConfirmed: !!fixture.postponed_confirmed,
      tournament: teamName(fixture.tournament),
      roundType: fixture.round_type ?? null,
      home: homeSide(fixture),
      away: awaySide(fixture),
    },
    result: fixture.result
      ? {
          homeScore: fixture.result.home_score,
          awayScore: fixture.result.away_score,
          screenshotUrl: fixture.result.screenshot_url ?? null,
          overrideReason: fixture.result.override_reason ?? null,
        }
      : null,
    backdoor: (backdoorRows ?? []).map((b: any) => ({
      id: b.id,
      side: b.side_claimed,
      status: b.status,
      screenshotUrl: b.screenshot_url ?? null,
      createdAt: b.created_at,
      mine: isMineSubmission(b, viewer),
      isDispute: !!b.is_dispute,
      disputeNote: b.dispute_note ?? null,
    })),
    // The viewer's own live claim (report or dispute) — drives the status card
    // that replaces the form once something has been submitted.
    myBackdoor: myBackdoorRow
      ? {
          id: myBackdoorRow.id,
          side: myBackdoorRow.side_claimed,
          status: myBackdoorRow.status,
          screenshotUrl: myBackdoorRow.screenshot_url ?? null,
          createdAt: myBackdoorRow.created_at,
          reviewedAt: myBackdoorRow.reviewed_at ?? null,
          isDispute: !!myBackdoorRow.is_dispute,
          disputeNote: myBackdoorRow.dispute_note ?? null,
        }
      : null,
    // Reports filed against the viewer's own team (the opponent's claim).
    reportsAgainstMe: reportsAgainstMe.map((b: any) => ({
      id: b.id,
      side: b.side_claimed,
      status: b.status,
      screenshotUrl: b.screenshot_url ?? null,
      createdAt: b.created_at,
      isDispute: !!b.is_dispute,
      disputeNote: b.dispute_note ?? null,
    })),
    postponeRequest,
    respondTo,
    viewer: {
      userId: viewer.userId,
      username: viewer.username,
      side: viewer.side,
      isAdmin: viewer.isAdmin,
    },
    rules: {
      resultBlock,
      resultNote,
      postponeBlock,
      backdoorBlock,
      backdoorMenuBlock,
      disputeBlock,
      // Past the deadline by more than MAX_POSTPONE_DAYS — the 7-day grace
      // period is over and the match can't be changed or postponed anymore.
      graceEnded: postponeWindow(dateKey) !== null,
      canPostpone: !postponeBlock,
      canRequest: !pendingRequest && !postponeBlock,
      canRespond: !!respondTo,
      canDispute: !disputeBlock,
    },
  }
}
