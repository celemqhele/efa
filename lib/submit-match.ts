import { createAdminClient } from '@/lib/supabase/server'
import { getSastDateKey } from '@/lib/app-time'

// ─── Web submission portal (shared state) ─────────────────────────────────────
// Used by the page (app/submit-match/[code]/page.tsx) for the first render and
// by the API route (app/api/submit-match/route.ts) for the GET refresh, so the
// rules in one place cannot drift from the other.

export const APP_BASE = 'https://efa-fxyk.vercel.app'

// How long after the deadline (the fixture's scheduled match day) a manager may
// still submit a result / backdoor report or request a postponement: the match
// day PLUS the next day (1 day of grace). Once lapsed the match is final for
// managers — only an admin can still edit it.
export const GRACE_DAYS = 1

// How far ahead a new postponement date may be moved (future side of the
// proposed date).
export const MAX_POSTPONE_DAYS = 7

// How long the opponent has to accept or decline a postponement request before
// it is auto-declined and the match stays on its original date.
export const POSTPONE_RESPONSE_HOURS = 24

// A manager may only hold ONE postponement request open at a time (across all
// their matches), and once a request is APPROVED they must wait this many hours
// before asking for another. Only approved requests start the cooldown — a
// declined or auto-expired request never does. The one-at-a-time half is also
// enforced in the database by the partial unique index
// postpone_requests_pending_requester_idx (migration 103).
export const POSTPONE_COOLDOWN_HOURS = 24

// Whether a postponement request still holds its answer slot. A 'pending' row
// whose POSTPONE_RESPONSE_HOURS window has lapsed is dead — the opponent never
// answered — even if the DB still says 'pending': the auto-decline cron is
// DAILY on the Vercel Hobby plan, so it can run up to ~24h late. Anything that
// reads a request must use this instead of testing `status === 'pending'`
// directly, otherwise a lapsed row blocks a manager from asking again AND the
// partial unique indexes on postpone_requests (one live request per manager /
// per fixture, migration 103) reject the replacement row with 23505.
// Mirrors the cron's cutoff: created_at < now - POSTPONE_RESPONSE_HOURS.
export function postponeRequestIsLive(row: any, now: number = Date.now()): boolean {
  if (!row || row.status !== 'pending') return false
  if (!row.created_at) return true
  return now - new Date(row.created_at).getTime() <= POSTPONE_RESPONSE_HOURS * 60 * 60 * 1000
}

// A result is 'real' when someone actually recorded the game (a manager proof
// upload or an admin decision). Auto-finalised outcomes (0-0 void / auto-approved
// backdoor) have no finalised_by or screenshot and can still be replaced by an
// agreed postponement inside the after-deadline grace window.
// The grace period runs for GRACE_DAYS (1) after the match's scheduled (match)
// day. While it is open a manager can still POSTPONE the fixture or CHANGE an
// already-settled (real) result. Once it has lapsed (dateKey strictly before
// today-1) the match is final for managers — only an admin can still edit it.
// Completing a result for the first time (replacing a 0-0 void or an
// auto-approved backdoor placeholder) follows the same submission window.
export function gracePeriodEnded(dateKey: string, now = new Date()): boolean {
  if (!dateKey) return false
  return dateKey < getSastDateKey(now, -GRACE_DAYS)
}

export function deadlineBlock(dateKey: string, now = new Date()): string | null {
  if (!dateKey) return null
  if (gracePeriodEnded(dateKey, now)) {
    return 'This match is past its deadline, so it can no longer be changed, reported or postponed.'
  }
  return null
}

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
  // Whether the manager still wants WhatsApp match reminders (profiles column,
  // default true). Drives the portal's yes/no toggle and - through the same flag
  // - the greying-out of their WhatsApp reminder buttons on the admin dashboard.
  openToReminders: boolean
}

export function dateKeyOf(fixture: any): string {
  if (!fixture?.scheduled_date) return ''
  return String(fixture.scheduled_date).slice(0, 10)
}

