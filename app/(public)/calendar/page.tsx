import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO } from 'date-fns'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split('-').map(Number)
    if (y >= 2020 && y <= 2040 && m >= 1 && m <= 12) {
      return { year: y, month: m }
    }
  }
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const { year, month } = parseMonthParam(params.month)

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userTeams: { id: string; name: string }[] = []
  if (user) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name')
      .eq('manager_id', user.id)
    userTeams = (teamRows ?? []) as { id: string; name: string }[]
  }

  let fixtureQuery = supabase
    .from('fixtures')
    .select(`
      id, scheduled_date, status,
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
      result:results(home_score, away_score)
    `)
    .gte('scheduled_date', monthStart)
    .lte('scheduled_date', monthEnd + 'T23:59:59')
    .order('scheduled_date', { ascending: true })

  if (userTeams.length > 0) {
    const teamFilter = userTeams
      .flatMap(t => [`home_team_id.eq.${t.id}`, `away_team_id.eq.${t.id}`])
      .join(',')
    fixtureQuery = fixtureQuery.or(teamFilter)
  }

  const { data: fixtures } = await fixtureQuery.limit(500)

  const { data: breaksRaw } = await supabase
    .from('season_breaks')
    .select('id, break_start, break_end, reason')
    .lte('break_start', monthEnd)
    .gte('break_end', monthStart)

  const allFixtures = (fixtures ?? []) as any[]
  const allBreaks = (breaksRaw ?? []) as any[]

  const _now = new Date()
  _now.setDate(_now.getDate() - 1)
  const today = _now.toISOString().slice(0, 10)
  let nextQuery = supabase
    .from('fixtures')
    .select(`
      id, scheduled_date,
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('status', 'scheduled')
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(1)

  if (userTeams.length > 0) {
    const teamFilter = userTeams
      .flatMap(t => [`home_team_id.eq.${t.id}`, `away_team_id.eq.${t.id}`])
      .join(',')
    nextQuery = nextQuery.or(teamFilter)
  }

  const { data: nextFixtureArr } = await nextQuery
  const nextFixture = (nextFixtureArr ?? [])[0] as any ?? null

  let daysUntilNext: number | null = null
  if (nextFixture?.scheduled_date) {
    const diff = differenceInDays(parseISO(nextFixture.scheduled_date), new Date())
    daysUntilNext = diff >= 0 ? diff : null
  }

  const prev = prevMonth(year, month)
  const nextN = nextMonth(year, month)

  return <Shell data={{ year, month, fixtures: allFixtures, breaks: allBreaks, user, userTeams, nextFixture, daysUntilNext, prev, next: nextN }} />
}
