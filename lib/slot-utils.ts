import { createAdminClient } from '@/lib/supabase/server'
import { KO_ROUNDS } from '@/lib/tournament-rounds'

type SupabaseClientLike = any

const VACANT_FOLDER = 'custom'
const VACANT_SLUG = 'vacant'

// override_reason prefixes stamped by the auto-forfeit flows. 'absent' keeps the
// standings trigger applying the absentee penalty, and 'both' marks the 0-0 void
// case. clearAutoForfeitResults() withdraws results matching any of these.
const AUTO_FORFEIT_REASON_PREFIXES = [
  'Vacant slot absent',
  'Both slots vacant',
  'Managerless club',
  'Both clubs managerless',
]

export const SACK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// ─── Vacant placeholder team ─────────────────────────────────────────────────
// The slot model renders any ownerless seat as the "Vacant" team (custom/vacant),
// shown with a ShieldQuestion icon. Seeded by migration 066; resolved on demand.
export async function getVacantTeamId(db: SupabaseClientLike): Promise<string> {
  const { data: existing } = await db
    .from('teams')
    .select('id')
    .eq('logo_league_folder', VACANT_FOLDER)
    .eq('logo_team_slug', VACANT_SLUG)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from('teams')
    .insert({
      name: 'Vacant',
      logo_league_folder: VACANT_FOLDER,
      logo_team_slug: VACANT_SLUG,
      manager_id: null,
      abandon_count: 0,
    })
    .select('id')
    .single()

  if (error || !created) throw new Error('Failed to resolve Vacant team: ' + (error?.message ?? ''))
  return created.id
}

// ─── Club binding (tenure-safe transfer, mirrors admin assign route) ──────────
export async function releaseClubsOfManager(
  db: SupabaseClientLike,
  userId: string,
  keepTeamIds: string[] = []
): Promise<void> {
  const { data: managed } = await db
    .from('teams')
    .select('id')
    .eq('manager_id', userId)

  const releaseIds = (managed ?? [])
    .map((t: any) => t.id as string)
    .filter((id: string) => !keepTeamIds.includes(id))

  if (releaseIds.length === 0) return

  const now = new Date().toISOString()
  await db.from('teams').update({ manager_id: null }).in('id', releaseIds)
  await db
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', releaseIds)
    .is('ended_at', null)
}

export async function giveClubToManager(
  db: SupabaseClientLike,
  teamId: string,
  userId: string,
  username?: string
): Promise<{ manager_id: string | null } | null> {
  const { data: team } = await db
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id')
    .eq('id', teamId)
    .single()

  if (!team) return null

  let allClubIds: string[] = [teamId]
  if (team.logo_league_folder && team.logo_team_slug) {
    const { data: siblings } = await db
      .from('teams')
      .select('id')
      .eq('logo_league_folder', team.logo_league_folder)
      .eq('logo_team_slug', team.logo_team_slug)
      .neq('id', teamId)
    allClubIds = [teamId, ...(siblings ?? []).map((s: any) => s.id as string)]
  }

  const now = new Date().toISOString()

  await db
    .from('manager_tenures' as any)
    .update({ ended_at: now })
    .in('team_id', allClubIds)
    .is('ended_at', null)

  const { error: assignErr } = await db
    .from('teams')
    .update({ manager_id: userId })
    .in('id', allClubIds)
  if (assignErr) throw new Error('Failed to assign team: ' + assignErr.message)

  await db.from('manager_tenures' as any).insert(
    allClubIds.map((id) => ({
      team_id: id,
      manager_id: userId,
      manager_username: username ?? 'unknown',
      started_at: now,
    }))
  )

  return team
}

// Resolve the single club a user currently manages (NULL if none).
export async function resolveUserClubId(db: SupabaseClientLike, userId: string): Promise<string | null> {
  const { data } = await db
    .from('teams')
    .select('id')
    .eq('manager_id', userId)
    .limit(1)
  return (data && data[0]?.id) || null
}

// Resolve the club a user manages, ignoring the Vacant placeholder and any
// other excluded team ids. The Vacant placeholder must never count as a club.
export async function resolveUserClubIdExcluding(
  db: SupabaseClientLike,
  userId: string,
  excludeIds: string[]
): Promise<string | null> {
  const { data } = await db
    .from('teams')
    .select('id, logo_league_folder, logo_team_slug')
    .eq('manager_id', userId)
  const row = (data ?? []).find(
    (t: any) => !excludeIds.includes(t.id) && !(t.logo_league_folder === VACANT_FOLDER && t.logo_team_slug === VACANT_SLUG)
  )
  return row?.id ?? null
}

