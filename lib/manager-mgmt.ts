import { insertNotificationsAndPush } from './notify'
import {
  SACK_COOLDOWN_MS,
  assignVacantSeatToManager,
  forfeitUnmanagedClubSlots,
  isVacantPlaceholderTeam,
  reclaimManagerSlots,
} from './slot-utils'

type Db = any

// A manager with nothing to manage. `sackedAt` is carried so a picker can route
// the selection through the cooldown override step before writing anything.
export type MgmtManagerOption = { id: string; username: string; sackedAt: string | null }

// ─── Cooldown ─────────────────────────────────────────────────────────────────
// A sack stamps profiles.sacked_at on the *person*, so it benches them from
// taking any club for a week — even one they were never sacked from. Both entry
// points (the web admin and the WhatsApp manager-management flow) need the same
// check, so the arithmetic lives here and both read the same answer.
export function getCooldownEndsAt(sackedAt: string | null | undefined): string | null {
  if (!sackedAt) return null
  const ends = new Date(new Date(sackedAt).getTime() + SACK_COOLDOWN_MS)
  return ends.getTime() > Date.now() ? ends.toISOString() : null
}

// ─── Manager applications ─────────────────────────────────────────────────────
// A pending application is only meaningful while the applicant manages nothing.
// Once a club is bound to them the application has been fulfilled, so it must
// leave the pending list instead of lingering as "(no team yet)" forever.
//
// This has to run on *every* path that binds a manager to a club, not just the
// dedicated "manager applications" flow — the WhatsApp manager-management menu
// and the web admin both call assignManagerToClub directly, and they used to
// leave the applicant's application pending. The oldest pending application is
// approved and stamped with the club; the rest are denied, mirroring what the
// applications flow does by hand.
//
// Applications are bookkeeping, never the point of an assignment, so any failure
// here is logged and swallowed rather than failing the assignment itself.
export async function closePendingManagerApplications(
  db: Db,
  opts: { userId: string; teamId: string; adminId: string | null }
): Promise<number> {
  const { userId, teamId, adminId } = opts

  try {
    const { data: pending, error } = await db
      .from('manager_applications')
      .select('id, team_id, created_at')
      .eq('applicant_id', userId)
      .eq('status', 'pending')

    if (error || !pending?.length) return 0

    const now = new Date().toISOString()
    // Oldest first: the application that has been waiting longest is the one the
    // club answers. A team-less application is preferred over one that named a
    // different club, since this assignment is what finally gave them a team.
    const ordered = [...(pending as any[])].sort((a, b) => {
      const aBlank = a.team_id ? 1 : 0
      const bBlank = b.team_id ? 1 : 0
      if (aBlank !== bBlank) return aBlank - bBlank
      return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    })

    const keepId = ordered[0].id
    await db
      .from('manager_applications')
      .update({ status: 'approved', team_id: teamId, reviewed_at: now, reviewed_by: adminId })
      .eq('id', keepId)

    const restIds = ordered.slice(1).map((a) => a.id)
    if (restIds.length) {
      await db
        .from('manager_applications')
        .update({ status: 'denied', reviewed_at: now, reviewed_by: adminId })
        .in('id', restIds)
    }

    // Anyone else waiting on this club has just lost it.
    await db
      .from('manager_applications')
      .update({ status: 'denied', reviewed_at: now, reviewed_by: adminId })
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .neq('applicant_id', userId)

    return ordered.length
  } catch (e) {
    console.error('[manager-mgmt] closing pending applications failed:', e)
    return 0
  }
}

// ─── Club resolution ──────────────────────────────────────────────────────────
// The web admin can add a club the site has never seen by logo, so assignment
// has to be able to create the row. WhatsApp never does this (it only offers
// clubs that already hold a seat) but shares the function so both paths behave
// identically if one ever does.
export async function resolveOrCreateTeam(
  db: Db,
  teamId: string | null | undefined,
  logo: { folder?: string; slug?: string; name?: string } = {}
): Promise<{ ok: true; teamId: string } | { ok: false; message: string }> {
  if (teamId) return { ok: true, teamId }

  const { folder, slug, name } = logo
  if (!folder || !slug) return { ok: false, message: 'team_id or logo info is required' }

  const { data: existing } = await db
    .from('teams')
    .select('id')
    .eq('logo_team_slug', slug)
    .eq('logo_league_folder', folder)
    .maybeSingle()

  if (existing) return { ok: true, teamId: existing.id }

  const { data: created, error } = await db
    .from('teams')
    .insert({
      name: name || slug,
      logo_league_folder: folder,
      logo_team_slug: slug,
      abandon_count: 0,
    })
    .select('id')
    .single()

  if (error || !created) return { ok: false, message: 'Failed to create team: ' + (error?.message ?? '') }
  return { ok: true, teamId: created.id }
}

