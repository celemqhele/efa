import { createAdminClient } from '@/lib/supabase/server'
import { getSastDateKey } from '@/lib/app-time'

// ─── Web submission portal (shared state) ─────────────────────────────────────
// Used by the page (app/submit-match/[code]/page.tsx) for the first render and
// by the API route (app/api/submit-match/route.ts) for the GET refresh, so the
// rules in one place cannot drift from the other.

export const APP_BASE = 'https://efa-fxyk.vercel.app'

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
      is_postponed, postponed_confirmed, home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id),
      tournament:tournaments(name),
      result:results!results_fixture_id_fkey(home_score, away_score, screenshot_url, override_reason, created_at, is_abandoned)
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

function isMineSubmission(row: any, viewer: Viewer): boolean {
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
    .select('id, side_claimed, status, screenshot_url, submitter_phone, created_at')
    .eq('fixture_id', fixture.id)
    .neq('status', 'expired')
    .order('created_at', { ascending: false })

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
  let resultBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) resultBlock = 'Only the two managers can submit a result.'
  else if (fixture.postponed_confirmed && dateKey > todayKey) {
    resultBlock = `This match was postponed to ${labelDate(dateKey)}. The real result can only be submitted on or after that day.`
  } else {
    const winBlock = windowBlock(dateKey)
    if (winBlock) resultBlock = winBlock
    else if (fixture.result && !fixture.postponed_confirmed) {
      resultBlock = `This match already has a result (${teamName(fixture.home_team)} ${fixture.result.home_score}-${fixture.result.away_score} ${teamName(fixture.away_team)}).`
    }
  }

  // 4. Postpone
  let postponeBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) postponeBlock = 'Only the two managers can request a postponement.'
  else if (isPlaceholder) postponeBlock = 'This match was already postponed. The postpone option is closed.'
  else if (fixture.result) postponeBlock = 'This match already has a result.'
  else if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation') postponeBlock = 'This match can no longer be postponed.'
  else if (viewer.isAdmin && viewer.side === null) postponeBlock = 'Managers request postponements from their own login.'

  // 2. Backdoor
  let backdoorBlock: string | null = null
  if (viewer.side === null && !viewer.isAdmin) backdoorBlock = 'Only the two managers can report an opponent.'
  else if (isPlaceholder) {
    backdoorBlock = 'This match was postponed and is still to be played. Report the opponent once the new date has passed.'
  } else if (fixture.status !== 'scheduled' && fixture.status !== 'awaiting_confirmation') {
    backdoorBlock = 'This match is no longer open for opponent-not-responding reports.'
  }

  let respondTo: any = null
  if (pendingRequest && viewer.side !== null && !requestFromViewer) {
    respondTo = {
      id: pendingRequest.id,
      newDate: String(pendingRequest.new_date).slice(0, 10),
      reason: pendingRequest.reason,
      fromName: await usernameLabel(String(pendingRequest.requested_by)),
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
    })),
    postponeRequest: requestRow
      ? {
          id: requestRow.id,
          status: requestRow.status,
          newDate: String(requestRow.new_date).slice(0, 10),
          reason: requestRow.reason,
          requestedBy: requestRow.requested_by,
          mine: String(requestRow.requested_by) === viewer.userId,
          respondedBy: requestRow.responded_by ?? null,
        }
      : null,
    respondTo,
    viewer: {
      userId: viewer.userId,
      username: viewer.username,
      side: viewer.side,
      isAdmin: viewer.isAdmin,
    },
    rules: {
      resultBlock,
      postponeBlock,
      backdoorBlock,
      canPostpone: !postponeBlock,
      canRequest: !pendingRequest && !postponeBlock,
      canRespond: !!respondTo,
    },
  }
}
