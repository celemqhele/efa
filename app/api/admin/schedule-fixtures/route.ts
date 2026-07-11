import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addDays, format, subDays } from 'date-fns'

const CUP_WEEKLY_SLOT_BUDGET = 30

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const { tournamentId, matchday } = await request.json()

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  const slotModule = await import('@/lib/fixture-slots')

  const [{ data: tournament }, { data: fixtures }] = await Promise.all([
    supabase.from('tournaments').select('type').eq('id', tournamentId).single(),
    (() => {
      let q = supabase
        .from('fixtures')
        .select('id, matchday, home_team_id, away_team_id')
        .eq('tournament_id', tournamentId)
        .is('scheduled_date', null)

      if (matchday) q = q.eq('matchday', matchday)
      return q.order('matchday', { ascending: true })
    })(),
  ])

  if (!fixtures || fixtures.length === 0) {
    return NextResponse.json({
      success: true,
      count: 0,
      matchday: matchday ?? null,
      message: 'No fixtures need scheduling',
    })
  }

  const isClub = tournament?.type === 'tournament_club' || tournament?.type === 'tournament_international'
  const weeklySlotBudget = isClub ? CUP_WEEKLY_SLOT_BUDGET : undefined
  const startDate = format(new Date(), 'yyyy-MM-dd')
  const slotCache: Record<string, { globalUsed: number; teamUsed: Record<string, number> }> = {}
  const assignments: Array<{ home_team_id: string; away_team_id: string; scheduled_date: string }> = []
  let successCount = 0
  const results: any[] = []

  for (const fx of fixtures) {
    let currentDate = parseISO(startDate)
    let assigned = false

    for (let safety = 0; safety < 730; safety++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      if (!slotCache[dateStr]) {
        const s = await slotModule.getSlotStateForDate(supabase, dateStr, tournamentId)
        slotCache[dateStr] = { ...s }
      }

      const state = slotCache[dateStr]
      const { globalCap, teamCap } = slotModule.getDailyCapacity(dateStr)

      const homeUsedToday = state.teamUsed[fx.home_team_id] ?? 0
      const awayUsedToday = state.teamUsed[fx.away_team_id] ?? 0

      if (homeUsedToday >= teamCap || awayUsedToday >= teamCap) {
        currentDate = addDays(currentDate, 1)
        continue
      }

      if (state.globalUsed + 2 > globalCap) {
        currentDate = addDays(currentDate, 1)
        continue
      }

      if (weeklySlotBudget !== undefined && weeklySlotBudget > 0) {
        const windowStart = format(subDays(currentDate, 6), 'yyyy-MM-dd')
        const slotsUsed = assignments.filter(a =>
          a.scheduled_date >= windowStart && a.scheduled_date <= dateStr
        ).length * 2
        if (slotsUsed + 2 > weeklySlotBudget) {
          currentDate = addDays(currentDate, 1)
          continue
        }
      }

      const deadline = `${dateStr}T12:00:00Z`
      const { error } = await supabase
        .from('fixtures')
        .update({ scheduled_date: dateStr, deadline })
        .eq('id', fx.id)

      if (!error) {
        state.globalUsed += 2
        state.teamUsed[fx.home_team_id] = homeUsedToday + 1
        state.teamUsed[fx.away_team_id] = awayUsedToday + 1
        assignments.push({ home_team_id: fx.home_team_id, away_team_id: fx.away_team_id, scheduled_date: dateStr })
        successCount++
        results.push({ id: fx.id, matchday: fx.matchday, date: dateStr })
      }
      assigned = true
      break
    }

    if (!assigned) {
      console.warn(`Could not schedule fixture ${fx.id} — no available slot`)
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

function parseISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export async function GET(request: Request) {
  const supabase = await createAdminClient()
  const url = new URL(request.url)
  const tournamentId = url.searchParams.get('tournamentId')

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  const { data: unscheduled } = await supabase
    .from('fixtures')
    .select('matchday')
    .eq('tournament_id', tournamentId)
    .is('scheduled_date', null)
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