// ─── Slot (tournament seat) management ────────────────────────────────────────
// Vacate every slot a user holds: ownership cleared, seat shown as Vacant.
// Standings continuity is preserved (the seat keeps its points, now under the
// Vacant name); already-played fixtures keep the club that actually played so
// historical matchups stay intact. The seat's remaining fixtures forfeit
// immediately: a vacant side loses 3-0 to its opponent (0-0 void when both
// sides vacant), captured as confirmed-pending results that confirm on the
// fixture's scheduled date (see flip-pending cron).
export async function vacateUserSlots(
  db: SupabaseClientLike,
  userId: string,
  opts?: { vacantTeamId?: string }
): Promise<number> {
  const vacantTeamId = opts?.vacantTeamId ?? (await getVacantTeamId(db))
  if (!vacantTeamId) return 0

  const { data: slots } = await db
    .from('tournament_participants')
    .select('id, tournament_id, team_id')
    .eq('user_id', userId)

  const slotRows = (slots ?? []) as { id: string; tournament_id: string; team_id: string | null }[]
  if (slotRows.length === 0) return 0

  for (const slot of slotRows) {
    const stillHasClub = slot.team_id && slot.team_id !== vacantTeamId
    await db
      .from('tournament_participants')
      .update({
        user_id: null,
        team_id: vacantTeamId,
        // Remember which club this seat represented so a later manager
        // assignment for that club can find and reclaim its own seat
        // (the team_id copy is overwritten with the Vacant placeholder).
        ...(stillHasClub ? { vacated_from_team_id: slot.team_id } : {}),
      })
      .eq('id', slot.id)
  }

  const slotIds = slotRows.map((s) => s.id)

  // Restamp the seat's live references so the vacancy displays as "Vacant":
  // standings/group standings rows and not-yet-played fixtures.
  for (const slot of slotRows) {
    await db
      .from('standings')
      .update({ team_id: vacantTeamId })
      .eq('tournament_id', slot.tournament_id)
      .eq('participant_id', slot.id)
    await db
      .from('group_standings')
      .update({ team_id: vacantTeamId })
      .eq('tournament_id', slot.tournament_id)
      .eq('participant_id', slot.id)
  }

  const pendingStatuses = ['scheduled', 'awaiting_confirmation', 'confirmed_pending']
  await db
    .from('fixtures')
    .update({ home_team_id: vacantTeamId })
    .in('home_participant_id', slotIds)
    .in('status', pendingStatuses)
  await db
    .from('fixtures')
    .update({ away_team_id: vacantTeamId })
    .in('away_participant_id', slotIds)
    .in('status', pendingStatuses)

  // Auto-decide the seat's remaining league/group fixtures: a vacant side
  // forfeits 3-0 to its opponent; both seats vacant voids 0-0. Future-dated
  // results land as 'confirmed_pending' (trigger defers standings), so on
  // fixture day the flip-pending cron confirms and applies them. Human-entered
  // results (finalised_by set) are never overwritten.
  const autoStatuses = ['scheduled', 'confirmed_pending']
  for (const slot of slotRows) {
    const { data: fixtures } = await db
      .from('fixtures')
      .select('id, home_participant_id, away_participant_id, home_team_id, away_team_id, results(finalised_by)')
      .or(`home_participant_id.eq.${slot.id},away_participant_id.eq.${slot.id}`)
      .in('status', autoStatuses)
      .not('scheduled_date', 'is', null)
      .in('round_type', ['league', 'group'])

    for (const fx of (fixtures ?? []) as any[]) {
      const res = Array.isArray(fx.results) ? fx.results[0] : fx.results
      if (res && res.finalised_by) continue

      const homeVacant = fx.home_team_id === vacantTeamId
      const awayVacant = fx.away_team_id === vacantTeamId
      let homeScore: number
      let awayScore: number
      let reason: string
      if (homeVacant && awayVacant) {
        homeScore = 0
        awayScore = 0
        reason = 'Both slots vacant and absent — void (0-0)'
      } else if (homeVacant) {
        homeScore = 0
        awayScore = 3
        reason = 'Vacant slot absent — automatic 0-3'
      } else {
        homeScore = 3
        awayScore = 0
        reason = 'Vacant slot absent — automatic 3-0'
      }

      await db
        .from('results')
        .upsert(
          {
            fixture_id: fx.id,
            home_score: homeScore,
            away_score: awayScore,
            finalised_by: null,
            screenshot_url: null,
            override_reason: reason,
            is_abandoned: false,
            abandoned_type: null,
            pen_home_score: null,
            pen_away_score: null,
          },
          { onConflict: 'fixture_id' }
        )
    }
  }

  return slotIds.length
}

