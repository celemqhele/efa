import { createClient, createAdminClient } from '@/lib/supabase/server'
import { approveSeasonApplication } from '@/lib/slot-utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { application_id, override } = await request.json()
  if (!application_id) return Response.json({ error: 'application_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const result = await approveSeasonApplication(adminSupabase, application_id, user.id, { override })

  if (!result.success) {
    return Response.json(
      { error: result.message, code: result.cooldown_ends_at ? 'SACK_COOLDOWN' : 'UNFILLED', cooldown_ends_at: result.cooldown_ends_at },
      { status: result.cooldown_ends_at ? 409 : 409 }
    )
  }

  // Mark the requesting admin's own notification as read
  await adminSupabase.from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'tournament_application')
    .eq('read', false)

  return Response.json({ success: true, message: result.message })
}