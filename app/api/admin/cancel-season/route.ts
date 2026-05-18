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

  // Mark all tournaments in this season as cancelled/upcoming
  await adminSupabase
    .from('tournaments')
    .update({ status: 'upcoming' })
    .eq('season_id', season_id)
    .eq('status', 'active')

  // Mark season as cancelled (store as 'upcoming' so it can be restarted, or use a cancelled state)
  await adminSupabase
    .from('seasons')
    .update({ status: 'upcoming' })
    .eq('id', season_id)

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'cancel_season',
    target_type: 'season',
    target_id: season_id,
    details: {},
  })

  return Response.json({ success: true })
}
