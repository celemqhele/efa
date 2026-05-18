import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check admin role
  const { data: adminProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !adminProfile || adminProfile.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { team_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { team_id } = body

  if (!team_id) {
    return Response.json({ error: 'team_id is required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get the team and current manager
  const { data: team, error: teamError } = await adminSupabase
    .from('teams')
    .select('id, name, manager_id')
    .eq('id', team_id)
    .single()

  if (teamError || !team) {
    return Response.json({ error: 'Team not found' }, { status: 404 })
  }

  if (!team.manager_id) {
    return Response.json(
      { error: 'This team has no manager to sack' },
      { status: 400 }
    )
  }

  const sackedUserId = team.manager_id

  // Release team: clear manager and reset abandon count
  const { error: updateError } = await adminSupabase
    .from('teams')
    .update({ manager_id: null, abandon_count: 0 })
    .eq('id', team_id)

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // Notify sacked user
  await adminSupabase.from('notifications').insert({
    user_id: sackedUserId,
    type: 'sacking',
    title: 'Team Reassigned',
    body: 'Your team has been reassigned. Contact an admin.',
    data: {
      team_id,
      team_name: team.name,
    },
  })

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'sack_manager',
    target_type: 'team',
    target_id: team_id,
    details: {
      sacked_user_id: sackedUserId,
      team_name: team.name,
    },
  })

  return Response.json({ success: true, sacked_user_id: sackedUserId })
}