// ─── Managerless club forfeits (sack keeps the club's identity) ────────────────
// A sacked club is NOT relabelled "Vacant": the seat keeps its real club
// (team_id unchanged) and only its ownership is dropped, so standings, history
// and the club's own logo stay intact. Because nobody can play the club's
// remaining fixtures, each one is auto-decided 3-0 against the managerless side
// (0-0 void when BOTH sides are managerless), for every round type — league,
// group and knockout. Future-dated results land as 'confirmed_pending' (the
// insert trigger defers standings), so the flip-pending cron confirms them on
// matchday and advances knockout progression. Human-entered results
// (finalised_by set) are never overwritten.
//
// Reclaimed by reclaimManagerSlots() when a new manager is assigned: the seat
// is restamped with the club and the auto-forfeits are withdrawn.
export async function forfeitUnmanagedClubSlots(
  db: SupabaseClientLike,
  clubTeamIds: string[]
): Promise<{ seats: number; forfeits: number }> {
  const vacantTeamId = await getVacantTeamId(db)
  const clubIds = [...new Set(clubTeamIds)].filter((id) => id && id !== vacantTeamId)
  if (clubIds.length === 0) return { seats: 0, forfeits: 0 }

  // Find every seat these clubs hold. Covers the post-sack state (team_id is
  // still the club, user_id stale) and repairs the legacy placeholder state
  // (team_id overwritten with Vacant, vacated_from_team_id remembers the club).
  const { data: slots } = await db
    .from('tournament_participants')
    .select('id, tournament_id, team_id, user_id, vacated_from_team_id')
    .or(clubIds.map((id) => `team_id.eq.${id},vacated_from_team_id.eq.${id}`).join(','))

  const slotRows = (slots ?? []) as {
    id: string
    tournament_id: string
    team_id: string | null
    user_id: string | null
    vacated_from_team_id: string | null
  }[]
  if (slotRows.length === 0) return { seats: 0, forfeits: 0 }

  const pendingStatuses = ['scheduled', 'awaiting_confirmation', 'confirmed_pending']
  const autoStatuses = ['scheduled', 'confirmed_pending']

  // Drop ownership but KEEP the real club on the seat. A seat left on the
  // placeholder by an older vacating flow is restored to its own club first.
  for (const slot of slotRows) {
    // Prefer the club currently on the seat; fall back to vacated_from_team_id
    // when an older vacating flow already overwrote team_id with the
    // placeholder, so that seat is restored to its own club instead of skipped.
    const clubId =
      slot.team_id && slot.team_id !== vacantTeamId
        ? slot.team_id
        : slot.vacated_from_team_id && clubIds.includes(slot.vacated_from_team_id)
          ? slot.vacated_from_team_id
          : null
    if (!clubId) continue

    await db
      .from('tournament_participants')
      .update({ user_id: null, team_id: clubId, vacated_from_team_id: null })
      .eq('id', slot.id)

    // Restamp live references back to the real club (a no-op when the seat
    // already showed it); played fixtures keep whoever actually played.
    await db
      .from('standings')
      .update({ team_id: clubId })
      .eq('tournament_id', slot.tournament_id)
      .eq('participant_id', slot.id)
    await db
      .from('group_standings')
      .update({ team_id: clubId })
      .eq('tournament_id', slot.tournament_id)
      .eq('participant_id', slot.id)
    await db
      .from('fixtures')
      .update({ home_team_id: clubId })
      .in('home_participant_id', [slot.id])
      .in('status', pendingStatuses)
    await db
      .from('fixtures')
      .update({ away_team_id: clubId })
      .in('away_participant_id', [slot.id])
      .in('status', pendingStatuses)
  }

  // Auto-decide every remaining fixture for these seats — all round types,
  // including knockout ties.
  const seatIds = slotRows.map((s) => s.id)
  const { data: fixtures } = await db
    .from('fixtures')
    .select(
      'id, tournament_id, round_type, scheduled_date, status, home_participant_id, away_participant_id, home_team_id, away_team_id, results(finalised_by, home_score, away_score)'
    )
    .or(seatIds.map((id) => `home_participant_id.eq.${id},away_participant_id.eq.${id}`).join(','))
    .in('status', autoStatuses)
    .not('scheduled_date', 'is', null)

  const fixtureRows = (fixtures ?? []) as any[]
  if (fixtureRows.length === 0) return { seats: seatIds.length, forfeits: 0 }

  // A side is managerless when its seat has no owner. Our own seats were just
  // cleared to user_id NULL above; any other seat in these fixtures is checked
  // directly, so a club sacked earlier in the season counts as managerless too.
  const involvedIds = new Set<string>()
  for (const fx of fixtureRows) {
    if (fx.home_participant_id) involvedIds.add(fx.home_participant_id)
    if (fx.away_participant_id) involvedIds.add(fx.away_participant_id)
  }
  const managedSides = new Set<string>()
  if (involvedIds.size > 0) {
    const { data: ownedSeats } = await db
      .from('tournament_participants')
      .select('id')
      .in('id', [...involvedIds])
      .not('user_id', 'is', null)
    for (const row of (ownedSeats ?? []) as { id: string }[]) managedSides.add(row.id)
  }

  let forfeits = 0
  const koForfeited: any[] = []

  for (const fx of fixtureRows) {
    const res = Array.isArray(fx.results) ? fx.results[0] : fx.results
    if (res && res.finalised_by) continue

    // Skip fixtures whose sides we cannot resolve — guessing would invent a
    // result for a side that may well have a manager.
    if (!fx.home_participant_id || !fx.away_participant_id) continue

    const homeManagerless = !managedSides.has(fx.home_participant_id)
    const awayManagerless = !managedSides.has(fx.away_participant_id)

    let homeScore: number
    let awayScore: number
    let reason: string
    if (homeManagerless && awayManagerless) {
      homeScore = 0
      awayScore = 0
      reason = 'Both clubs managerless and absent — void (0-0)'
    } else if (homeManagerless) {
      homeScore = 0
      awayScore = 3
      reason = 'Managerless club absent — automatic 0-3'
    } else if (awayManagerless) {
      homeScore = 3
      awayScore = 0
      reason = 'Managerless club absent — automatic 3-0'
    } else {
      continue
    }

    await db.from('results').upsert(
      {
        fixture_id: fx.id,
        home_score: homeScore,
        away_score: awayScore,
        finalised_by: null,
        screenshot_url: null,
        override_reason: reason,
        is_abandoned: false,
        abandoned_type: null,
        pen_home_score: null,
        pen_away_score: null,
      },
      { onConflict: 'fixture_id' }
    )
    forfeits++

    if (KO_ROUNDS.includes(fx.round_type ?? '')) {
      koForfeited.push({ ...fx, home_score: homeScore, away_score: awayScore })
    }
  }

  // Advance knockout ties the insert trigger confirmed IMMEDIATELY (due-today or
  // past). Future-dated ones were deferred to 'confirmed_pending' and are
  // advanced by the flip-pending cron instead. Which of the two happened is
  // decided by the trigger using CURRENT_DATE, so the authoritative test is the
  // fixture's stored status after the write — not a date comparison here.
  if (koForfeited.length > 0) {
    const { data: confirmedKo } = await db
      .from('fixtures')
      .select('id, tournament_id, round_type, home_team_id, away_team_id, status')
      .in(
        'id',
        koForfeited.map((f) => f.id)
      )
      .eq('status', 'confirmed')

    const advanced = new Map<string, any>()
    for (const fx of (confirmedKo ?? []) as any[]) {
      const src = koForfeited.find((f) => f.id === fx.id)
      if (src) advanced.set(fx.id, { ...src, ...fx })
    }

    if (advanced.size > 0) {
      const { advanceWinner } = await import('@/lib/tournament-progression')
      for (const fx of advanced.values()) {
        try {
          await advanceWinner(
            db,
            fx.tournament_id,
            fx.id,
            fx.home_score,
            fx.away_score,
            fx.home_team_id ?? null,
            fx.away_team_id ?? null
          )
        } catch (e) {
          console.error('[slot-utils] KO progression after forfeit failed for fixture:', fx.id, e)
        }
      }
    }
  }

  return { seats: seatIds.length, forfeits }
}

