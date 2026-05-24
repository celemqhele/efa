import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { tournament_id: string }
  try { body = await request.json() }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { tournament_id } = body
  if (!tournament_id) return Response.json({ error: 'tournament_id required' }, { status: 400 })

  const db = await createAdminClient()

  // Fetch tournament type so we know how to categorise fixtures
  const { data: tournament } = await db
    .from('tournaments')
    .select('type')
    .eq('id', tournament_id)
    .single()

  const tournamentType = (tournament as any)?.type ?? 'league'

  // Fetch all confirmed fixtures for this tournament with results.
  // group_name is needed because group_standings.group_name is NOT NULL.
  const { data: fixtures, error: fxErr } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, round_type, group_name, results(home_score, away_score, override_reason)')
    .eq('tournament_id', tournament_id)
    .eq('status', 'confirmed')

  if (fxErr) return Response.json({ error: fxErr.message }, { status: 500 })

  const allFixtures = (fixtures ?? []) as any[]

  // For league tournaments: treat null/league round_type as league fixtures
  // For UCL/Europa: treat 'group' round_type as group fixtures
  const leagueFixtures = tournamentType === 'league'
    ? allFixtures.filter((f) => !f.round_type || f.round_type === 'league')
    : []
  const groupFixtures = (tournamentType === 'ucl' || tournamentType === 'europa')
    ? allFixtures.filter((f) => f.round_type === 'group')
    : []

  // ── Rebuild league standings ─────────────────────────────────────────────────
  if (leagueFixtures.length > 0) {
    await db.from('standings').delete().eq('tournament_id', tournament_id)

    const map: Record<string, any> = {}

    const row = (teamId: string) => {
      if (!map[teamId]) map[teamId] = {
        tournament_id, team_id: teamId,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, points: 0,
        form: '', unbeaten_run: 0, clean_sheets: 0,
      }
      return map[teamId]
    }

    for (const f of leagueFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue
      const { home_score: hs, away_score: as_, override_reason } = result
      const reason = (override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw    = hs === as_

      const hr = row(f.home_team_id)
      const ar = row(f.away_team_id)

      hr.played++;  ar.played++
      hr.wins         += homeWin ? 1 : 0;   ar.wins         += awayWin ? 1 : 0
      hr.draws        += draw    ? 1 : 0;   ar.draws        += draw    ? 1 : 0
      hr.losses       += awayWin ? 1 : 0;   ar.losses       += homeWin ? 1 : 0
      hr.goals_for    += hs;                ar.goals_for    += as_
      hr.goals_against += as_;              ar.goals_against += hs
      hr.points       += homeWin ? 3 : draw ? 1 : 0
      ar.points       += awayWin ? 3 : draw ? 1 : 0
      hr.form          = (hr.form + (homeWin ? 'W' : draw ? 'D' : 'L')).slice(-5)
      ar.form          = (ar.form + (awayWin ? 'W' : draw ? 'D' : 'L')).slice(-5)
      hr.unbeaten_run  = homeWin || draw ? hr.unbeaten_run + 1 : 0
      ar.unbeaten_run  = awayWin || draw ? ar.unbeaten_run + 1 : 0
      hr.clean_sheets += as_ === 0 ? 1 : 0
      ar.clean_sheets += hs  === 0 ? 1 : 0
    }

    const rows = Object.values(map)
    if (rows.length > 0) {
      // We already delete this tournament's standings above, so insert is safer than upsert here.
      const { error: insertErr } = await db
        .from('standings')
        .insert(rows)
      if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // ── Rebuild group standings ──────────────────────────────────────────────────
  if (groupFixtures.length > 0) {
    await db.from('group_standings').delete().eq('tournament_id', tournament_id)

    const gmap: Record<string, any> = {}

    const grow = (teamId: string, groupName: string) => {
      const key = `${groupName}:${teamId}`

      if (!gmap[key]) gmap[key] = {
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
      return gmap[key]
    }

    for (const f of groupFixtures) {
      const result = Array.isArray(f.results) ? f.results[0] : f.results
      if (!result) continue
      const { home_score: hs, away_score: as_, override_reason } = result
      const reason = (override_reason ?? '').toLowerCase()
      if (reason.includes('both') && reason.includes('absent')) continue

      const homeWin = hs > as_
      const awayWin = as_ > hs
      const draw    = hs === as_
      const groupName = f.group_name ?? 'Group Stage'

      const hr = grow(f.home_team_id, groupName)
      const ar = grow(f.away_team_id, groupName)

      hr.played++;  ar.played++
      hr.wins         += homeWin ? 1 : 0;   ar.wins         += awayWin ? 1 : 0
      hr.draws        += draw    ? 1 : 0;   ar.draws        += draw    ? 1 : 0
      hr.losses       += awayWin ? 1 : 0;   ar.losses       += homeWin ? 1 : 0
      hr.goals_for    += hs;                ar.goals_for    += as_
      hr.goals_against += as_;              ar.goals_against += hs
      hr.points       += homeWin ? 3 : draw ? 1 : 0
      ar.points       += awayWin ? 3 : draw ? 1 : 0
    }

    const rows = Object.values(gmap)
    if (rows.length > 0) {
      // We already delete this tournament's group standings above, so insert avoids ON CONFLICT constraint errors.
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
    details: { league_fixtures: leagueFixtures.length, group_fixtures: groupFixtures.length },
  })

  return Response.json({
    success: true,
    league_fixtures_processed: leagueFixtures.length,
    group_fixtures_processed: groupFixtures.length,
  })
}
