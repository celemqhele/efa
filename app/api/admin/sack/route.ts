import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  // Accept both camelCase (from UserActionButtons) and snake_case (from TeamManageActions)
  const team_id: string = body.teamId ?? body.team_id

  if (!team_id) return Response.json({ error: 'teamId is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: team } = await adminSupabase
    .from('teams').select('id, name, manager_id').eq('id', team_id).single()

  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })
  if (!team.manager_id) return Response.json({ error: 'This team has no manager' }, { status: 400 })

  const sackedUserId = team.manager_id

  // ── Seal the active tenure ────────────────────────────────────────────────
  const { data: tenure } = await adminSupabase
    .from('manager_tenures' as any)
    .select('id, started_at')
    .eq('team_id', team_id)
    .is('ended_at', null)
    .maybeSingle() as any

  if (tenure) {
    // Calculate W/D/L from fixtures played during this tenure
    const { data: fixtures } = await adminSupabase
      .from('fixtures')
      .select('id, home_team_id, away_team_id, result:results(home_score, away_score)')
      .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
      .gte('scheduled_date', tenure.started_at)
      .in('status', ['confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both'])

    let wins = 0, draws = 0, losses = 0, goals_for = 0, goals_against = 0
    for (const f of (fixtures ?? []) as any[]) {
      const r = Array.isArray(f.result) ? f.result[0] : f.result
      if (!r) continue
      const isHome = f.home_team_id === team_id
      const myScore = isHome ? r.home_score : r.away_score
      const theirScore = isHome ? r.away_score : r.home_score
      goals_for += myScore
      goals_against += theirScore
      if (myScore > theirScore) wins++
      else if (myScore === theirScore) draws++
      else losses++
    }

    await adminSupabase
      .from('manager_tenures' as any)
      .update({ ended_at: new Date().toISOString(), wins, draws, losses, goals_for, goals_against })
      .eq('id', tenure.id)
  }

  // ── Release the team ──────────────────────────────────────────────────────
  const { error: updateError } = await adminSupabase
    .from('teams')
    .update({ manager_id: null, abandon_count: 0 })
    .eq('id', team_id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  // Notify sacked manager
  await adminSupabase.from('notifications').insert({
    user_id: sackedUserId,
    type: 'sacking',
    title: 'You have been sacked',
    body: `Your management of ${team.name} has ended. You can pick a new team.`,
    data: { team_id, team_name: team.name },
  })

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'sack_manager',
    target_type: 'team',
    target_id: team_id,
    details: { sacked_user_id: sackedUserId, team_name: team.name },
  })

  return Response.json({ success: true })
}