// A club is often stored as several teams rows sharing one logo (one per
// competition folder). Every write has to hit all of them or the club ends up
// half-managed.
async function getClubRowIds(db: Db, teamId: string): Promise<string[]> {
  const { data: team } = await db
    .from('teams')
    .select('id, logo_league_folder, logo_team_slug')
    .eq('id', teamId)
    .maybeSingle()

  if (!team?.logo_league_folder || !team?.logo_team_slug) return [teamId]

  const { data: siblings } = await db
    .from('teams')
    .select('id')
    .eq('logo_league_folder', team.logo_league_folder)
    .eq('logo_team_slug', team.logo_team_slug)
    .neq('id', teamId)

  return [teamId, ...((siblings ?? []) as { id: string }[]).map((s) => s.id)]
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export type AssignOutcome =
  | { ok: true; action: 'assigned'; teamName: string; username: string; reclaimed: number }
  | { ok: true; action: 'claim' | 'fill'; teamName: string; username: string; clubName: string | null; filled: number }
  | { ok: false; code: 'SACK_COOLDOWN'; cooldownEndsAt: string }
  | { ok: false; code: 'ERROR'; message: string }

export async function assignManagerToClub(
  db: Db,
  opts: { teamId: string; userId: string; adminId: string | null; override?: boolean }
): Promise<AssignOutcome> {
  const { teamId, userId, adminId, override = false } = opts

  const [{ data: team }, { data: targetProfile }] = await Promise.all([
    db.from('teams').select('id, name, logo_league_folder, logo_team_slug, manager_id').eq('id', teamId).single(),
    db.from('profiles').select('id, username, sacked_at').eq('id', userId).single(),
  ])

  if (!team) return { ok: false, code: 'ERROR', message: 'Team not found' }
  if (!targetProfile) return { ok: false, code: 'ERROR', message: 'User not found' }

  if (!override) {
    const cooldownEndsAt = getCooldownEndsAt(targetProfile.sacked_at)
    if (cooldownEndsAt) return { ok: false, code: 'SACK_COOLDOWN', cooldownEndsAt }
  }

  const allClubIds = await getClubRowIds(db, teamId)
  const isVacant = isVacantPlaceholderTeam(team)

  // The Vacant placeholder is not a real club, so it never gets a
  // teams.manager_id or a tenure. The incoming manager instead takes over the
  // vacant seat(s) via assignVacantSeatToManager.
  if (!isVacant) {
    const { error: updateErr } = await db.from('teams').update({ manager_id: userId }).in('id', allClubIds)
    if (updateErr) return { ok: false, code: 'ERROR', message: updateErr.message }

    const now = new Date().toISOString()

    await db.from('manager_tenures').update({ ended_at: now }).in('team_id', allClubIds).is('ended_at', null)
    await db.from('manager_tenures').insert(
      allClubIds.map((id) => ({
        team_id: id,
        manager_id: userId,
        manager_username: targetProfile.username,
        started_at: now,
      }))
    )
  }

  await db.from('audit_log').insert({
    admin_id: adminId,
    action: 'assign_manager',
    target_type: 'team',
    target_id: teamId,
    details: {
      team_name: team.name,
      assigned_user_id: userId,
      username: targetProfile.username,
      override_cooldown: override && isCooldownFlagged(targetProfile.sacked_at),
    },
  })

  // The applicant now has a club, so any application they filed is fulfilled:
  // approve the oldest and deny the rest, which clears them from the pending
  // applications list whichever entry point the admin used.
  await closePendingManagerApplications(db, { userId, teamId, adminId })

  if (isVacant) {
    const result = await assignVacantSeatToManager(db, userId, teamId)
    return {
      ok: true,
      action: result.action === 'claim' ? 'claim' : 'fill',
      teamName: team.name,
      username: targetProfile.username,
      clubName: result.clubName ?? null,
      filled: result.filled,
    }
  }

  const reclaimed = await reclaimManagerSlots(db, userId, teamId)
  return { ok: true, action: 'assigned', teamName: team.name, username: targetProfile.username, reclaimed }
}

function isCooldownFlagged(sackedAt: string | null): boolean {
  return getCooldownEndsAt(sackedAt) !== null
}

// ─── Sack ─────────────────────────────────────────────────────────────────────

export type SackOutcome =
  | { ok: true; teamName: string; userId: string; username: string; forfeits: number }
  | { ok: false; code: 'ERROR'; message: string }

// Removes the manager from one club. The club keeps its identity: manager_id is
// cleared but the club stays on its seats, and its remaining fixtures are booked
// 3-0. Other clubs the same manager holds are untouched. profiles.sacked_at is
// stamped on the person, which is what benches them league-wide for a week.
export async function sackManagerFromClub(
  db: Db,
  opts: { teamId: string; adminId: string | null }
): Promise<SackOutcome> {
  const { teamId, adminId } = opts

  const { data: team } = await db
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', teamId)
    .single()

  if (!team) return { ok: false, code: 'ERROR', message: 'Team not found' }
  if (!team.manager_id) return { ok: false, code: 'ERROR', message: 'Team has no manager to remove' }

  const sackUserId = team.manager_id
  const now = new Date().toISOString()

  const { data: sackedProfile } = await db
    .from('profiles')
    .select('username')
    .eq('id', sackUserId)
    .maybeSingle()

  await db.from('profiles').update({ sacked_at: now }).eq('id', sackUserId)

  const allClubIds = await getClubRowIds(db, teamId)

  const { error: updateErr } = await db.from('teams').update({ manager_id: null }).in('id', allClubIds)
  if (updateErr) return { ok: false, code: 'ERROR', message: updateErr.message }

  const { forfeits } = await forfeitUnmanagedClubSlots(db, allClubIds)

  await db.from('manager_tenures').update({ ended_at: now }).in('team_id', allClubIds).is('ended_at', null)

  try {
    await insertNotificationsAndPush(db, {
      user_id: sackUserId,
      type: 'sacking',
      title: 'You have been sacked',
      body: `Your management of ${team.name} has ended. You can pick a new team.`,
      data: { team_id: teamId, team_name: team.name },
    })
  } catch (e) {
    console.error('[manager-mgmt] notify failed:', e)
  }

  await db.from('audit_log').insert({
    admin_id: adminId,
    action: 'sack_manager',
    target_type: 'team',
    target_id: teamId,
    details: { team_name: team.name, sacked_user_id: sackUserId, forfeits_scheduled: forfeits },
  })

  return {
    ok: true,
    teamName: team.name,
    userId: sackUserId,
    username: sackedProfile?.username ?? 'Unknown',
    forfeits,
  }
}

// ─── Listing (read-only) ───────────────────────────────────────────────────────

function mgmtClubKey(t: { logo_league_folder: string | null; logo_team_slug: string | null; id: string }): string {
  if (t.logo_league_folder && t.logo_team_slug) return `${t.logo_league_folder}/${t.logo_team_slug}`
  return t.id
}

function isVacantClubKey(key: string): boolean {
  return key === 'custom/vacant'
}

export type ActiveClub = {
  teamId: string
  clubKey: string
  name: string
  managed: boolean
  managerId: string | null
  managerUsername: string | null
  division: number | null
  tournaments: string[]
}

// Every club holding a seat in an active tournament, deduped by club. A club is
// usually several teams rows sharing one logo (one per competition folder) and
// can hold seats in several competitions at once, so all sibling rows are
// collapsed into one entry. `managed` is true if ANY row has a manager, which is
// how the assign/sack writers treat ownership.
export async function loadActiveClubs(db: Db): Promise<ActiveClub[]> {
  const { data: tournaments } = await db
    .from('tournaments')
    .select('id, name, division')
    .eq('status', 'active')

  const activeTours = (tournaments ?? []) as { id: string; name: string; division: number | null }[]
  if (activeTours.length === 0) return []

  const tourById = new Map(activeTours.map((t) => [t.id, t]))

  const { data: participants } = await db
    .from('tournament_participants')
    .select('team_id, tournament_id')
    .in('tournament_id', activeTours.map((t) => t.id))

  const teamIdsInPlay = new Set<string>()
  const tourNamesByTeam = new Map<string, string[]>()
  const divisionByTeam = new Map<string, number | null>()

  for (const p of (participants ?? []) as { team_id: string; tournament_id: string }[]) {
    const tour = tourById.get(p.tournament_id)
    if (!tour) continue
    teamIdsInPlay.add(p.team_id)

    const names = tourNamesByTeam.get(p.team_id)
    if (names) {
      if (!names.includes(tour.name)) names.push(tour.name)
    } else tourNamesByTeam.set(p.team_id, [tour.name])

    // The leagues carry the division; cups and friendlies have none, so only
    // overwrite when this competition actually has one.
    if (tour.division !== null) divisionByTeam.set(p.team_id, tour.division)
  }

  if (teamIdsInPlay.size === 0) return []

  const { data: allTeams } = await db
    .from('teams')
    .select('id, name, manager_id, logo_league_folder, logo_team_slug')

  const allTeamRows = (allTeams ?? []) as {
    id: string
    name: string
    manager_id: string | null
    logo_league_folder: string | null
    logo_team_slug: string | null
  }[]

  const rowsByClub = new Map<string, typeof allTeamRows>()
  for (const t of allTeamRows) {
    const key = mgmtClubKey(t)
    const list = rowsByClub.get(key)
    if (list) list.push(t)
    else rowsByClub.set(key, [t])
  }

  const { data: managers } = await db.from('profiles').select('id, username')
  const usernameById = new Map(
    ((managers ?? []) as { id: string; username: string | null }[]).map((p) => [p.id, p.username])
  )

  const out: ActiveClub[] = []
  const seen = new Set<string>()

  for (const teamId of teamIdsInPlay) {
    const row = allTeamRows.find((t) => t.id === teamId)
    if (!row) continue

    const clubKey = mgmtClubKey(row)
    if (seen.has(clubKey)) continue
    seen.add(clubKey)

    const rows = rowsByClub.get(clubKey) ?? [row]
    const managerId = rows.find((r) => r.manager_id)?.manager_id ?? null

    const tours = new Set<string>()
    let division: number | null = null
    for (const r of rows) {
      for (const name of tourNamesByTeam.get(r.id) ?? []) tours.add(name)
      const d = divisionByTeam.get(r.id)
      if (d !== undefined && d !== null) division = d
    }

    out.push({
      teamId: row.id,
      clubKey,
      name: row.name,
      managed: managerId !== null,
      managerId,
      managerUsername: managerId ? usernameById.get(managerId) ?? null : null,
      division,
      tournaments: [...tours],
    })
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

// Clubs with no manager on any sibling row, holding a seat in at least one active
// competition. The Vacant placeholder is excluded: it is not a club, and
// assigning to it runs assignVacantSeatToManager (claiming an empty seat) rather
// than handing someone a team.
export async function listManagerlessClubs(
  db: Db,
  opts: { division?: number } = {}
): Promise<ActiveClub[]> {
  const clubs = await loadActiveClubs(db)
  return clubs.filter(
    (c) =>
      !c.managed &&
      !isVacantClubKey(c.clubKey) &&
      (opts.division === undefined || c.division === opts.division)
  )
}

// Managed clubs inside one active competition — the sack flow's club list.
export async function listManagedClubsInTournament(db: Db, tournamentName: string): Promise<ActiveClub[]> {
  const clubs = await loadActiveClubs(db)
  return clubs.filter((c) => c.managed && c.tournaments.includes(tournamentName))
}

// Managers with nothing to manage: no teams row points at them and no tournament
// seat is theirs. Cooldown is deliberately NOT filtered out — the caller's job is
// to show them and route the pick through the override step, mirroring the web
// admin's override button.
export async function listFreeManagers(db: Db, excludeIds: string[] = []): Promise<MgmtManagerOption[]> {
  const busy = new Set<string>(excludeIds)

  const [{ data: teams }, { data: seats }] = await Promise.all([
    db.from('teams').select('manager_id'),
    db.from('tournament_participants').select('user_id'),
  ])

  for (const t of (teams ?? []) as { manager_id: string | null }[]) {
    if (t.manager_id) busy.add(t.manager_id)
  }
  for (const s of (seats ?? []) as { user_id: string | null }[]) {
    if (s.user_id) busy.add(s.user_id)
  }

  const { data: profiles } = await db
    .from('profiles')
    .select('id, username, sacked_at')

  // Map rather than cast: the row comes back as `sacked_at`, but the pickers read
  // `sackedAt`. A bare cast let the snake_case row through and every cooldown
  // check silently saw undefined, so the override step never appeared.
  return ((profiles ?? []) as { id: string; username: string; sacked_at: string | null }[])
    .map((p) => ({ id: p.id, username: p.username, sackedAt: p.sacked_at ?? null }))
    .filter((p) => !busy.has(p.id))
    .sort((a, b) => a.username.localeCompare(b.username))
}

// ─── Promote (move a manager up a division) ────────────────────────────────────
// Releasing the club the same way a sack does would stamp profiles.sacked_at and
// bench the manager for a week, which is wrong for a promotion. So this path
// clears the old club and forfeits its fixtures (so the vacated div-2 seat does
// not quietly keep collecting auto-wins) but never sets a cooldown and never
// sends the "you have been sacked" notification.
export type PromoteOutcome =
  | { ok: true; teamName: string; username: string; releasedClubs: number; forfeits: number; reclaimed: number }
  | { ok: false; code: 'SACK_COOLDOWN'; cooldownEndsAt: string }
  | { ok: false; code: 'ERROR'; message: string }

// Checks every assign-side rule WITHOUT writing anything. Promotion is a
// release-then-assign sequence, so a guard that only runs after the release can
// strand the manager with no club at all. Callers run this first and only
// proceed once it comes back clean.
async function preflightAssign(
  db: Db,
  opts: { teamId: string; userId: string; override?: boolean }
): Promise<{ ok: true } | { ok: false; code: 'SACK_COOLDOWN'; cooldownEndsAt: string } | { ok: false; code: 'ERROR'; message: string }> {
  const { teamId, userId, override = false } = opts

  const [{ data: team }, { data: targetProfile }] = await Promise.all([
    db.from('teams').select('id, name, manager_id').eq('id', teamId).maybeSingle(),
    db.from('profiles').select('id, username, sacked_at').eq('id', userId).maybeSingle(),
  ])

  if (!team) return { ok: false, code: 'ERROR', message: 'Destination club not found.' }
  if (!targetProfile) return { ok: false, code: 'ERROR', message: 'Manager not found.' }

  if (team.manager_id === userId) {
    return { ok: false, code: 'ERROR', message: 'That is already the manager’s club.' }
  }

  if (!override) {
    const cooldownEndsAt = getCooldownEndsAt(targetProfile.sacked_at)
    if (cooldownEndsAt) return { ok: false, code: 'SACK_COOLDOWN', cooldownEndsAt }
  }

  return { ok: true }
}

export async function promoteManagerToClub(
  db: Db,
  opts: { fromTeamId: string; toTeamId: string; userId: string; adminId: string | null; override?: boolean }
): Promise<PromoteOutcome> {
  const { fromTeamId, toTeamId, userId, adminId, override = false } = opts

  if (fromTeamId === toTeamId) {
    return { ok: false, code: 'ERROR', message: 'That is already the manager’s club.' }
  }

  // Nothing below this line may run until the destination side is known good.
  const pre = await preflightAssign(db, { teamId: toTeamId, userId, override })
  if (!pre.ok) return pre

  const { data: fromProfile } = await db
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()
  const username = fromProfile?.username ?? 'Unknown'

  // Every club row (siblings across competition folders) the outgoing manager owns.
  const oldClubIds = await getClubRowIds(db, fromTeamId)

  // 1. Release the old club(s): manager_id cleared, tenures closed.
  const now = new Date().toISOString()
  await db.from('teams').update({ manager_id: null }).in('id', oldClubIds)
  await db.from('manager_tenures').update({ ended_at: now }).in('team_id', oldClubIds).is('ended_at', null)

  // 2. The vacated club's remaining fixtures forfeit so the div-2 seat does not
  //    linger as an unowned-but-scoring side.
  const { forfeits } = await forfeitUnmanagedClubSlots(db, oldClubIds)

  // 3. Bind the manager to the destination club (reclaims its vacant seats).
  const assign = await assignManagerToClub(db, { teamId: toTeamId, userId, adminId, override })
  if (!assign.ok) {
    // Only reachable for a write error: the preflight already cleared the
    // rule-based failures, so this must not leave the manager clubless.
    const reason = assign.code === 'SACK_COOLDOWN' ? `cooldown until ${assign.cooldownEndsAt}` : assign.message
    return {
      ok: false,
      code: 'ERROR',
      message: `Released ${username} from the old club, but the move failed: ${reason}. The old club is now managerless.`,
    }
  }

  await db.from('audit_log').insert({
    admin_id: adminId,
    action: 'promote_manager',
    target_type: 'team',
    target_id: toTeamId,
    details: {
      username,
      promoted_user_id: userId,
      from_team_id: fromTeamId,
      to_team_id: toTeamId,
      forfeits_scheduled: forfeits,
    },
  })

  return {
    ok: true,
    teamName: assign.teamName,
    username,
    releasedClubs: oldClubIds.length,
    forfeits,
    reclaimed: assign.action === 'assigned' ? assign.reclaimed : assign.filled,
  }
}

// Read-only preview for the promotion warning: how many not-yet-resulted
// fixtures the outgoing club currently has across active tournaments. Counted
// before anything is written so the confirm step can name the real consequence.
export async function countPendingFixturesForClub(db: Db, teamId: string): Promise<number> {
  const { data: tournaments } = await db.from('tournaments').select('id').eq('status', 'active')
  if (!tournaments?.length) return 0

  const { data: fixtures } = await db
    .from('fixtures')
    .select('id, status, results(finalised_by)')
    .in('tournament_id', (tournaments as any[]).map((t) => t.id))
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .in('status', ['scheduled', 'confirmed_pending'])
    .not('scheduled_date', 'is', null)

  return (fixtures ?? []).filter((fx: any) => {
    const res = Array.isArray(fx.results) ? fx.results[0] : fx.results
    return !res?.finalised_by
  }).length
}
// Runs the sack first, then the assignment. The assignment's reclaim step finds
// the seats the sack just released (user_id back to null) and hands them to the
// incoming manager, which also withdraws the auto-forfeits the sack booked — so
// the club ends up fully owned with no phantom 3-0 results.
//
// If the sack succeeds and the assignment does not, the club is left managerless
// and still forfeited, which is the same state a plain sack produces. That is
// reported rather than hidden so the admin can re-run an assignment.
export type ReplaceOutcome =
  | { ok: true; teamName: string; sackedUsername: string; username: string; forfeits: number; reclaimed: number }
  | { ok: false; code: 'ERROR'; message: string; sacked?: boolean }

export async function replaceManagerOnClub(
  db: Db,
  opts: {
    teamId: string
    fromUserId: string
    toUserId: string
    adminId: string | null
    override?: boolean
  }
): Promise<ReplaceOutcome> {
  const { teamId, fromUserId, toUserId, adminId, override = false } = opts

  if (fromUserId === toUserId) {
    return { ok: false, code: 'ERROR', message: 'The replacement is the same manager being sacked.' }
  }

  // Run every destination-side rule BEFORE sacking anyone, so a refusal leaves
  // the current manager in place instead of leaving the club managerless.
  const pre = await preflightAssign(db, { teamId, userId: toUserId, override })
  if (!pre.ok) {
    return {
      ok: false,
      code: 'ERROR',
      message:
        pre.code === 'SACK_COOLDOWN'
          ? `Replacement is in cooldown until ${pre.cooldownEndsAt}. Re-run with the override step to continue.`
          : pre.message,
    }
  }

  const sack = await sackManagerFromClub(db, { teamId, adminId })
  if (!sack.ok) return { ok: false, code: 'ERROR', message: sack.message }

  const assign = await assignManagerToClub(db, { teamId, userId: toUserId, adminId, override: true })
  if (!assign.ok) {
    const reason = assign.code === 'SACK_COOLDOWN' ? `cooldown until ${assign.cooldownEndsAt}` : assign.message
    return {
      ok: false,
      code: 'ERROR',
      message: `${sack.username} was sacked, but the replacement failed: ${reason}. The club is managerless and needs a new manager.`,
      sacked: true,
    }
  }

  return {
    ok: true,
    teamName: sack.teamName,
    sackedUsername: sack.username,
    username: assign.username,
    forfeits: sack.forfeits,
    reclaimed: assign.action === 'assigned' ? assign.reclaimed : assign.filled,
  }
}