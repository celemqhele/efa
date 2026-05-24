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

  // Fetch tournament type for audit/debug context.
  const { data: tournament, error: tournamentErr } = await db
    .from('tournaments')
    .select('type')
    .eq('id', tournament_id)
    .single()

  if (tournamentErr) return Response.json({ error: tournamentErr.message }, { status: 500 })

  const tournamentType = (tournament as any)?.type ?? 'league'

  // Fetch tournament participants first.
  // This is important because teams with 0 played games must still appear in standings.
  const { data: participants, error: participantsErr } = await db
    .from('tournament_participants')
    .select('team_id, group_name')
    .eq('tournament_id', tournament_id)

  if (participantsErr) return Response.json({ error: participantsErr.message }, { status: 500 })

  const participantRows = (participants ?? []) as any[]

  // Fetch all confirmed fixtures for this tournament with results.
  // Do NOT select fixtures.group_name because that column does not exist.
  const { data: fixtures, error: fxErr } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, results(home_score, away_score, override_reason)')
    .eq('tournament_id', tournament_id)
    .eq('status', 'confirmed')

  if (fxErr) return Response.json({ error: fxErr.message }, { status: 500 })

  const allFixtures = (fixtures ?? []) as any[]

  // Keep support for both normal league tables and UCL/Europa group tables.
  const leagueFixtures = allFixtures.filter((f) => !f.round_type || f.round_type === 'league')
  const groupFixtures = allFixtures.filter((f) => f.round_type === 'group')

  // ── Rebuild league standings ─────────────────────────────────────────────────
  // Seed from tournament_participants so 0-played league teams still appear.
  // For UCL/Europa, this will only run if there are actual league-type fixtures.
  const shouldRebuildLeagueStandings = tournamentType === 'league' || leagueFixtures.length > 0

  if (shouldRebuildLeagueStandings) {
    const { error: deleteErr } = await db
      .from('standings')
      .delete()
      .eq('tournament_id', tournament_id)

    if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 })

    const map: Record<string, any> = {}

    const row = (teamId: string) => {
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

    // Add every participant first, so the table is complete even before games are played.
    for (const p of participantRows) {
      if (p.team_id) row(p.team_id)
    }

    for (const f of leagueFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue

      const { home_score: hs, away_score: as_, override_reason } = result
      const reason = (override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw = hs === as_

      const hr = row(f.home_team_id)
      const ar = row(f.away_team_id)

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
      // We already deleted this tournament's old standings, so insert is enough.
      const { error: insertErr } = await db
        .from('standings')
        .insert(rows)

      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // ── Rebuild group standings ──────────────────────────────────────────────────
  // Seed from tournament_participants so teams with 0 played games still appear.
  const shouldRebuildGroupStandings =
    tournamentType === 'ucl' ||
    tournamentType === 'europa' ||
    groupFixtures.length > 0

  if (shouldRebuildGroupStandings) {
    const teamGroupMap: Record<string, string> = {}
    for (const p of participantRows) {
      if (p.team_id) {
        teamGroupMap[p.team_id] = p.group_name ?? 'A'
      }
    }

    const { error: deleteErr } = await db
      .from('group_standings')
      .delete()
      .eq('tournament_id', tournament_id)

    if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 })

    const gmap: Record<string, any> = {}

    const grow = (teamId: string, fallbackGroupName?: string) => {
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

    // This is the missing piece:
    // add every group participant before applying confirmed results.
    for (const p of participantRows) {
      if (p.team_id) grow(p.team_id, p.group_name ?? 'A')
    }

    for (const f of groupFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue

      const { home_score: hs, away_score: as_, override_reason } = result
      const reason = (override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw = hs === as_

      const homeGroupName = teamGroupMap[f.home_team_id]
      const awayGroupName = teamGroupMap[f.away_team_id]
      const fallbackGroupName = homeGroupName ?? awayGroupName ?? 'A'

      const hr = grow(f.home_team_id, fallbackGroupName)
      const ar = grow(f.away_team_id, fallbackGroupName)

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
      // We already deleted this tournament's old group standings, so insert is enough.
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
      participants: participantRows.length,
      league_fixtures: leagueFixtures.length,
      group_fixtures: groupFixtures.length,
    },
  })

  return Response.json({
    success: true,
    tournament_type: tournamentType,
    participants_processed: participantRows.length,
    league_fixtures_processed: leagueFixtures.length,
    group_fixtures_processed: groupFixtures.length,
  })
}
