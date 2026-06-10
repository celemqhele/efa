import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: _profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single() as any
  const profile = _profile as any
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { season_id } = await request.json()
  if (!season_id) return Response.json({ error: 'season_id required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  // Get all tournaments in this season
  const { data: _tournaments } = await adminSupabase
    .from('tournaments')
    .select('id')
    .eq('season_id', season_id)
  const tournaments = (_tournaments ?? []) as any[]

  const tournamentIds = (tournaments ?? []).map((t) => t.id)

  if (tournamentIds.length > 0) {
    // Delete all fixtures for every tournament in this season
    await adminSupabase.from('fixtures').delete().in('tournament_id', tournamentIds)

    // Delete standings + group standings
    await adminSupabase.from('standings').delete().in('tournament_id', tournamentIds)
    await (adminSupabase.from('group_standings') as any).delete().in('tournament_id', tournamentIds)

    // Delete participants
    await adminSupabase.from('tournament_participants').delete().in('tournament_id', tournamentIds)

    // Delete trophies linked to these tournaments
    await adminSupabase.from('trophies').delete().in('tournament_id', tournamentIds)

    // Delete the tournaments themselves
    await adminSupabase.from('tournaments').delete().in('id', tournamentIds)
  }

  // Delete the season
  await adminSupabase.from('seasons').delete().eq('id', season_id)

  await (adminSupabase.from('audit_log') as any).insert({
    admin_id: user.id,
    action: 'cancel_season',
    target_type: 'season',
    target_id: season_id,
    details: { tournaments_deleted: tournamentIds.length },
  })

  return Response.json({ success: true })
}