// Same window as the bot (webhook route.ts submissionBlockReason): today-1..today+7.
// A match may be submitted on its match day and the day after (GRACE_DAYS), or
// up to 7 days in the future (held as 'confirmed_pending' until then).
export function windowBlock(dateKey: string, now = new Date()): string | null {
  if (!dateKey) return null
  const startKey = getSastDateKey(now, -GRACE_DAYS)
  const endKey = getSastDateKey(now, 7)
  if (dateKey >= startKey && dateKey <= endKey) return null
  if (dateKey > endKey) {
    const d = new Date(`${dateKey}T00:00:00.000Z`)
    const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    return `This game is more than 7 days away, so it can't be submitted yet. Come back on the match day (${label}).`
  }
  return 'This match is older than a day, so it can no longer be submitted here. Send the result on the match day or the day after.'
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
    .select('username, role, phone, open_to_reminders')
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
    openToReminders: profile?.open_to_reminders !== false,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Look up an actor's display name + role by user id (uuid) or phone number
// (digits-normalised). backdoor_submissions.submitter_phone stores whichever the
// submitter used: a WhatsApp number via the bot, or a profile id via the portal.
export function actorOf(
  actors: Map<string, { name: string; role: string | null }>,
  key: string | null | undefined
): { name: string; role: string | null } | null {
  if (!key) return null
  const raw = String(key)
  if (UUID_RE.test(raw)) return actors.get(raw) ?? null
  const digits = raw.replace(/\D/g, '')
  return digits ? actors.get(digits) ?? null : null
}

// Resolve display names (+ roles) for every identity key behind a fixture's
// records in one batched fetch, so the UI can say who submitted / approved /
// declined what (player, admin, or system).
export async function loadActorNames(
  admin: any,
  keys: (string | null | undefined)[]
): Promise<Map<string, { name: string; role: string | null }>> {
  const actors = new Map<string, { name: string; role: string | null }>()
  if (!keys.some(Boolean)) return actors
  const { data: profiles } = await admin.from('profiles').select('id, username, role, phone')
  for (const p of (profiles ?? []) as any[]) {
    if (!p.username) continue
    const actor = { name: p.username, role: p.role ?? null }
    actors.set(String(p.id), actor)
    if (p.phone) actors.set(String(p.phone).replace(/\D/g, ''), actor)
  }
  return actors
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
    .select('id, side_claimed, status, screenshot_url, submitter_phone, created_at, reviewed_at, reviewed_by, is_dispute, dispute_note')
    .eq('fixture_id', fixture.id)
    .neq('status', 'expired')
    .order('created_at', { ascending: false })

  // Every actor behind the records shown on this page (the result's finaliser,
  // each backdoor report's submitter + reviewer) so the UI can attribute them.
  const actors = await loadActorNames(admin, [
    ...(backdoorRows ?? []).map((b: any) => b.submitter_phone),
    ...(backdoorRows ?? []).map((b: any) => b.reviewed_by),
    fixture.result?.finalised_by,
  ])

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

  // The viewer's own postponement activity, for the "one at a time" + "1-day
  // cooldown after an approved one" rule. A live request on ANOTHER match blocks
  // a new request here, and an approved request puts the manager on cooldown.
  // Declined / auto-expired requests are never returned (only approved count),
  // and a 'pending' row whose 24h answer window has lapsed (postponeRequestIsLive)
  // is treated as gone so it cannot block a fresh ask while the daily
  // auto-decline cron is still catching up.
  const { data: myPostponeRows } = await admin
    .from('postpone_requests')
    .select('id, fixture_id, status, responded_at, updated_at, created_at')
    .eq('requested_by', viewer.userId)
    .in('status', ['pending', 'accepted'])

  const myOtherPending = (myPostponeRows ?? []).find(
    (r: any) => postponeRequestIsLive(r) && String(r.fixture_id) !== String(fixture.id)
  )
  const myApprovedAtMs = (myPostponeRows ?? [])
    .filter((r: any) => r.status === 'accepted')
    .reduce((max: number, r: any) => {
      const t = new Date(r.responded_at ?? r.updated_at).getTime()
      return t > max ? t : max
    }, 0)
  const myCooldownUntilMs = myApprovedAtMs + POSTPONE_COOLDOWN_HOURS * 60 * 60 * 1000
  const myCooldownUntil = myApprovedAtMs > 0 && Date.now() < myCooldownUntilMs ? new Date(myCooldownUntilMs) : null

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
      // A settled (real) result is final once the deadline passes: no score
      // changes, no backdoor-replacement edits — only an admin can still change it.
      if (deadlineBlock(dateKey) && isRealResult(fixture.result) && !viewer.isAdmin) {
        resultBlock =
          'This match is past its deadline, so its result can no longer be changed. Ask an admin if something went wrong.'
      } else if (hasApprovedBackdoor) {
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
  // Managers can request a postponement on the match day or the day after
  // (GRACE_DAYS). Once that has passed the match is final as-is: it may be a
  // real played result, or it will be auto-finalised and replaced with a real
  // first submission. A live request holds the fixture open for its 24-hour
  // response window, during which the opponent can accept or decline.
  let postponeBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) postponeBlock = 'Only the two managers can request a postponement.'
  else if (isPlaceholder) postponeBlock = 'This match was already postponed. The postpone option is closed.'
  else {
    const dlBlock = deadlineBlock(dateKey)
    if (dlBlock) postponeBlock = 'This match is past its deadline, so it can no longer be postponed.'
    else if (isRealResult(fixture.result)) postponeBlock = 'This match already has a result, so it can no longer be postponed.'
    else if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation' && !fixture.result) {
      postponeBlock = 'This match can no longer be postponed.'
    } else if (viewer.isAdmin && viewer.side === null) {
      postponeBlock = 'Managers request postponements from their own login.'
    } else if (myOtherPending) {
      postponeBlock = 'You already have a postponement waiting for an answer. Only one at a time — wait for that one to be resolved.'
    } else if (myCooldownUntil) {
      postponeBlock = `You can only postpone one match a day. You can ask again after ${myCooldownUntil.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' })}.`
    }
  }

  // 2. Backdoor
  let backdoorBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) backdoorBlock = 'Only the two managers can report an opponent.'
  else if (isPlaceholder) {
    backdoorBlock = 'This match was postponed and is still to be played. Report the opponent once the new date has passed.'
  } else if (deadlineBlock(dateKey)) {
    backdoorBlock = 'This match is past its deadline, so the opponent can no longer be reported here.'
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
  // (admins who open a manager's link see who asked and who answered). expiresAt
  // is the end of the opponent's 24-hour answer window.
  const postponeExpiresAt = requestRow?.created_at
    ? new Date(new Date(requestRow.created_at).getTime() + POSTPONE_RESPONSE_HOURS * 60 * 60 * 1000).toISOString()
    : null
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
        createdAt: requestRow.created_at ?? null,
        expiresAt: postponeExpiresAt,
      }
    : null

  // A pending request whose 24-hour answer window has lapsed is treated as
  // expired here so the portal stops offering accept/decline in the gap before
  // the hourly expire cron (or the auto-finalise cron) declines it in the DB.
  const postponeExpired = !!postponeExpiresAt && Date.now() > new Date(postponeExpiresAt).getTime()

  let respondTo: any = null
  if (pendingRequest && viewer.side !== null && !requestFromViewer) {
    respondTo = {
      id: pendingRequest.id,
      newDate: String(pendingRequest.new_date).slice(0, 10),
      reason: pendingRequest.reason,
      fromName: postponeRequest?.requestedByName ?? 'Your opponent',
      expiresAt: postponeExpiresAt,
      expired: postponeExpired,
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
          isAbandoned: !!fixture.result.is_abandoned,
          finalisedBy: fixture.result.finalised_by ?? null,
          finalisedByName: actorOf(actors, fixture.result.finalised_by)?.name ?? null,
          finalisedByRole: actorOf(actors, fixture.result.finalised_by)?.role ?? null,
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
      submitterName: actorOf(actors, b.submitter_phone)?.name ?? null,
      reviewedByName: b.reviewed_by ? actorOf(actors, b.reviewed_by)?.name ?? null : null,
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
          submitterName: actorOf(actors, myBackdoorRow.submitter_phone)?.name ?? null,
          reviewedByName: myBackdoorRow.reviewed_by
            ? actorOf(actors, myBackdoorRow.reviewed_by)?.name ?? null
            : null,
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
      submitterName: actorOf(actors, b.submitter_phone)?.name ?? null,
    })),
    postponeRequest,
    respondTo,
    viewer: {
      userId: viewer.userId,
      username: viewer.username,
      side: viewer.side,
      isAdmin: viewer.isAdmin,
      openToReminders: viewer.openToReminders,
    },
    rules: {
      resultBlock,
      resultNote,
      postponeBlock,
      backdoorBlock,
      backdoorMenuBlock,
      disputeBlock,
      // True once the grace period (match day + 1) has lapsed — no more
      // changes, reports or postponements for managers.
      graceEnded: gracePeriodEnded(dateKey),
      canPostpone: !postponeBlock,
      canRequest: !pendingRequest && !postponeBlock,
      canRespond: !!respondTo && !postponeExpired,
      canDispute: !disputeBlock,
    },
  }
}
