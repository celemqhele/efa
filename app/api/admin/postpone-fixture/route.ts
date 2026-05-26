import { createClient, createAdminClient } from '@/lib/supabase/server'

type PostponeBody = {
  fixtureId: string
  newDate: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: PostponeBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fixtureId, newDate } = body
  if (!fixtureId || !newDate) {
    return Response.json({ error: 'fixtureId and newDate are required' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  const { data: fixture, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select('id, status, scheduled_date, matchday')
    .eq('id', fixtureId)
    .single()

  if (fixtureError || !fixture) {
    return Response.json({ error: 'Fixture not found' }, { status: 404 })
  }

  if (['completed', 'confirmed', 'abandoned'].includes(fixture.status)) {
    return Response.json({ error: 'Cannot postpone a finished fixture' }, { status: 400 })
  }

  const newDateTime = new Date(newDate)
  if (Number.isNaN(newDateTime.getTime())) {
    return Response.json({ error: 'Invalid date format' }, { status: 400 })
  }

  // Just move the date. Matchday stays as-is — it's metadata only;
  // browsing/grouping is now date-based across the app.
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

  try {
    await adminSupabase.from('audit_log').insert({
      admin_id: user.id,
      action: 'postpone_fixture',
      target_type: 'fixture',
      target_id: fixtureId,
      details: {
        old_date: fixture.scheduled_date,
        new_date: newDateTime.toISOString(),
        matchday: fixture.matchday,
      },
    })
  } catch {
    // ignore audit log errors
  }

  return Response.json({
    success: true,
    message: 'Fixture postponed successfully',
  })
}
