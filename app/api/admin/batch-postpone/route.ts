import { createClient, createAdminClient } from '@/lib/supabase/server'
import { addDays, format, parseISO, isAfter } from 'date-fns'
import {
  resolveMatchdayForDate,
  type FixtureMatchdayRow,
} from '@/lib/matchday-resolver'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
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

  // Get all existing future fixtures for the team after the reschedule start (to know busy days)
  const futureStart = reschedule_from ?? to_date
  const { data: futureFixtures } = await adminSupabase
    .from('fixtures')
    .select('scheduled_date')
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .gt('scheduled_date', futureStart)
    .in('status', ['scheduled', 'awaiting_confirmation'])

  // Build map of date → existing game count
  const dateCounts = new Map<string, number>()
  for (const fx of futureFixtures ?? []) {
    const d = String(fx.scheduled_date ?? '').slice(0, 10)
    if (d) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1)
  }

  // Assign new dates to postponed fixtures (max 3 per day)
  const MAX_PER_DAY = 3
  let cursor = reschedule_from ? parseISO(reschedule_from) : addDays(toD, 1)
  const updates: {
    id: string
    tournament_id: string | null
    scheduled_date: string
    deadline: string
    is_postponed: boolean
    old_matchday: number | null
  }[] = []

  for (const fx of affectedFixtures) {
    let safety = 0
    while (safety++ < 365) {
      const d = format(cursor, 'yyyy-MM-dd')
      const count = dateCounts.get(d) ?? 0
      if (count < MAX_PER_DAY) {
        dateCounts.set(d, count + 1)
        updates.push({
          id: fx.id,
          tournament_id: fx.tournament_id ?? null,
          scheduled_date: d,
          deadline: `${d}T12:00:00Z`,
          is_postponed: true,
          old_matchday: fx.matchday ?? null,
        })
        break
      }
      cursor = addDays(cursor, 1)
    }
  }

  // Pre-load all fixtures per affected tournament so we can recompute matchdays.
  // We then apply each batch update one at a time, updating the in-memory list
  // so later updates see earlier ones (important when multiple fixtures get
  // pushed onto the same new date).
  const tournamentIds = Array.from(
    new Set(updates.map((u) => u.tournament_id).filter((id): id is string => !!id))
  )

  const tournamentFixtures: Record<string, FixtureMatchdayRow[]> = {}
  if (tournamentIds.length > 0) {
    const { data: allFx } = await adminSupabase
      .from('fixtures')
      .select('id, matchday, scheduled_date, tournament_id')
      .in('tournament_id', tournamentIds)

    for (const f of allFx ?? []) {
      const tid = (f as any).tournament_id as string
      if (!tournamentFixtures[tid]) tournamentFixtures[tid] = []
      tournamentFixtures[tid].push({
        id: (f as any).id,
        matchday: (f as any).matchday,
        scheduled_date: (f as any).scheduled_date,
      })
    }
  }

  // Apply updates sequentially so matchday resolution can observe prior changes
  let applied = 0
  for (const u of updates) {
    const newDateIso = `${u.scheduled_date}T12:00:00Z`
    const newDateTime = new Date(newDateIso)

    let newMatchday: number | null = u.old_matchday
    if (u.tournament_id && tournamentFixtures[u.tournament_id]) {
      newMatchday = resolveMatchdayForDate(
        tournamentFixtures[u.tournament_id],
        u.id,
        newDateTime,
        u.old_matchday
      )
    }

    const updatePayload: {
      scheduled_date: string
      deadline: string
      is_postponed: boolean
      matchday?: number
    } = {
      scheduled_date: u.scheduled_date,
      deadline: u.deadline,
      is_postponed: u.is_postponed,
    }

    if (typeof newMatchday === 'number') {
      updatePayload.matchday = newMatchday
    }

    const { error } = await adminSupabase
      .from('fixtures')
      .update(updatePayload)
      .eq('id', u.id)

    if (!error) {
      applied++
      // Reflect the change in our in-memory snapshot so subsequent
      // resolutions in this batch see the new date / matchday.
      if (u.tournament_id) {
        const list = tournamentFixtures[u.tournament_id]
        const row = list?.find((r) => r.id === u.id)
        if (row) {
          row.scheduled_date = newDateIso
          if (typeof newMatchday === 'number') row.matchday = newMatchday
        }
      }
    }
  }

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'batch_postpone',
    target_type: 'team',
    target_id: team_id,
    details: { from_date, to_date, reason, postponed_count: applied },
  })

  return Response.json({ success: true, postponed: applied })
}
