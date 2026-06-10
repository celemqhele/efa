import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { findMatchDay, findTimeWindow, DaySchedule } from '@/lib/scheduling'
import { addDays, format, parseISO, startOfDay, nextDay } from 'date-fns'

export async function POST(request: Request) {
  const supabase = await createAdminClient()
  const { tournamentId, startDate } = await request.json()

  // 1. Get all fixtures
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, home_team:teams!fixtures_home_team_id_fkey(manager_id), 
      away_team:teams!fixtures_away_team_id_fkey(manager_id)
    `)
    .eq('tournament_id', tournamentId)
    .is('scheduled_date', null)

  // 2. Get manager availability
  const managerIds = [...new Set(fixtures?.flatMap(f => [(f.home_team as any)?.manager_id, (f.away_team as any)?.manager_id]).filter(Boolean))]
  const { data: availabilities } = await supabase
    .from('manager_availability')
    .select('*')
    .in('profile_id', managerIds as string[])

  const availMap = Object.fromEntries(availabilities?.map(a => [a.profile_id, a.schedule]) ?? [])

  // 3. Helper to map day name (MON, TUE...) to next actual date
  const getNextDateForDay = (dayName: string, fromDate: Date): string => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const targetDay = days.indexOf(dayName === 'SUN' ? 'SUN' : dayName === 'MON' ? 'MON' : dayName === 'TUE' ? 'TUE' : dayName === 'WED' ? 'WED' : dayName === 'THU' ? 'THU' : dayName === 'FRI' ? 'FRI' : 'SAT')
    let d = fromDate
    while (d.getDay() !== targetDay) {
      d = addDays(d, 1)
    }
    return format(d, 'yyyy-MM-dd')
  }

  // 4. Process
  const updates = fixtures?.map(fx => {
    const homeMgr = (fx.home_team as any)?.manager_id
    const awayMgr = (fx.away_team as any)?.manager_id
    
    const hAvail = (availMap[homeMgr] as DaySchedule[]) ?? []
    const aAvail = (availMap[awayMgr] as DaySchedule[]) ?? []

    const dayName = findMatchDay(hAvail, aAvail)
    const window = findTimeWindow(hAvail, aAvail, dayName)
    
    const scheduledDate = getNextDateForDay(dayName, parseISO(startDate))

    return { 
      id: fx.id, 
      scheduled_date: `${scheduledDate}T${window.start}:00`,
      deadline: `${scheduledDate}T${window.end}:00`
    }
  })

  // 5. Batch Update
  for (const u of updates ?? []) {
    await supabase.from('fixtures').update({ 
      scheduled_date: u.scheduled_date,
      deadline: u.deadline,
      status: 'scheduled' 
    }).eq('id', u.id)
  }

  return NextResponse.json({ success: true, count: updates?.length })
}
