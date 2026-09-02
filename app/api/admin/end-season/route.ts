import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'
import { sortStandingsRows, normalizeStandingsZones, rowZone } from '@/lib/standings-core'

const DONE_STATUSES = '("confirmed","abandoned_home","abandoned_away","abandoned_both")'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { season_id } = await request.json()
  if (!season_id) return Response.json({ error: 'season_id required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // All league tournaments for this season (one per division).
  const { data: leagueTournaments } = await adminSupabase
    .from('tournaments')
    .select('id, name, division, settings')
    .eq('season_id', season_id)
    .eq('type', 'league')
    .order('division', { ascending: true })

  if (!leagueTournaments || leagueTournaments.length === 0) {
    return Response.json({ error: 'No league tournament found for this season' }, { status: 404 })
  }

  // Check all fixtures are done across every division
  for (const leagueTournament of leagueTournaments) {
    const { data: pending } = await adminSupabase
      .from('fixtures')
      .select('id')
      .eq('tournament_id', leagueTournament.id)
      .not('status', 'in', DONE_STATUSES)
      .limit(1)

    if (pending && pending.length > 0) {
      return Response.json({ error: 'Not all fixtures are completed yet' }, { status: 400 })
    }
  }

  const now = new Date().toISOString()

  // Get final standings per division (for notifications + audit)
  const divisionStandings: { division: number; name: string; settings: any; rows: any[] }[] = []
  for (const leagueTournament of leagueTournaments) {
    const { data: finalStandings } = await adminSupabase
      .from('standings')
      .select('team_id, points, goals_for, goals_against, gd_penalty, teams(manager_id, name)')
      .eq('tournament_id', leagueTournament.id)

    divisionStandings.push({
      division: leagueTournament.division ?? 1,
      name: leagueTournament.name,
      settings: leagueTournament.settings,
      rows: sortStandingsRows(finalStandings ?? []),
    })
  }

  // Mark all league tournaments + the season as completed
  await adminSupabase
    .from('tournaments')
    .update({ status: 'completed' })
    .eq('season_id', season_id)
    .eq('type', 'league')

  await adminSupabase
    .from('seasons')
    .update({ status: 'completed' })
    .eq('id', season_id)

  // ── Auto-end all manager tenures for teams in this season ─────────────
  try {
    const { data: allTournaments } = await adminSupabase
      .from('tournaments')
      .select('id')
      .eq('season_id', season_id)

    if (allTournaments && allTournaments.length > 0) {
      const tIds = allTournaments.map((t: any) => t.id)

      const { data: participants } = await adminSupabase
        .from('tournament_participants')
        .select('team_id')
        .in('tournament_id', tIds)

      if (participants && participants.length > 0) {
        const teamIds = [...new Set(participants.map((p: any) => p.team_id))] as string[]

        await adminSupabase
          .from('teams')
          .update({ manager_id: null })
          .in('id', teamIds)

        await adminSupabase
          .from('manager_tenures' as any)
          .update({ ended_at: now })
          .in('team_id', teamIds)
          .is('ended_at', null)
      }
    }
  } catch (err) {
    console.error('[end-season] tenure cleanup error:', err)
  }

  // ── Division outcome notifications (cups are selected manually) ────────
  const notifs: any[] = []
  for (const div of divisionStandings) {
    const defaultZones = div.division === 1
      ? { bottom_yellow: 2, bottom_red: 3 }
      : { top_green: 3, top_yellow: 2 }
    const zones = normalizeStandingsZones({
      ...div.settings,
      standings_zones: div.settings?.standings_zones ?? defaultZones,
    })

    div.rows.forEach((row, idx) => {
      const managerId = row.teams?.manager_id
      if (!managerId) return
      const zone = rowZone(zones, idx, div.rows.length)
      const position = idx + 1

      if (div.division === 1 && idx === 0) {
        notifs.push({
          user_id: managerId,
          type: 'division_champion',
          title: 'Division 1 Champions 🏆',
          body: `${row.teams?.name} finished P1 — EFA Premier League champions!`,
          data: { season_id, division: 1, position },
        })
      } else if (zone === 'bottom_red') {
        notifs.push({
          user_id: managerId,
          type: 'relegation',
          title: 'Relegated to Division 2',
          body: `${row.teams?.name} finished P${position} in Division 1 — relegated to the EFA Championship.`,
          data: { season_id, division: 1, position },
        })
      } else if (zone === 'bottom_yellow') {
        notifs.push({
          user_id: managerId,
          type: 'relegation_playoff',
          title: 'Division 1 Relegation Playoff',
          body: `${row.teams?.name} finished P${position} — must win the relegation playoff to stay up.`,
          data: { season_id, division: 1, position },
        })
      } else if (div.division === 2 && zone === 'top_green') {
        notifs.push({
          user_id: managerId,
          type: 'promotion',
          title: 'Promoted to Division 1 🎉',
          body: `${row.teams?.name} finished P${position} in the EFA Championship — promoted to the Premier League!`,
          data: { season_id, division: 2, position },
        })
      } else if (div.division === 2 && zone === 'top_yellow') {
        notifs.push({
          user_id: managerId,
          type: 'promotion_playoff',
          title: 'Promotion Playoff',
          body: `${row.teams?.name} finished P${position} in the EFA Championship — a playoff win earns promotion.`,
          data: { season_id, division: 2, position },
        })
      }
    })
  }

  if (notifs.length > 0) {
    await insertNotificationsAndPush(adminSupabase, notifs)
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'end_season',
    target_type: 'season',
    target_id: season_id,
    details: {
      league_tournaments: divisionStandings.map((d) => ({
        division: d.division,
        name: d.name,
        standings: d.rows.map((r, i) => ({ position: i + 1, team_id: r.team_id })),
      })),
    },
  })

  return Response.json({ success: true })
}