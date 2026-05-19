import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { team_id } = await request.json()
  if (!team_id) return Response.json({ error: 'team_id is required' }, { status: 400 })

  const adminSupabase = await createAdminClient()

  const { data: profile } = await adminSupabase
    .from('profiles').select('id, username').eq('id', user.id).single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: team } = await adminSupabase
    .from('teams').select('id, name, manager_id').eq('id', team_id).single()
  if (!team) return Response.json({ error: 'Team not found' }, { status: 404 })

  // Can't apply to manage a club you already manage
  if (team.manager_id === user.id) {
    return Response.json({ error: 'You already manage this club.' }, { status: 409 })
  }

  // One pending application per user at a time
  const { data: existing } = await adminSupabase
    .from('manager_applications')
    .select('id')
    .eq('applicant_id', user.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'You already have a pending application. Wait for it to be reviewed.' }, { status: 409 })
  }

  const { error: insertErr } = await adminSupabase
    .from('manager_applications')
    .insert({ applicant_id: user.id, team_id })

  if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 })

  // Notify all admins
  const { data: admins } = await adminSupabase
    .from('profiles').select('id').eq('role', 'admin')

  if (admins && admins.length > 0) {
    await adminSupabase.from('notifications').insert(
      admins.map((a) => ({
        user_id: a.id,
        type: 'manager_application',
        title: 'Manager Application',
        body: `${profile.username} wants to manage ${team.name}.`,
        data: { applicant_id: user.id, team_id, team_name: team.name },
      }))
    )
  }

  return Response.json({ success: true })
}
