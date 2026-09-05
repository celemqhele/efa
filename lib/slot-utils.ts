import { createAdminClient } from '@/lib/supabase/server'

type SupabaseClientLike = any

const VACANT_FOLDER = 'custom'
const VACANT_SLUG = 'vacant'

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

  return {
    participant_id: participantId,
    tournament_id: tournamentId,
    team_id: displayTeamId,
    team_name: teamRow?.name ?? 'Vacant',
  }
}

// ─── Reclaim a club's seats after a manager assignment ───────────────────────
// A sack turns the club's seat into a Vacant slot (ownership cleared, team_id
// swapped to the Vacant placeholder) and the admin assign flow only updates
// teams.manager_id — so the club "split" into a Vacant seat plus phantom rows
// from its already-played fixtures. Reclaim finds the club's own free seats in
// every ACTIVE tournament (either still showing the club, or stamped with
// vacated_from_team_id when the copy was overwritten) and gives them to the
// new manager. Called after the manager binding is set in all assign paths.
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

      reclaimed++
    }
  }

  return reclaimed
}

async function getProfileUsername(db: SupabaseClientLike, userId: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('username').eq('id', userId).maybeSingle()
  return data?.username ?? null
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