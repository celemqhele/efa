import { createClient, createAdminClient } from '@/lib/supabase/server'

const APP_TIME_ZONE = 'Africa/Johannesburg'

type PostponeBody = {
  fixtureId: string
  newDate: string
}

type FixtureMatchdayRow = {
  id: string
  matchday: number | null
  scheduled_date: string | null
}

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function getDateKey(value: string | null | undefined): string | null {
  const date = toValidDate(value)
  return date ? getDateKeyFromDate(date) : null
}

function getClosestMatchdayOnSameDate(
  fixtures: FixtureMatchdayRow[],
  fixtureId: string,
  newDateTime: Date
): number | null {
  const newDateKey = getDateKeyFromDate(newDateTime)

  const candidates = fixtures
    .filter((fixture) => {
      return (
        fixture.id !== fixtureId &&
        typeof fixture.matchday === 'number' &&
        getDateKey(fixture.scheduled_date) === newDateKey
      )
    })
    .map((fixture) => {
      const scheduledDate = toValidDate(fixture.scheduled_date)

      return {
        matchday: fixture.matchday as number,
        distance: scheduledDate
          ? Math.abs(scheduledDate.getTime() - newDateTime.getTime())
          : Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((a, b) => a.distance - b.distance || a.matchday - b.matchday)

  return candidates[0]?.matchday ?? null
}

function getTimelineMatchday(
  fixtures: FixtureMatchdayRow[],
  fixtureId: string,
  newDateTime: Date,
  currentMatchday: number | null
): number | null {
  const byMatchday = new Map<number, Date>()

  for (const fixture of fixtures) {
    if (fixture.id === fixtureId || typeof fixture.matchday !== 'number') continue

    const scheduledDate = toValidDate(fixture.scheduled_date)
    if (!scheduledDate) continue

    const existingDate = byMatchday.get(fixture.matchday)
    if (!existingDate || scheduledDate.getTime() < existingDate.getTime()) {
      byMatchday.set(fixture.matchday, scheduledDate)
    }
  }

  const ordered = Array.from(byMatchday.entries())
    .map(([matchday, date]) => ({ matchday, date }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.matchday - b.matchday)

  if (ordered.length === 0) return currentMatchday

  for (const item of ordered) {
    if (newDateTime.getTime() <= item.date.getTime()) {
      return item.matchday
    }
  }

  const maxMatchday = ordered.reduce((max, item) => Math.max(max, item.matchday), currentMatchday ?? 0)
  return maxMatchday + 1
}

async function resolveTargetMatchday(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  fixture: {
    id: string
    tournament_id: string | null
    matchday: number | null
  },
  newDateTime: Date
): Promise<number | null> {
  if (!fixture.tournament_id) return fixture.matchday ?? null

  const { data: tournamentFixtures, error } = await adminSupabase
    .from('fixtures')
    .select('id, matchday, scheduled_date')
    .eq('tournament_id', fixture.tournament_id)

  if (error || !tournamentFixtures) {
    return fixture.matchday ?? null
  }

  const fixtures = tournamentFixtures as FixtureMatchdayRow[]

  // Best case: the new date already belongs to another matchday.
  // If multiple matchdays are on the same calendar day, use the one closest to the chosen time.
  const sameDateMatchday = getClosestMatchdayOnSameDate(fixtures, fixture.id, newDateTime)
  if (sameDateMatchday !== null) return sameDateMatchday

  // Fallback: place the postponed fixture into the next matchday by fixture timeline.
  // If it is moved beyond all existing matchdays, create the next numeric matchday.
  return getTimelineMatchday(fixtures, fixture.id, newDateTime, fixture.matchday ?? null)
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

  // Validate the fixture exists
  const { data: fixture, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select('id, status, scheduled_date, tournament_id, matchday')
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
  if (Number.isNaN(newDateTime.getTime())) {
    return Response.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const targetMatchday = await resolveTargetMatchday(adminSupabase, fixture, newDateTime)

  // Update fixture with new date and move it to the correct matchday
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

  // Audit log - ignore errors
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
  } catch (err) {
    // Silently ignore audit log errors
  }

  return Response.json({
    success: true,
    message: 'Fixture postponed successfully',
    matchday: targetMatchday,
  })
}
