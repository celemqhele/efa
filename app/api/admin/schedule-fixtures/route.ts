import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addDays, format, parseISO } from 'date-fns'

// South African public holidays (shared with fixture-generator)
const SA_PUBLIC_HOLIDAYS_2025 = new Set([
  '2025-01-01', '2025-03-21', '2025-04-18', '2025-04-21',
  '2025-04-27', '2025-05-01', '2025-06-16', '2025-08-09',
  '2025-09-24', '2025-12-16', '2025-12-25', '2025-12-26',
])
const SA_PUBLIC_HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06',
  '2026-04-27', '2026-05-01', '2026-06-16', '2026-08-09',
  '2026-09-24', '2026-12-16', '2026-12-25', '2026-12-26',
])

function isPublicHoliday(dateStr: string): boolean {
  return SA_PUBLIC_HOLIDAYS_2025.has(dateStr) || SA_PUBLIC_HOLIDAYS_2026.has(dateStr)
}

function getSlotsPerDay(dateStr: string): number {
  const date = parseISO(dateStr)
  const dow = date.getDay()
  const weekend = dow === 0 || dow === 6
  if (weekend || isPublicHoliday(dateStr)) return 3
  return 2
}

function isBreak(dateStr: string, breaks: Array<{ break_start: string; break_end: string }>): boolean {
  return breaks.some((b) => {
    const d = parseISO(dateStr)
    const start = parseISO(b.break_start)
    const end = parseISO(b.break_end)
    return d >= start && d <= end
  })
}

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const { tournamentId, matchday } = await request.json()

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  // 1. Get tournament settings (start date + breaks)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('season_id, settings')
    .eq('id', tournamentId)
    .single()

  let seasonStart: string | null = null
  let breaks: Array<{ break_start: string; break_end: string }> = []
  const settings = (tournament as any)?.settings
  if (settings?.start_date) {
    seasonStart = settings.start_date
  }
  if (settings?.breaks) {
    breaks = settings.breaks
  }
  if (!seasonStart && (tournament as any)?.season_id) {
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

  // 2. Fetch all unscheduled fixtures for this tournament, ordered FIFO
  let query = supabase
    .from('fixtures')
    .select('id, matchday, home_team_id, away_team_id')
    .eq('tournament_id', tournamentId)
    .is('assigned_day', null)

  if (matchday) {
    query = query.eq('matchday', matchday)
  }

  const { data: fixtures } = await query.order('matchday', { ascending: true })

  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      matchday: matchday ?? null,
      message: 'No fixtures need scheduling',
    })
  }

  // 3. Get all already-scheduled fixtures for team/day conflict detection
  const { data: scheduledFx } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id, scheduled_date')
    .eq('tournament_id', tournamentId)
    .not('scheduled_date', 'is', null)

  const teamDateSet = new Set<string>()
  for (const sfx of scheduledFx ?? []) {
    if (sfx.scheduled_date) {
      const dateOnly = String(sfx.scheduled_date).slice(0, 10)
      teamDateSet.add(`${sfx.home_team_id}|${dateOnly}`)
      teamDateSet.add(`${sfx.away_team_id}|${dateOnly}`)
    }
  }

  // capacity tracking per date
  const dateSlotCount: Record<string, number> = {}

  // 4. FIFO: assign each fixture to the next available slot
  let successCount = 0
  const results: any[] = []

  for (const fx of fixtures) {
    let currentDate = parseISO(seasonStart)
    const safety = 730 // Search up to 2 years
    let assigned = false

    for (let i = 0; i < safety; i++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      if (isBreak(dateStr, breaks)) {
        currentDate = addDays(currentDate, 1)
        continue
      }

      const slotsToday = getSlotsPerDay(dateStr)
      const used = dateSlotCount[dateStr] ?? 0

      if (used < slotsToday) {
        // Check team conflict
        const homeConflict = teamDateSet.has(`${fx.home_team_id}|${dateStr}`)
        const awayConflict = teamDateSet.has(`${fx.away_team_id}|${dateStr}`)

        if (!homeConflict && !awayConflict) {
          // Assign to this date
          dateSlotCount[dateStr] = used + 1
          teamDateSet.add(`${fx.home_team_id}|${dateStr}`)
          teamDateSet.add(`${fx.away_team_id}|${dateStr}`)

          const deadline = `${dateStr}T12:00:00Z`
          const { error } = await supabase
            .from('fixtures')
            .update({
              scheduled_date: dateStr,
              deadline,
            })
            .eq('id', fx.id)

          if (!error) {
            successCount++
            results.push({
              id: fx.id,
              matchday: fx.matchday,
              date: dateStr,
            })
          }
          assigned = true
          break
        }
      }

      currentDate = addDays(currentDate, 1)
    }

    if (!assigned) {
      console.warn(`Could not schedule fixture ${fx.id} (MD ${fx.matchday}) — no available slots`)
    }
  }

  return NextResponse.json({
    success: true,
    count: successCount,
    total: fixtures.length,
    matchday: matchday ?? fixtures[0].matchday,
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
