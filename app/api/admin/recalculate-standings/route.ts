import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tournament_id } = body
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const db = await createAdminClient()

  const { data: tournament, error: tournamentErr } = await db
    .from('tournaments')
    .select('type')
    .eq('id', tournament_id)
    .single()

  if (tournamentErr) return Response.json({ error: tournamentErr.message }, { status: 500 })

  const tournamentType = (tournament as any)?.type ?? 'league'

  // Participants are the source of truth for teams that should appear,
  // including teams that have not played yet.
  const { data: participants, error: participantsErr } = await db
    .from('tournament_participants')
    .select('team_id, group_name')
    .eq('tournament_id', tournament_id)

  if (participantsErr) return Response.json({ error: participantsErr.message }, { status: 500 })

  // Fetch confirmed fixtures only for calculating played stats.
  // Do not select fixtures.group_name because that column does not exist.
  const { data: fixtures, error: fxErr } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, results(home_score, away_score, override_reason)')
    .eq('tournament_id', tournament_id)
    .eq('status', 'confirmed')

  if (fxErr) return Response.json({ error: fxErr.message }, { status: 500 })

  const allFixtures = (fixtures ?? []) as any[]

  const leagueFixtures = tournamentType === 'league'
    ? allFixtures.filter((f) => !f.round_type || f.round_type === 'league')
    : []

  const groupFixtures = tournamentType === 'ucl' || tournamentType === 'europa'
    ? allFixtures.filter((f) => f.round_type === 'group')
    : []

  // ── Rebuild league standings ─────────────────────────────────────────────────
  // League tables should include every participant, even teams with 0 played.
  if (tournamentType === 'league') {
    const { error: deleteErr } = await db
      .from('standings')
      .delete()
      .eq('tournament_id', tournament_id)

    if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 })

    const map: Record<string, any> = {}

    const row = (teamId: string) => {
      if (!teamId) return null

      if (!map[teamId]) {
        map[teamId] = {
          tournament_id,
          team_id: teamId,
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
        }
      }

      return map[teamId]
    }

    for (const p of participants ?? []) {
      row((p as any).team_id)
    }

    for (const f of leagueFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue

      const hs = Number(result.home_score)
      const as_ = Number(result.away_score)
      if (!Number.isFinite(hs) || !Number.isFinite(as_)) continue

      const reason = String(result.override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const hr = row(f.home_team_id)
      const ar = row(f.away_team_id)
      if (!hr || !ar) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw = hs === as_

      hr.played++
      ar.played++

      hr.wins += homeWin ? 1 : 0
      ar.wins += awayWin ? 1 : 0

      hr.draws += draw ? 1 : 0
      ar.draws += draw ? 1 : 0

      hr.losses += awayWin ? 1 : 0
      ar.losses += homeWin ? 1 : 0

      hr.goals_for += hs
      ar.goals_for += as_

      hr.goals_against += as_
      ar.goals_against += hs

      hr.points += homeWin ? 3 : draw ? 1 : 0
      ar.points += awayWin ? 3 : draw ? 1 : 0

      hr.form = (hr.form + (homeWin ? 'W' : draw ? 'D' : 'L')).slice(-5)
      ar.form = (ar.form + (awayWin ? 'W' : draw ? 'D' : 'L')).slice(-5)

      hr.unbeaten_run = homeWin || draw ? hr.unbeaten_run + 1 : 0
      ar.unbeaten_run = awayWin || draw ? ar.unbeaten_run + 1 : 0

      hr.clean_sheets += as_ === 0 ? 1 : 0
      ar.clean_sheets += hs === 0 ? 1 : 0
    }

    const rows = Object.values(map)
    if (rows.length > 0) {
      const { error: insertErr } = await db
        .from('standings')
        .insert(rows)

      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // ── Rebuild group standings ──────────────────────────────────────────────────
  // UCL/Europa group tables should include every grouped participant,
  // even teams with 0 played.
  if (tournamentType === 'ucl' || tournamentType === 'europa') {
    const { error: deleteErr } = await db
      .from('group_standings')
      .delete()
      .eq('tournament_id', tournament_id)

    if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 })

    const teamGroupMap: Record<string, string> = {}
    const gmap: Record<string, any> = {}

    const grow = (teamId: string, fallbackGroupName?: string | null) => {
      if (!teamId) return null

      const groupName = teamGroupMap[teamId] ?? fallbackGroupName ?? 'A'
      const key = `${groupName}:${teamId}`

      if (!gmap[key]) {
        gmap[key] = {
          tournament_id,
          group_name: groupName,
          team_id: teamId,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0,
        }
      }

      return gmap[key]
    }

    // Seed every participant first. This is the part that stops 0-played teams disappearing.
    for (const p of participants ?? []) {
      const teamId = (p as any).team_id
      if (!teamId) continue

      const groupName = (p as any).group_name ?? 'A'
      teamGroupMap[teamId] = groupName
      grow(teamId, groupName)
    }

    // Apply confirmed group results on top of the seeded rows.
    for (const f of groupFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue

      const hs = Number(result.home_score)
      const as_ = Number(result.away_score)
      if (!Number.isFinite(hs) || !Number.isFinite(as_)) continue

      const reason = String(result.override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeGroupName = teamGroupMap[f.home_team_id]
      const awayGroupName = teamGroupMap[f.away_team_id]
      const fallbackGroupName = homeGroupName ?? awayGroupName ?? 'A'

      const hr = grow(f.home_team_id, fallbackGroupName)
      const ar = grow(f.away_team_id, fallbackGroupName)
      if (!hr || !ar) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw = hs === as_

      hr.played++
      ar.played++

      hr.wins += homeWin ? 1 : 0
      ar.wins += awayWin ? 1 : 0

      hr.draws += draw ? 1 : 0
      ar.draws += draw ? 1 : 0

      hr.losses += awayWin ? 1 : 0
      ar.losses += homeWin ? 1 : 0

      hr.goals_for += hs
      ar.goals_for += as_

      hr.goals_against += as_
      ar.goals_against += hs

      hr.points += homeWin ? 3 : draw ? 1 : 0
      ar.points += awayWin ? 3 : draw ? 1 : 0
    }

    const rows = Object.values(gmap)
    if (rows.length > 0) {
      const { error: insertErr } = await db
        .from('group_standings')
        .insert(rows)

      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }
  }

  await db.from('audit_log').insert({
    admin_id: user.id,
    action: 'recalculate_standings',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {
      tournament_type: tournamentType,
      participants: (participants ?? []).length,
      league_fixtures: leagueFixtures.length,
      group_fixtures: groupFixtures.length,
    },
  })

  return Response.json({
    success: true,
    tournament_type: tournamentType,
    participants_processed: (participants ?? []).length,
    league_fixtures_processed: leagueFixtures.length,
    group_fixtures_processed: groupFixtures.length,
  })
}
