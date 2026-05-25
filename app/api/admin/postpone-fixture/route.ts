import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  resolveMatchdayForDate,
  type FixtureMatchdayRow,
} from '@/lib/matchday-resolver'

type PostponeBody = {
  fixtureId: string
  newDate: string
}

async function resolveTargetMatchday(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  fixture: { id: string; tournament_id: string | null; matchday: number | null },
  newDateTime: Date
): Promise<number | null> {
  if (!fixture.tournament_id) return fixture.matchday ?? null

  const { data: tournamentFixtures, error } = await adminSupabase
    .from('fixtures')
    .select('id, matchday, scheduled_date')
    .eq('tournament_id', fixture.tournament_id)

  if (error || !tournamentFixtures) return fixture.matchday ?? null

  return resolveMatchdayForDate(
    tournamentFixtures as FixtureMatchdayRow[],
    fixture.id,
    newDateTime,
    fixture.matchday ?? null
  )
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
    .select('id, status, scheduled_date, tournament_id, matchday')
    .eq('id', fixtureId)
    .single()

  if (fixtureError || !fixture) {
    return Response.json({ error: 'Fixture not found' }, { status: 404 })
  }

  const finishedStatuses = ['completed', 'confirmed', 'abandoned']
  if (finishedStatuses.includes(fixture.status)) {
    return Response.json({ error: 'Cannot postpone a finished fixture' }, { status: 400 })
  }

  const newDateTime = new Date(newDate)
  if (Number.isNaN(newDateTime.getTime())) {
    return Response.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const targetMatchday = await resolveTargetMatchday(adminSupabase, fixture, newDateTime)

  const updatePayload: {
    scheduled_date: string
    is_postponed: boolean
    matchday?: number
  } = {
    scheduled_date: newDateTime.toISOString(),
    is_postponed: true,
  }

  if (typeof targetMatchday === 'number') {
    updatePayload.matchday = targetMatchday
  }

  const { error: updateError } = await adminSupabase
    .from('fixtures')
    .update(updatePayload)
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
        old_matchday: fixture.matchday,
        new_matchday: targetMatchday,
      },
    })
  } catch {
    // Silently ignore audit log errors
  }

  return Response.json({
    success: true,
    message: 'Fixture postponed successfully',
    matchday: targetMatchday,
  })
}
