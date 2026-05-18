import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let tournament_id: string
  try {
    const body = await request.json()
    tournament_id = body.tournament_id
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!tournament_id) {
    return Response.json({ error: 'tournament_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Delete in dependency order (fixtures → standings → participants → tournament)
  await adminSupabase.from('fixtures').delete().eq('tournament_id', tournament_id)
  await adminSupabase.from('standings').delete().eq('tournament_id', tournament_id)
  await (adminSupabase.from('group_standings') as any).delete().eq('tournament_id', tournament_id)
  await adminSupabase.from('tournament_participants').delete().eq('tournament_id', tournament_id)

  const { error } = await adminSupabase
    .from('tournaments')
    .delete()
    .eq('id', tournament_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'delete_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {},
  })

  return Response.json({ success: true })
}
