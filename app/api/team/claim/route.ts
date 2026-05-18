import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { folder, slug, name } = body

  if (!folder || !slug || !name) {
    return Response.json({ error: 'folder, slug and name are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get manager username
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Find existing team record for this logo slot
  const { data: existing } = await adminSupabase
    .from('teams')
    .select('id, manager_id')
    .eq('logo_league_folder', folder)
    .eq('logo_team_slug', slug)
    .maybeSingle()

  if (existing?.manager_id) {
    return Response.json({ error: 'This team already has a manager.' }, { status: 409 })
  }

  const avatarUrl = `/logos/${folder}/128x128/${slug}.png`

  let teamId: string

  if (existing) {
    // Update existing team record
    const { error: e } = await adminSupabase
      .from('teams')
      .update({ manager_id: user.id })
      .eq('id', existing.id)
    if (e) return Response.json({ error: e.message }, { status: 500 })
    teamId = existing.id
  } else {
    // Create new team record
    const { data: created, error: e } = await adminSupabase
      .from('teams')
      .insert({ name, logo_league_folder: folder, logo_team_slug: slug, manager_id: user.id })
      .select('id')
      .single()
    if (e || !created) return Response.json({ error: e?.message ?? 'Failed to create team' }, { status: 500 })
    teamId = created.id
  }

  // Update profile avatar
  await adminSupabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)

  // Close any existing open tenure for this team (safety guard)
  await adminSupabase
    .from('manager_tenures' as any)
    .update({ ended_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .is('ended_at', null)

  // Open new tenure
  await adminSupabase
    .from('manager_tenures' as any)
    .insert({
      team_id: teamId,
      manager_id: user.id,
      manager_username: profile.username,
      started_at: new Date().toISOString(),
    })

  return Response.json({ success: true, team_id: teamId })
}
