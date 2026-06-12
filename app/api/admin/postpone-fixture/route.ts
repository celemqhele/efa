import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'

const APP_TIME_ZONE = 'Africa/Johannesburg'

type PostponeBody = {
  fixtureId: string
  newDate: string
}

function formatJhb(date: Date): string {
  const datePart = date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: APP_TIME_ZONE,
  })
  const timePart = date.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  })
  return `${datePart} · ${timePart}`
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

  // Pull the fixture with both teams' manager IDs so we can notify them
  const { data: fixture, error: fixtureError } = await adminSupabase
    .from('fixtures')
    .select(`
      id, status, scheduled_date, matchday,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
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

  // Update the fixture. Matchday stays untouched (metadata only).
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

  // Notify both managers (in-app + push). Don't fail the postpone if these fail.
  try {
    const home = (fixture as any).home_team
    const away = (fixture as any).away_team
    const homeName = home?.name ?? 'Home'
    const awayName = away?.name ?? 'Away'
    const matchLabel = `${homeName} vs ${awayName}`
    const oldWhen = fixture.scheduled_date
      ? formatJhb(new Date(fixture.scheduled_date))
      : 'TBD'
    const newWhen = formatJhb(newDateTime)
    const fixtureUrl = `/fixtures/${fixtureId}`

    const managerIds = [home?.manager_id, away?.manager_id].filter(Boolean) as string[]

    // In-app notifications
    if (managerIds.length > 0) {
      await adminSupabase.from('notifications').insert(
        managerIds.map((uid) => ({
          user_id: uid,
          type: 'fixture_postponed',
          title: 'Match Postponed',
          body: `${matchLabel} has been moved from ${oldWhen} to ${newWhen}.`,
          data: {
            fixture_id: fixtureId,
            old_date: fixture.scheduled_date,
            new_date: newDateTime.toISOString(),
            home_team: homeName,
            away_team: awayName,
          },
        }))
      )
    }

    // Push notifications
    for (const uid of managerIds) {
      const { data: subs } = await adminSupabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', uid)

      if (subs?.length) {
        await sendPushToUser(subs, {
          title: 'Match Postponed',
          body: `${matchLabel} moved to ${newWhen}`,
          url: fixtureUrl,
          tag: `postpone-${fixtureId}`,
        })
      }
    }
  } catch {
    // Silently swallow notification errors — the postpone itself succeeded
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
