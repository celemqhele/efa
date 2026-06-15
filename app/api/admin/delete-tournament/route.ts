import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  const adminSupabase = await createAdminClient()
  const db = (table: string) => adminSupabase.from(table) as any

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

  await db('fixtures').delete().eq('tournament_id', tournament_id)
  await db('standings').delete().eq('tournament_id', tournament_id)
  await db('group_standings').delete().eq('tournament_id', tournament_id)
  await db('tournament_participants').delete().eq('tournament_id', tournament_id)
  await db('trophies').delete().eq('tournament_id', tournament_id)

  const { error } = await db('tournaments')
    .delete()
    .eq('id', tournament_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await db('audit_log').insert({
    action: 'delete_tournament',
    target_type: 'tournament',
    target_id: tournament_id,
    details: {},
  })

  return Response.json({ success: true })
}
