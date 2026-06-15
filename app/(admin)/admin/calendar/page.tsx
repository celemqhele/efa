export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import Shell from './_shell'

export const revalidate = 0

interface Props {
  searchParams: Promise<{ month?: string; scope?: 'mine' | 'all' }>
}

export default async function AdminCalendarPage({ searchParams }: Props) {
  const sp = await searchParams
  const now = new Date()
  const baseDate = sp.month ? parseISO(`${sp.month}-01`) : now
  const monthStart = startOfMonth(baseDate)
  const monthEnd = endOfMonth(baseDate)
  const monthLabel = format(monthStart, 'MMMM yyyy')
  const prevMonth = format(subMonths(monthStart, 1), 'yyyy-MM')
  const nextMonth = format(addMonths(monthStart, 1), 'yyyy-MM')
  
  const scope = sp.scope === 'mine' ? 'mine' : 'all'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: userTeam } = user 
    ? await supabase.from('teams').select('id, name').eq('manager_id', user.id).maybeSingle()
    : { data: null }

  const [{ data: fixtures }, { data: breaks }] = await Promise.all([
    supabase
      .from('fixtures')
      .select(`
        id, matchday, scheduled_date, status, round_type,
        home_team:teams!fixtures_home_team_id_fkey (id, name, logo_league_folder, logo_team_slug),
        away_team:teams!fixtures_away_team_id_fkey (id, name, logo_league_folder, logo_team_slug),
        tournament:tournaments (name, type),
        results (home_score, away_score)
      `)
      .gte('scheduled_date', format(monthStart, 'yyyy-MM-dd'))
      .lte('scheduled_date', format(monthEnd, 'yyyy-MM-dd'))
      .order('scheduled_date'),
    supabase
      .from('season_breaks')
      .select('break_start, break_end, reason')
      .lte('break_start', format(monthEnd, 'yyyy-MM-dd'))
      .gte('break_end', format(monthStart, 'yyyy-MM-dd')),
  ])

  const rawFixtures = (fixtures ?? []) as any[]
  const processedFixtures = scope === 'mine'
    ? (userTeam ? rawFixtures.filter((f: any) => (f.home_team as any)?.id === (userTeam as any).id || (f.away_team as any)?.id === (userTeam as any).id) : [])
    : rawFixtures

  const byDate: Record<string, any[]> = {}
  for (const f of processedFixtures) {
    const d = f.scheduled_date as string
    if (!byDate[d]) byDate[d] = []
    byDate[d]!.push(f)
  }

  const breakDates = new Set<string>()
  for (const b of (breaks ?? []) as any[]) {
    const start = parseISO(b.break_start as string)
    const end = parseISO(b.break_end as string)
    eachDayOfInterval({ start, end }).forEach((d) =>
      breakDates.add(format(d, 'yyyy-MM-dd'))
    )
  }

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = (getDay(monthStart) + 6) % 7

  return (
    <Shell data={{
      monthLabel,
      prevMonth,
      nextMonth,
      scope,
      currentMonth: sp.month || format(now, 'yyyy-MM'),
      now: now.toISOString(),
      todayStr: format(now, 'yyyy-MM-dd'),
      days: days.map(d => ({ dateStr: format(d, 'yyyy-MM-dd'), dayNum: parseInt(format(d, 'd')) })),
      startPad,
      breakDates: Array.from(breakDates),
      byDate,
    }} />
  )
}

