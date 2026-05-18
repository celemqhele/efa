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

  let body: { requested_team_id: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { requested_team_id } = body

  if (!requested_team_id) {
    return Response.json({ error: 'requested_team_id is required' }, { status: 400 })
  }

  // Get requesting user's profile (to find current team)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Find the user's current team
  const { data: currentTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_id', user.id)
    .maybeSingle()

  // Check requested team has no manager
  const { data: requestedTeam, error: teamError } = await supabase
    .from('teams')
    .select('id, name, manager_id')
    .eq('id', requested_team_id)
    .single()

  if (teamError || !requestedTeam) {
    return Response.json({ error: 'Requested team not found' }, { status: 404 })
  }

  if (requestedTeam.manager_id !== null) {
    return Response.json(
      { error: 'This team already has a manager' },
      { status: 409 }
    )
  }

  // Check no pending request already exists for this user
  const { data: existingRequest } = await supabase
    .from('team_change_requests')
    .select('id')
    .eq('requesting_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingRequest) {
    return Response.json(
      { error: 'You already have a pending team change request' },
      { status: 409 }
    )
  }

  // Insert team change request
  const { error: insertError } = await supabase
    .from('team_change_requests')
    .insert({
      requesting_user_id: user.id,
      current_team_id: currentTeam?.id ?? null,
      requested_team_id,
      status: 'pending',
    })

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 })
  }

  // Notify all admins
  const adminSupabase = await createAdminClient()

  const { data: admins } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin) => ({
      user_id: admin.id,
      type: 'team_request',
      title: 'Team Change Request',
      body: `${profile.username} has requested to manage ${requestedTeam.name}. Approve?`,
      data: {
        requesting_user_id: user.id,
        username: profile.username,
        requested_team_id,
        team: requestedTeam.name,
      },
    }))

    await adminSupabase.from('notifications').insert(notifications)
  }

  return Response.json({ submitted: true })
}
