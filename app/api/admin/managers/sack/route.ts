import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sackManagerFromClub } from '@/lib/manager-mgmt'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { team_id } = await request.json()
  if (!team_id) return Response.json({ error: 'team_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const result = await sackManagerFromClub(adminSupabase, { teamId: team_id, adminId: user.id })

  if (!result.ok) return Response.json({ error: result.message }, { status: 400 })

  return Response.json({ success: true })
}