// Fill the earliest vacant seat across a season's tournaments. Returns the slot
// that got filled (or null when the season is full / no team resolvable).
export async function fillVacantSlot(
  db: SupabaseClientLike,
  opts: {
    seasonId: string
    userId: string
    teamId?: string | null
    preferTournamentId?: string | null
  }
): Promise<{ participant_id: string; tournament_id: string; team_id: string; team_name: string } | null> {
  const { seasonId, userId } = opts

  const { data: seasonTours } = await db
    .from('tournaments')
    .select('id')
    .eq('season_id', seasonId)
    .order('created_at', { ascending: true })

  const tourIds = (seasonTours ?? []).map((t: any) => t.id as string)
  if (tourIds.length === 0) return null

  // Priority: explicit tournament choice first, then earliest vacant seat overall.
  let query = db
    .from('tournament_participants')
    .select('id, tournament_id')
    .is('user_id', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (opts.preferTournamentId) {
    query = db
      .from('tournament_participants')
      .select('id, tournament_id')
      .eq('tournament_id', opts.preferTournamentId)
      .is('user_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
  }

  const { data: slot } = await query
  if (!slot || slot.length === 0) {
    // fallback search across all season tournaments
    if (!opts.preferTournamentId) {
      const { data: fallback } = await db
        .from('tournament_participants')
        .select('id, tournament_id')
        .in('tournament_id', tourIds)
        .is('user_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
      const fs = fallback && fallback[0]
      if (!fs) return null
      return fillVacantSlot(db, { seasonId, userId, teamId: opts.teamId, preferTournamentId: fs.tournament_id })
    }
    return null
  }

  const participantId: string = slot[0].id
  const tournamentId: string = slot[0].tournament_id
  const vacantTeamId = await getVacantTeamId(db)

  // Resolve the display club:
  //  1. the club the application chose (must be unmanaged)
  //  2. the applicant's current club
  //  3. the Vacant placeholder
  let displayTeamId: string | null = null
  if (opts.teamId) {
    const { data: chosen } = await db
      .from('teams')
      .select('id')
      .eq('id', opts.teamId)
      .is('manager_id', null)
      .maybeSingle()
    if (chosen) displayTeamId = opts.teamId
  }
  if (!displayTeamId) {
    displayTeamId = await resolveUserClubId(db, userId)
  }
  if (!displayTeamId) displayTeamId = vacantTeamId

  // Hand the club to the applicant (releases any other clubs they hold)
  const username = await getProfileUsername(db, userId)
  if (displayTeamId !== vacantTeamId) {
    try {
      await releaseClubsOfManager(db, userId, [displayTeamId])
      await giveClubToManager(db, displayTeamId, userId, username ?? undefined)
    } catch (e) {
      console.error('[slot-utils] transfer club failed, falling back to Vacant:', e)
      displayTeamId = vacantTeamId
    }
  }

  const { data: teamRow } = await db
    .from('teams')
    .select('name')
    .eq('id', displayTeamId)
    .single()

  await db
    .from('tournament_participants')
    .update({ user_id: userId, team_id: displayTeamId, vacated_from_team_id: null })
    .eq('id', participantId)

  // Update display references for this slot so the new club shows for what's
  // still to be played; already-played fixtures keep the club that actually
  // played. Standings/group standings follow the slot's current club.
  const pendingStatuses = ['scheduled', 'awaiting_confirmation', 'confirmed_pending']
  await db
    .from('fixtures')
    .update({ home_team_id: displayTeamId })
    .eq('tournament_id', tournamentId)
    .eq('home_participant_id', participantId)
    .in('status', pendingStatuses)
  await db
    .from('fixtures')
    .update({ away_team_id: displayTeamId })
    .eq('tournament_id', tournamentId)
    .eq('away_participant_id', participantId)
    .in('status', pendingStatuses)

  await db
    .from('standings')
    .update({ team_id: displayTeamId })
    .eq('tournament_id', tournamentId)
    .eq('participant_id', participantId)
  await db
    .from('group_standings')
    .update({ team_id: displayTeamId })
    .eq('tournament_id', tournamentId)
    .eq('participant_id', participantId)

  // The seat may have been forfeited while managerless; withdraw those results
  // so the incoming manager plays its remaining fixtures for real.
  await clearAutoForfeitResults(db, tournamentId, participantId)

  return {
    participant_id: participantId,
    tournament_id: tournamentId,
    team_id: displayTeamId,
    team_name: teamRow?.name ?? 'Vacant',
  }
}

// ─── Reclaim a club's seats after a manager assignment ───────────────────────
// A sack drops the club's seat ownership but leaves the club itself in place
// (forfeitUnmanagedClubSlots) or, on the older path, relabels the seat as a
// Vacant placeholder — and the admin assign flow only updates
// teams.manager_id. Reclaim finds the club's own free seats in every ACTIVE
// tournament (either still showing the club, or stamped with
// vacated_from_team_id when the copy was overwritten) and gives them to the new
// manager. Called after the manager binding is set in all assign paths. Any
// auto-forfeits stamped while the club was managerless are withdrawn here.
export async function reclaimManagerSlots(
  db: SupabaseClientLike,
  managerUserId: string,
  clubTeamId: string
): Promise<number> {
  const { data: active } = await db
    .from('tournaments')
    .select('id')
    .eq('status', 'active')

  let reclaimed = 0
  for (const tour of (active ?? []) as { id: string }[]) {
    const { data: seats } = await db
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tour.id)
      .is('user_id', null)
      .or(`team_id.eq.${clubTeamId},vacated_from_team_id.eq.${clubTeamId}`)

    for (const seat of (seats ?? []) as { id: string }[]) {
      await db
        .from('tournament_participants')
        .update({ user_id: managerUserId, team_id: clubTeamId, vacated_from_team_id: null })
        .eq('id', seat.id)

      // Display references follow the slot's current club for what is still
      // to be played; already-played fixtures keep the club that actually
      // played so historical matchups stay intact.
      const pendingStatuses = ['scheduled', 'awaiting_confirmation', 'confirmed_pending']
      await db
        .from('fixtures')
        .update({ home_team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('home_participant_id', seat.id)
        .in('status', pendingStatuses)
      await db
        .from('fixtures')
        .update({ away_team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('away_participant_id', seat.id)
        .in('status', pendingStatuses)

      await db
        .from('standings')
        .update({ team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('participant_id', seat.id)
      await db
        .from('group_standings')
        .update({ team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('participant_id', seat.id)

      // Withdraw the auto-forfeits the managerless state stamped for this seat
      // so the new manager's club actually plays its remaining fixtures. Without
      // this the club would inherit a run of 0-3 results it never played.
      await clearAutoForfeitResults(db, tour.id, seat.id)

      reclaimed++
    }
  }

  return reclaimed
}

async function getProfileUsername(db: SupabaseClientLike, userId: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('username').eq('id', userId).maybeSingle()
  return data?.username ?? null
}

// ─── Vacant placeholder take-over (admin assign on the Vacant team page) ──────
// The Vacant placeholder team (custom/vacant) is not a real club, so assigning
// a manager to it must NOT bind them to it as a second club. When the assigned
// user already manages a club, that club replaces the Vacant seat(s) instead:
// the seat keeps its standings (slot-follows-team) and the new club actually
// plays the seat's remaining fixtures. Adopted from `reclaimManagerSlots`; the
// difference is the seat is found by the Vacant placeholder team rather than by
// a vacated club id.
export function isVacantPlaceholderTeam(team: {
  logo_league_folder?: string | null
  logo_team_slug?: string | null
}): boolean {
  return !!team && team.logo_league_folder === VACANT_FOLDER && team.logo_team_slug === VACANT_SLUG
}

export async function assignVacantSeatToManager(
  db: SupabaseClientLike,
  managerUserId: string,
  vacantTeamId: string
): Promise<{ action: 'claim' | 'fill'; clubTeamId: string | null; clubName: string | null; filled: number }> {
  // A manager who already runs a club replaces the Vacant seat with that club.
  // A manager with no club claims ownership ("claim"): user_id is stamped on
  // the vacant seats so they can't be taken by someone else, while the seat
  // keeps showing the Vacant placeholder until the manager gets a club.
  const clubTeamId = await resolveUserClubIdExcluding(db, managerUserId, [vacantTeamId])
  if (!clubTeamId) return claimVacantSeats(db, managerUserId, vacantTeamId)

  const { data: clubRow } = await db
    .from('teams')
    .select('name')
    .eq('id', clubTeamId)
    .maybeSingle()
  const clubName = clubRow?.name ?? null

  const { data: active } = await db
    .from('tournaments')
    .select('id')
    .eq('status', 'active')

  const pendingStatuses = ['scheduled', 'awaiting_confirmation', 'confirmed_pending']
  let filled = 0

  for (const tour of (active ?? []) as { id: string }[]) {
    // Never give a club a second seat in an already-entered tournament.
    const { data: clubSeats } = await db
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tour.id)
      .eq('team_id', clubTeamId)
      .limit(1)
    if ((clubSeats ?? []).length > 0) continue

    const { data: seats } = await db
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tour.id)
      .eq('team_id', vacantTeamId)
      .or(`user_id.is.null,user_id.eq.${managerUserId}`)

    for (const seat of (seats ?? []) as { id: string }[]) {
      await db
        .from('tournament_participants')
        .update({ user_id: managerUserId, team_id: clubTeamId, vacated_from_team_id: null })
        .eq('id', seat.id)

      // Display references follow the slot's new club for what is still to be
      // played; already-played fixtures keep the club that actually played.
      await db
        .from('fixtures')
        .update({ home_team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('home_participant_id', seat.id)
        .in('status', pendingStatuses)
      await db
        .from('fixtures')
        .update({ away_team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('away_participant_id', seat.id)
        .in('status', pendingStatuses)

      await db
        .from('standings')
        .update({ team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('participant_id', seat.id)
      await db
        .from('group_standings')
        .update({ team_id: clubTeamId })
        .eq('tournament_id', tour.id)
        .eq('participant_id', seat.id)

      // Withdraw the seat's auto-forfeit results (vacuation stamped them for
      // the absent slot) so the replacing club plays its remaining fixtures.
      await clearAutoForfeitResults(db, tour.id, seat.id)

      filled++
    }
  }

  return { action: 'fill', clubTeamId, clubName, filled }
}

// A manager with no club owns the vacant seat(s) but keeps showing the Vacant
// placeholder. The seat is only stamped with user_id (display team_id and the
// seat's pending fixtures stay Vacant); a later real fill resolves it into the
// manager's club.
async function claimVacantSeats(
  db: SupabaseClientLike,
  managerUserId: string,
  vacantTeamId: string
): Promise<{ action: 'claim'; clubTeamId: null; clubName: null; filled: number }> {
  const { data: active } = await db
    .from('tournaments')
    .select('id')
    .eq('status', 'active')

  let filled = 0
  for (const tour of (active ?? []) as { id: string }[]) {
    const { data: seats } = await db
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tour.id)
      .eq('team_id', vacantTeamId)
      .is('user_id', null)

    for (const seat of (seats ?? []) as { id: string }[]) {
      await db
        .from('tournament_participants')
        .update({ user_id: managerUserId })
        .eq('id', seat.id)
      filled++
    }
  }

  return { action: 'claim', clubTeamId: null, clubName: null, filled }
}

// Remove auto-generated forfeit results (finalised_by NULL, stamped by
// `vacateUserSlots` or `forfeitUnmanagedClubSlots`) on a seat's not-yet-played
// fixtures, and restore any confirmed_pending fixture back to 'scheduled' so it
// is a normal fixture again. Human-entered results (finalised_by set) are never
// touched.
export async function clearAutoForfeitResults(
  db: SupabaseClientLike,
  tournamentId: string,
  participantId: string
): Promise<number> {
  const { data: fixtures } = await db
    .from('fixtures')
    .select('id, status')
    .or(`home_participant_id.eq.${participantId},away_participant_id.eq.${participantId}`)
    .eq('tournament_id', tournamentId)
    .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed_pending'])

  const fixtureRows = (fixtures ?? []) as { id: string; status: string }[]
  if (fixtureRows.length === 0) return 0

  const fixtureIds = fixtureRows.map((f) => f.id)

  const { data: candidates } = await db
    .from('results')
    .select('fixture_id, override_reason, finalised_by')
    .in('fixture_id', fixtureIds)
    .is('finalised_by', null)

  const autoFixtureIds = (candidates ?? [])
    .filter((r: any) => {
      const reason = (r.override_reason ?? '') as string
      return AUTO_FORFEIT_REASON_PREFIXES.some((p) => reason.startsWith(p))
    })
    .map((r: any) => r.fixture_id)

  if (autoFixtureIds.length === 0) return 0

  await db.from('results').delete().in('fixture_id', autoFixtureIds)

  const resetFixtureIds = fixtureRows
    .filter((f) => f.status === 'confirmed_pending' && autoFixtureIds.includes(f.id))
    .map((f) => f.id)
  if (resetFixtureIds.length > 0) {
    await db.from('fixtures').update({ status: 'scheduled' }).in('id', resetFixtureIds)
  }

  return autoFixtureIds.length
}

// ─── Season applications ──────────────────────────────────────────────────────
export async function approveSeasonApplication(
  db: SupabaseClientLike,
  applicationId: string,
  adminId: string,
  opts?: { override?: boolean }
): Promise<{ success: boolean; message: string; cooldown_ends_at?: string }> {
  const { data: app } = await db
    .from('tournament_applications')
    .select(`
      id, season_id, applicant_id, team_id, status,
      applicant:profiles!tournament_applications_applicant_id_fkey(id, username, sacked_at)
    `)
    .eq('id', applicationId)
    .single()

  if (!app) return { success: false, message: 'Application not found.' }
  if (app.status !== 'pending') return { success: false, message: 'That application is no longer pending.' }

  const applicant = Array.isArray(app.applicant) ? app.applicant[0] : app.applicant
  const applicantId: string = app.applicant_id

  if (!opts?.override && applicant?.sacked_at) {
    const cooldownEnds = new Date(new Date(applicant.sacked_at).getTime() + SACK_COOLDOWN_MS)
    if (cooldownEnds.getTime() > Date.now()) {
      return {
        success: false,
        message: `@${applicant.username} was recently sacked. They can be approved from ${cooldownEnds.toISOString()}.`,
        cooldown_ends_at: cooldownEnds.toISOString(),
      }
    }
  }

  const filled = await fillVacantSlot(db, {
    seasonId: app.season_id,
    userId: applicantId,
    teamId: app.team_id,
  })

  if (!filled) {
    await db.from('tournament_applications').update({
      status: 'denied',
      review_note: 'Season is currently full — no vacant seat available.',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    }).eq('id', applicationId)
    return { success: false, message: 'Season is full — no vacant seat to fill.' }
  }

  const now = new Date().toISOString()

  await db.from('tournament_applications').update({
    status: 'approved',
    team_id: filled.team_id,
    reviewed_at: now,
    reviewed_by: adminId,
  }).eq('id', applicationId)

  // Deny the applicant's other pending season applications
  await db.from('tournament_applications').update({
    status: 'denied',
    reviewed_at: now,
    reviewed_by: adminId,
  }).eq('applicant_id', applicantId).eq('status', 'pending').neq('id', applicationId)

  const notifications: any[] = [{
    user_id: applicantId,
    type: 'season_application_approved',
    title: 'Application Approved!',
    body: `You have been added to the season as manager of ${filled.team_name}. Good luck!`,
    data: { season_id: app.season_id, team_id: filled.team_id, team_name: filled.team_name },
  }]

  try {
    const { insertNotificationsAndPush } = await import('@/lib/notify')
    await insertNotificationsAndPush(db, notifications)
  } catch (e) {
    console.error('[slot-utils] application approved notify failed:', e)
  }

  try {
    await db.from('audit_log').insert({
      admin_id: adminId,
      action: 'approve_tournament_application',
      target_type: 'season',
      target_id: app.season_id,
      details: {
        applicant_id: applicantId,
        applicant_username: applicant?.username ?? '',
        team_id: filled.team_id,
        team_name: filled.team_name,
        tournament_id: filled.tournament_id,
        participant_id: filled.participant_id,
      },
    })
  } catch (e) {
    console.error('[slot-utils] application audit log failed:', e)
  }

  return { success: true, message: `@${applicant?.username ?? 'user'} has been added to the season as manager of ${filled.team_name}.` }
}

// Helper to wire slot refs on fixtures at insert time (used by creation flows).
export async function stampFixtureParticipants<T extends { home_team_id: string | null; away_team_id: string | null }>(
  db: SupabaseClientLike,
  tournamentId: string,
  fixtures: T[]
): Promise<Array<T & { home_participant_id: string | null; away_participant_id: string | null }>> {
  if (fixtures.length === 0) return []

  const teamIds = Array.from(new Set(
    fixtures.flatMap((f) => [f.home_team_id, f.away_team_id]).filter((x): x is string => !!x)
  ))

  const participantByTeam: Record<string, string> = {}
  if (teamIds.length > 0) {
    const { data: rows } = await db
      .from('tournament_participants')
      .select('id, team_id')
      .eq('tournament_id', tournamentId)
      .in('team_id', teamIds)
    for (const row of rows ?? []) {
      if (row.team_id) participantByTeam[row.team_id] = row.id
    }
    // Create missing participants so every fixture side has a slot
    const missing = teamIds.filter((id) => !participantByTeam[id])
    if (missing.length > 0) {
      const { data: inserted } = await db
        .from('tournament_participants')
        .insert(missing.map((team_id) => ({ tournament_id: tournamentId, team_id })))
        .select('id, team_id')
      for (const row of inserted ?? []) {
        if (row.team_id) participantByTeam[row.team_id] = row.id
      }
    }
  }

  return fixtures.map((f) => ({
    ...f,
    home_participant_id: f.home_team_id ? (participantByTeam[f.home_team_id] ?? null) : null,
    away_participant_id: f.away_team_id ? (participantByTeam[f.away_team_id] ?? null) : null,
  }))
}

// Sugar wrapper for server routes that want the admin client directly.
export async function withAdminClient<T>(fn: (db: SupabaseClientLike) => Promise<T>): Promise<T> {
  const db = await createAdminClient()
  return fn(db)
}