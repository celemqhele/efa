import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { name, base_league } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'Season name is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: season, error } = await adminSupabase
    .from('seasons')
    .insert({ name: name.trim(), base_league: base_league || 'EFA League', status: 'active' })
    .select('id')
    .single()

  if (error || !season) return Response.json({ error: error?.message ?? 'Failed to create season' }, { status: 500 })

  return Response.json({ id: season.id })
}
