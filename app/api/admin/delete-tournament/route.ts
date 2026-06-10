import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = (table: string) => supabase.from(table) as any

  const { data: profile } = await db('profiles')
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
  const adminDb = (table: string) => adminSupabase.from(table) as any

  await adminDb('fixtures').delete().eq('tournament_id', tournament_id)
  await adminDb('standings').delete().eq('tournament_id', tournament_id)
  await adminDb('group_standings').delete().eq('tournament_id', tournament_id)
  await adminDb('tournament_participants').delete().eq('tournament_id', tournament_id)
  await adminDb('trophies').delete().eq('tournament_id', tournament_id)

  const { error } = await adminDb('tournaments')
    .delete()
    .eq('id', tournament_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await adminDb('audit_log').insert({
    admin_id: user.id,
    action: 'delete_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {},
  })

  return Response.json({ success: true })
}
