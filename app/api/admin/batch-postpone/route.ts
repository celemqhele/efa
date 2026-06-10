import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addDays, format, parseISO, isAfter } from 'date-fns'
import { sendPushToUser } from '@/lib/push'

const APP_TIME_ZONE = 'Africa/Johannesburg'

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

  const { data: _profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  const profile = _profile as any
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { team_id: string; from_date: string; to_date: string; reason: string; reschedule_from?: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { team_id, from_date, to_date, reason, reschedule_from } = body
  if (!team_id || !from_date || !to_date || !reason) {
    return Response.json({ error: 'team_id, from_date, to_date, reason all required' }, { status: 400 })
  }

  const fromD = parseISO(from_date)
  const toD = parseISO(to_date)
  if (isAfter(fromD, toD)) {
    return Response.json({ error: 'from_date must be before to_date' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // All scheduled fixtures for the team in the date range — pull both teams' managers
  // so we can notify them after the update.
  const { data: _affectedFixtures } = await adminSupabase
    .from('fixtures')
    .select(`
      id, scheduled_date, home_team_id, away_team_id, matchday, tournament_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, manager_id),
      away_team:teams!fixtures_away_team_id_fkey(id, name, manager_id)
    `)
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .gte('scheduled_date', from_date)
    .lte('scheduled_date', to_date)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })
  const affectedFixtures = (_affectedFixtures ?? []) as any[]

  if (!affectedFixtures?.length) {
    return Response.json({ success: true, postponed: 0, message: 'No scheduled fixtures in that date range.' })
  }

  // Existing future fixtures for the team so we don't pile new dates onto already-busy days
  const futureStart = reschedule_from ?? to_date
  const { data: _futureFixtures } = await adminSupabase
    .from('fixtures')
    .select('scheduled_date')
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .gt('scheduled_date', futureStart)
    .in('status', ['scheduled', 'awaiting_confirmation'])
  const futureFixtures = (_futureFixtures ?? []) as any[]

  const dateCounts = new Map<string, number>()
  for (const fx of futureFixtures) {
    const d = String(fx.scheduled_date ?? '').slice(0, 10)
    if (d) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1)
  }

  // Assign new dates to postponed fixtures (max 3 per day)
  const MAX_PER_DAY = 3
  let cursor = reschedule_from ? parseISO(reschedule_from) : addDays(toD, 1)
  type Update = {
    id: string
    scheduled_date: string
    deadline: string
    old_date: string | null
    home: { id?: string; name?: string; manager_id?: string | null } | null
    away: { id?: string; name?: string; manager_id?: string | null } | null
  }
  const updates: Update[] = []

  for (const fx of affectedFixtures) {
    let safety = 0
    while (safety++ < 365) {
      const d = format(cursor, 'yyyy-MM-dd')
      const count = dateCounts.get(d) ?? 0
      if (count < MAX_PER_DAY) {
        dateCounts.set(d, count + 1)
        const home = Array.isArray((fx as any).home_team) ? (fx as any).home_team[0] : (fx as any).home_team
        const away = Array.isArray((fx as any).away_team) ? (fx as any).away_team[0] : (fx as any).away_team
        updates.push({
          id: fx.id,
          scheduled_date: d,
          deadline: `${d}T12:00:00Z`,
          old_date: fx.scheduled_date ?? null,
          home,
          away,
        })
        break
      }
      cursor = addDays(cursor, 1)
    }
  }

  // Apply DB updates. Matchday stays untouched.
  await Promise.all(
    updates.map(({ id, scheduled_date, deadline }) =>
      (adminSupabase
        .from('fixtures') as any)
        .update({ scheduled_date, deadline, is_postponed: true })
        .eq('id', id)
    )
  )

  // Notifications — in-app + push, per-fixture, both managers
  try {
    const inAppRows: any[] = []

    for (const u of updates) {
      const homeName = u.home?.name ?? 'Home'
      const awayName = u.away?.name ?? 'Away'
      const matchLabel = `${homeName} vs ${awayName}`
      const oldWhen = u.old_date ? formatJhb(new Date(u.old_date)) : 'TBD'
      const newWhen = formatJhb(new Date(`${u.scheduled_date}T12:00:00Z`))
      const fixtureUrl = `/fixtures/${u.id}`
      const managerIds = [u.home?.manager_id, u.away?.manager_id]
        .filter((v): v is string => !!v)

      for (const uid of managerIds) {
        inAppRows.push({
          user_id: uid,
          type: 'fixture_postponed',
          title: '📅 Match Postponed',
          body: `${matchLabel} has been moved from ${oldWhen} to ${newWhen}.${reason ? ` Reason: ${reason}` : ''}`,
          data: {
            fixture_id: u.id,
            old_date: u.old_date,
            new_date: `${u.scheduled_date}T12:00:00Z`,
            home_team: homeName,
            away_team: awayName,
            reason,
          },
        })

        const { data: subs } = await adminSupabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', uid)

        if (subs?.length) {
          await sendPushToUser(subs, {
            title: '📅 Match Postponed',
            body: `${matchLabel} moved to ${newWhen}`,
            url: fixtureUrl,
            tag: `postpone-${u.id}`,
          })
        }
      }
    }

    if (inAppRows.length > 0) {
      await (adminSupabase.from('notifications') as any).insert(inAppRows)
    }
  } catch {
    // ignore notification errors
  }

  await (adminSupabase.from('audit_log') as any).insert({
    admin_id: user.id,
    action: 'batch_postpone',
    target_type: 'team',
    target_id: team_id,
    details: { from_date, to_date, reason, postponed_count: updates.length },
  })

  return Response.json({ success: true, postponed: updates.length })
}
