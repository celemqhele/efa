import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addDays, format, subDays } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const { tournamentId, matchday } = await request.json()

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId is required' }, { status: 400 })
  }

  const [slotModule, { data: fixtures }] = await Promise.all([
    import('@/lib/fixture-slots'),
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
        const s = await slotModule.getSlotStateForDate(supabase, dateStr)
        slotCache[dateStr] = { ...s }
      }

      const state = slotCache[dateStr]
      const { globalCap, teamCap } = slotModule.getDailyCapacity(dateStr)

      const homeUsed = state.teamUsed[fx.home_team_id] ?? 0
      const awayUsed = state.teamUsed[fx.away_team_id] ?? 0

      if (state.globalUsed + 2 <= globalCap && homeUsed < teamCap && awayUsed < teamCap) {
        for (let w = 0; w < 7; w++) {
          const wds = format(addDays(subDays(currentDate, 6), w), 'yyyy-MM-dd')
          if (!slotCache[wds]) {
            const ws = await slotModule.getSlotStateForDate(supabase, wds)
            slotCache[wds] = { ...ws }
          }
        }
        if (slotModule.isWindowBalanced(fx.home_team_id, fx.away_team_id, dateStr, slotCache, assignments)) {
          const deadline = `${dateStr}T12:00:00Z`
          const { error } = await supabase
            .from('fixtures')
            .update({ scheduled_date: dateStr, deadline })
            .eq('id', fx.id)

          if (!error) {
            state.globalUsed += 2
            state.teamUsed[fx.home_team_id] = homeUsed + 1
            state.teamUsed[fx.away_team_id] = awayUsed + 1
            assignments.push({ home_team_id: fx.home_team_id, away_team_id: fx.away_team_id, scheduled_date: dateStr })
            successCount++
            results.push({ id: fx.id, matchday: fx.matchday, date: dateStr })
          }
          assigned = true
          break
        }
      }

      currentDate = addDays(currentDate, 1)
    }

    if (!assigned) {
      console.warn(`Could not schedule fixture ${fx.id} — no slots or unbalanced window`)
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
