import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { resolveUserClubId } from '@/lib/slot-utils'

type TournamentType = Database['public']['Tables']['tournaments']['Insert']['type']

async function resolveUsersToClubs(db: any, userIds: string[]): Promise<{ user_id: string; team_id: string }[]> {
  const resolved: { user_id: string; team_id: string }[] = []
  for (const uid of userIds) {
    const team_id = await resolveUserClubId(db, uid)
    if (!team_id) throw new Error('User has no managed team')
    resolved.push({ user_id: uid, team_id })
  }
  return resolved
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: _adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any
  const adminProfile = _adminProfile as any

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    season_id?: string
    season_name?: string
    base_league?: string
    name: string
    type: TournamentType
    start_date?: string
    end_date?: string
    users?: string[]
    teams?: {
      id: string | null
      name: string
      logo_league_folder: string
      logo_team_slug: string
      manager_id: string | null
    }[]
    settings?: any
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    season_id,
    season_name,
    base_league,
    name,
    type,
    start_date,
    end_date,
    users,
    teams,
    settings: customSettings,
  } = body

  if (!name || !type || (!teams || teams.length === 0) && (!users || users.length === 0)) {
    return Response.json(
      { error: 'name, type, and a list of teams or users are required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

  // 1. Resolve slot entries: either (user_id, current club) pairs, or legacy bare teams
  const userSlots: { user_id: string; team_id: string }[] = []
  const resolvedTeamIds: string[] = []

  if (users && users.length > 0) {
    const clubs = await resolveUsersToClubs(adminSupabase, users)
    userSlots.push(...clubs)
    resolvedTeamIds.push(...clubs.map((c) => c.team_id))
  } else {
    for (const team of teams ?? []) {
      if (team.id) {
        resolvedTeamIds.push(team.id)
        if (team.manager_id) {
          await db('teams').update({ manager_id: team.manager_id }).eq('id', team.id).is('manager_id', null)
        }
      } else {
        const { data: existing } = await db('teams')
          .select('id')
          .eq('logo_team_slug', team.logo_team_slug)
          .eq('logo_league_folder', team.logo_league_folder)
          .maybeSingle()

        if (existing) {
          resolvedTeamIds.push(existing.id)
          if (team.manager_id) {
            await db('teams').update({ manager_id: team.manager_id }).eq('id', existing.id).is('manager_id', null)
          }
        } else {
          const { data: newTeam, error: createErr } = await db('teams')
            .insert({
              name: team.name,
              logo_league_folder: team.logo_league_folder,
              logo_team_slug: team.logo_team_slug,
              manager_id: team.manager_id,
              abandon_count: 0
            })
            .select('id')
            .single()

          if (createErr || !newTeam) {
            return Response.json({ error: `Failed to create team ${team.name}: ${createErr?.message}` }, { status: 500 })
          }
          resolvedTeamIds.push(newTeam.id)
        }
      }
    }
  }

  let resolvedSeasonId: string | null = season_id ?? null

  if (!resolvedSeasonId && season_name) {
    const { data: newSeason, error: seasonError } = await db('seasons')
      .insert({
        name: season_name,
        base_league: base_league ?? 'default',
        status: 'active',
      })
      .select('id')
      .single()

    if (seasonError || !newSeason) {
      return Response.json(
        { error: seasonError?.message ?? 'Failed to create season' },
        { status: 500 }
      )
    }

    resolvedSeasonId = newSeason.id
  }

  const settings = {
    ...(start_date ? { start_date } : {}),
    ...(end_date ? { end_date } : {}),
    ...customSettings,
  }

  const { data: tournament, error: tournamentError } = await db('tournaments')
    .insert({
      season_id: resolvedSeasonId,
      name,
      type,
      status: 'active',
      settings,
    })
    .select('id')
    .single()

  if (tournamentError || !tournament) {
    return Response.json(
      { error: tournamentError?.message ?? 'Failed to create tournament' },
      { status: 500 }
    )
  }

  const tournament_id = tournament.id

  const participantRows = resolvedTeamIds
    .map((team_id) => {
      const slot = userSlots.find((s) => s.team_id === team_id)
      return slot
        ? { tournament_id, team_id, user_id: slot.user_id }
        : { tournament_id, team_id }
    })

  const { data: insertedParticipants, error: participantsError } = await db('tournament_participants')
    .insert(participantRows)
    .select('id, team_id')

  if (participantsError) {
    return Response.json({ error: participantsError.message }, { status: 500 })
  }

  const participantByTeamId = new Map<string, string>()
  for (const row of insertedParticipants ?? []) {
    if (row.team_id) participantByTeamId.set(row.team_id, row.id)
  }

  if (type === 'league') {
    const standingRows = resolvedTeamIds
      .map((team_id) => ({
        tournament_id,
        team_id,
        participant_id: participantByTeamId.get(team_id) ?? null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
      goals_against: 0,
      points: 0,
      form: '',
      unbeaten_run: 0,
      clean_sheets: 0,
    }))

    const { error: standingsError } = await db('standings')
      .insert(standingRows)

    if (standingsError) {
      console.error('Failed to create standings:', standingsError.message)
    }
  } else if (type === 'friendlies' && resolvedTeamIds.length >= 2) {
    // Friendlies now created without auto-fixtures
  }

  await db('audit_log').insert({
    admin_id: user.id,
    action: 'create_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {
      name,
      type,
      season_id: resolvedSeasonId,
      team_count: resolvedTeamIds.length,
    },
  })

  return Response.json({ success: true, tournament_id })
}
