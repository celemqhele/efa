import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { fixtureId: string; newDate: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fixtureId, newDate } = body
  if (!fixtureId || !newDate) {
    return Response.json({ error: 'fixtureId and newDate are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Validate the fixture exists
  const { data: fixture, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select('id, status, scheduled_date')
    .eq('id', fixtureId)
    .single()

  if (fixtureError || !fixture) {
    return Response.json({ error: 'Fixture not found' }, { status: 404 })
  }

  // Check if fixture can be postponed
  const finishedStatuses = ['completed', 'confirmed', 'abandoned']
  if (finishedStatuses.includes(fixture.status)) {
    return Response.json({ error: 'Cannot postpone a finished fixture' }, { status: 400 })
  }

  // Parse and validate the new date
  const newDateTime = new Date(newDate)
  if (isNaN(newDateTime.getTime())) {
    return Response.json({ error: 'Invalid date format' }, { status: 400 })
  }

  // Update fixture with new date
  const { error: updateError } = await adminSupabase
    .from('fixtures')
    .update({
      scheduled_date: newDateTime.toISOString(),
      is_postponed: true,
    })
    .eq('id', fixtureId)

  if (updateError) {
    return Response.json({ error: 'Failed to update fixture' }, { status: 500 })
  }

  // Audit log - ignore errors
  try {
    await adminSupabase.from('audit_log').insert({
      admin_id: user.id,
      action: 'postpone_fixture',
      target_type: 'fixture',
      target_id: fixtureId,
      details: { old_date: fixture.scheduled_date, new_date: newDateTime.toISOString() },
    })
  } catch (err) {
    // Silently ignore audit log errors
  }

  return Response.json({ success: true, message: 'Fixture postponed successfully' })
}
