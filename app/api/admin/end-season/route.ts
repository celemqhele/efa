import { createClient, createAdminClient } from '@/lib/supabase/server'

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

  // Get the league tournament for this season
  const { data: leagueTournament } = await adminSupabase
    .from('tournaments')
    .select('id, name')
    .eq('season_id', season_id)
    .eq('type', 'league')
    .single()

  if (!leagueTournament) {
    return Response.json({ error: 'No league tournament found for this season' }, { status: 404 })
  }

  // Check all fixtures are done
  const { data: pending } = await adminSupabase
    .from('fixtures')
    .select('id')
    .eq('tournament_id', leagueTournament.id)
    .not('status', 'in', '("confirmed","abandoned_home","abandoned_away","abandoned_both")')
    .limit(1)

  if (pending && pending.length > 0) {
    return Response.json({ error: 'Not all fixtures are completed yet' }, { status: 400 })
  }

  // Get final standings for notification
  const { data: finalStandings } = await adminSupabase
    .from('standings')
    .select('team_id, points, teams(manager_id, name)')
    .eq('tournament_id', leagueTournament.id)
    .order('points', { ascending: false })
    .order('goal_difference', { ascending: false })

  // Mark league tournament as completed
  await adminSupabase
    .from('tournaments')
    .update({ status: 'completed' })
    .eq('id', leagueTournament.id)

  // Mark season as completed
  await adminSupabase
    .from('seasons')
    .update({ status: 'completed' })
    .eq('id', season_id)

  // Send qualification notifications
  if (finalStandings) {
    const notifs = finalStandings
      .filter((s: any, idx: number) => {
        const managerId = s.teams?.manager_id
        return managerId && (idx < 12 || idx >= 12)
      })
      .map((s: any, idx: number) => ({
        user_id: s.teams?.manager_id,
        type: 'qualification',
        title: idx < 12 ? 'UCL Qualification' : 'Europa League',
        body:
          idx < 12
            ? `${s.teams?.name} finished P${idx + 1} — qualified for EFA Champions League!`
            : `${s.teams?.name} finished P${idx + 1} — qualified for EFA Europa League.`,
        data: { season_id, position: idx + 1 },
      }))
      .filter((n: any) => n.user_id)

    if (notifs.length > 0) {
      await adminSupabase.from('notifications').insert(notifs)
    }
  }

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'end_season',
    target_type: 'season',
    target_id: season_id,
    details: { league_tournament_id: leagueTournament.id },
  })

  return Response.json({ success: true })
}
