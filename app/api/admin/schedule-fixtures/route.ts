import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { findMatchDay, findTimeWindow, DaySchedule } from '@/lib/scheduling'
import { addDays, format, parseISO } from 'date-fns'

const ALL_DAYS: DaySchedule[] = [
  { day: 'MON', available: true, start: '00:00', end: '23:59' },
  { day: 'TUE', available: true, start: '00:00', end: '23:59' },
  { day: 'WED', available: true, start: '00:00', end: '23:59' },
  { day: 'THU', available: true, start: '00:00', end: '23:59' },
  { day: 'FRI', available: true, start: '00:00', end: '23:59' },
  { day: 'SAT', available: true, start: '00:00', end: '23:59' },
  { day: 'SUN', available: true, start: '00:00', end: '23:59' },
]

const DEFAULT_SAT_EVENING: DaySchedule[] = [
  { day: 'MON', available: false, start: null, end: null },
  { day: 'TUE', available: false, start: null, end: null },
  { day: 'WED', available: false, start: null, end: null },
  { day: 'THU', available: false, start: null, end: null },
  { day: 'FRI', available: false, start: null, end: null },
  { day: 'SAT', available: true, start: '18:00', end: '19:00' },
  { day: 'SUN', available: false, start: null, end: null },
]

function resolveAvailability(schedule: DaySchedule[] | undefined, opponentSchedule: DaySchedule[] | undefined): DaySchedule[] {
  if (schedule && schedule.length > 0) return schedule
  if (opponentSchedule && opponentSchedule.length > 0) return opponentSchedule
  return DEFAULT_SAT_EVENING
}

function getDateForDay(dayName: string, refDate: Date): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const targetDay = days.indexOf(dayName)
  let d = refDate
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === targetDay) break
    d = addDays(d, 1)
  }
  return format(d, 'yyyy-MM-dd')
}

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const { tournamentId, matchday } = await request.json()

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  // 1. Get season start date from tournament settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('season_id, settings')
    .eq('id', tournamentId)
    .single()

  let seasonStart: string | null = null
  const settings = (tournament as any)?.settings
  if (settings?.start_date) {
    seasonStart = settings.start_date
  } else if ((tournament as any)?.season_id) {
    const { data: season } = await supabase
      .from('seasons')
      .select('start_date')
      .eq('id', (tournament as any).season_id)
      .single()
    seasonStart = (season as any)?.start_date ?? null
  }

  if (!seasonStart) {
    return NextResponse.json({ error: 'No season or tournament start date found' }, { status: 400 })
  }

  // 2. Build query — target fixtures that haven't been assigned a day yet
  let query = supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(manager_id),
      away_team:teams!fixtures_away_team_id_fkey(manager_id)
    `)
    .eq('tournament_id', tournamentId)
    .is('assigned_day', null)

  if (matchday) {
    query = query.eq('matchday', matchday)
  } else {
    const { data: earliest } = await supabase
      .from('fixtures')
      .select('matchday')
      .eq('tournament_id', tournamentId)
      .is('assigned_day', null)
      .order('matchday', { ascending: true })
      .limit(1)
    if (earliest && earliest.length > 0) {
      query = query.eq('matchday', earliest[0].matchday)
    }
  }

  const { data: fixtures } = await query

  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      matchday: matchday ?? null,
      message: 'No fixtures need scheduling',
    })
  }

  const targetMatchday = fixtures[0].matchday

  // 3. Fetch manager availability
  const managerIds = [
    ...new Set(
      fixtures.flatMap((f) => [
        (f.home_team as any)?.manager_id,
        (f.away_team as any)?.manager_id,
      ]).filter(Boolean),
    ),
  ]

  const { data: availabilities } = await supabase
    .from('manager_availability')
    .select('*')
    .in('profile_id', managerIds as string[])

  const availMap = Object.fromEntries(
    (availabilities ?? []).map((a) => [a.profile_id, a.schedule as DaySchedule[]]),
  )

  // 4. Schedule each fixture
  let successCount = 0
  const results: any[] = []

  for (const fx of fixtures) {
    const homeMgr = (fx.home_team as any)?.manager_id
    const awayMgr = (fx.away_team as any)?.manager_id

    const rawHome = availMap[homeMgr] as DaySchedule[] | undefined
    const rawAway = availMap[awayMgr] as DaySchedule[] | undefined

    // Apply null-availability rules
    const hAvail = resolveAvailability(rawHome, rawAway)
    const aAvail = resolveAvailability(rawAway, rawHome)

    const dayName = findMatchDay(hAvail, aAvail)
    const window = findTimeWindow(hAvail, aAvail, dayName)

    const refDate = fx.scheduled_date
      ? parseISO(fx.scheduled_date)
      : parseISO(seasonStart)
    const scheduledDate = getDateForDay(dayName, refDate)

    const { error } = await supabase
      .from('fixtures')
      .update({
        assigned_day: dayName,
        window_start: window.start,
        window_end: window.end,
        scheduled_date: `${scheduledDate}T${window.start}:00`,
        deadline: `${scheduledDate}T${window.end}:00`,
      })
      .eq('id', fx.id)

    if (!error) {
      successCount++
      results.push({
        id: fx.id,
        assigned_day: dayName,
        window: `${window.start}–${window.end}`,
      })
    }
  }

  return NextResponse.json({
    success: true,
    count: successCount,
    total: fixtures.length,
    matchday: targetMatchday,
    results,
  })
}

export async function GET(request: Request) {
  const supabase = await createAdminClient()
  const url = new URL(request.url)
  const tournamentId = url.searchParams.get('tournamentId')

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  // Return stats about unscheduled fixtures grouped by matchday
  const { data: unscheduled } = await supabase
    .from('fixtures')
    .select('matchday')
    .eq('tournament_id', tournamentId)
    .is('assigned_day', null)
    .order('matchday', { ascending: true })

  const matchdayCounts: Record<number, number> = {}
  for (const f of unscheduled ?? []) {
    matchdayCounts[f.matchday] = (matchdayCounts[f.matchday] ?? 0) + 1
  }

  const nextMatchday = unscheduled && unscheduled.length > 0 ? unscheduled[0].matchday : null

  return NextResponse.json({
    totalUnscheduled: unscheduled?.length ?? 0,
    nextMatchday,
    matchdayCounts,
  })
}
