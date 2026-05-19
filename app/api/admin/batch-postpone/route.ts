import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addDays, format, parseISO, isAfter } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  let body: { team_id: string; from_date: string; to_date: string; reason: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { team_id, from_date, to_date, reason } = body
  if (!team_id || !from_date || !to_date || !reason) {
    return Response.json({ error: 'team_id, from_date, to_date, reason all required' }, { status: 400 })
  }

  const fromD = parseISO(from_date)
  const toD = parseISO(to_date)
  if (isAfter(fromD, toD)) {
    return Response.json({ error: 'from_date must be before to_date' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Get all scheduled fixtures for the team in the date range
  const { data: affectedFixtures } = await adminSupabase
    .from('fixtures')
    .select('id, scheduled_date, home_team_id, away_team_id, matchday, tournament_id')
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .gte('scheduled_date', from_date)
    .lte('scheduled_date', to_date)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })

  if (!affectedFixtures?.length) {
    return Response.json({ success: true, postponed: 0, message: 'No scheduled fixtures in that date range.' })
  }

  // Get all existing future fixtures for the team AFTER to_date (to know busy days)
  const { data: futureFixtures } = await adminSupabase
    .from('fixtures')
    .select('scheduled_date')
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .gt('scheduled_date', to_date)
    .in('status', ['scheduled', 'awaiting_confirmation'])

  // Build map of date → existing game count
  const dateCounts = new Map<string, number>()
  for (const fx of futureFixtures ?? []) {
    const d = String(fx.scheduled_date ?? '').slice(0, 10)
    if (d) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1)
  }

  // Assign new dates to postponed fixtures (max 3 per day)
  const MAX_PER_DAY = 3
  let cursor = addDays(toD, 1)
  const updates: { id: string; scheduled_date: string; deadline: string; is_postponed: boolean }[] = []

  for (const fx of affectedFixtures) {
    let safety = 0
    while (safety++ < 365) {
      const d = format(cursor, 'yyyy-MM-dd')
      const count = dateCounts.get(d) ?? 0
      if (count < MAX_PER_DAY) {
        dateCounts.set(d, count + 1)
        updates.push({
          id: fx.id,
          scheduled_date: d,
          deadline: `${d}T12:00:00Z`,
          is_postponed: true,
        })
        break
      }
      cursor = addDays(cursor, 1)
    }
  }

  // Apply updates
  await Promise.all(
    updates.map(({ id, scheduled_date, deadline, is_postponed }) =>
      adminSupabase
        .from('fixtures')
        .update({ scheduled_date, deadline, is_postponed })
        .eq('id', id)
    )
  )

  // Audit log
  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'batch_postpone',
    target_type: 'team',
    target_id: team_id,
    details: { from_date, to_date, reason, postponed_count: updates.length },
  })

  return Response.json({ success: true, postponed: updates.length })
}
