import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertNotificationsAndPush } from '@/lib/notify'

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

  let body: { request_id: string; action: 'approve' | 'deny' }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { request_id, action } = body

  if (!request_id || !action || !['approve', 'deny'].includes(action)) {
    return Response.json(
      { error: 'request_id and action (approve|deny) are required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()

  // Fetch the request details
  const { data: changeRequest, error: requestError } = await adminSupabase
    .from('team_change_requests')
    .select(`
      id,
      requesting_user_id,
      current_team_id,
      requested_team_id,
      status,
      requested_team:teams!team_change_requests_requested_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('id', request_id)
    .single()

  if (requestError || !changeRequest) {
    return Response.json({ error: 'Request not found' }, { status: 404 })
  }

  if (changeRequest.status !== 'pending') {
    return Response.json(
      { error: 'This request has already been reviewed' },
      { status: 409 }
    )
  }

  const requestedTeam = Array.isArray(changeRequest.requested_team)
    ? changeRequest.requested_team[0]
    : changeRequest.requested_team

  if (action === 'approve') {
    // Release current team
    if (changeRequest.current_team_id) {
      await adminSupabase
        .from('teams')
        .update({ manager_id: null })
        .eq('id', changeRequest.current_team_id)
    }

    // Assign requested team
    await adminSupabase
      .from('teams')
      .update({ manager_id: changeRequest.requesting_user_id })
      .eq('id', changeRequest.requested_team_id)

    // Update request status
    await adminSupabase
      .from('team_change_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    // Notify user
    await insertNotificationsAndPush(adminSupabase, {
      user_id: changeRequest.requesting_user_id,
      type: 'team_request_reviewed',
      title: 'Team Change Approved',
      body: `Your team change to ${requestedTeam?.name ?? 'your new team'} has been approved.`,
      data: {
        approved: 'true',
        team: requestedTeam?.name ?? '',
        team_id: changeRequest.requested_team_id,
      },
    })

    // Audit log
    await adminSupabase.from('audit_log').insert({
      admin_id: user.id,
      action: 'approve_team_change',
      target_type: 'team_change_request',
      target_id: request_id,
      details: {
        requesting_user_id: changeRequest.requesting_user_id,
        from_team_id: changeRequest.current_team_id,
        to_team_id: changeRequest.requested_team_id,
      },
    })
  } else {
    // Deny
    await adminSupabase
      .from('team_change_requests')
      .update({
        status: 'denied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request_id)

    // Notify user
    await insertNotificationsAndPush(adminSupabase, {
      user_id: changeRequest.requesting_user_id,
      type: 'team_request_reviewed',
      title: 'Team Change Denied',
      body: 'Your team change request was denied.',
      data: {
        approved: 'false',
        team: requestedTeam?.name ?? '',
        team_id: changeRequest.requested_team_id,
      },
    })

    // Audit log
    await adminSupabase.from('audit_log').insert({
      admin_id: user.id,
      action: 'deny_team_change',
      target_type: 'team_change_request',
      target_id: request_id,
      details: {
        requesting_user_id: changeRequest.requesting_user_id,
        requested_team_id: changeRequest.requested_team_id,
      },
    })
  }

  // Mark the requesting admin's own notification as read
  await adminSupabase.from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('type', 'team_request')
    .eq('read', false)

  return Response.json({ success: true, action })
}
