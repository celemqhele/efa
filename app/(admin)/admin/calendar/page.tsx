export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'

export const revalidate = 0

interface Props {
  searchParams: Promise<{ month?: string }>
}

const TOURNAMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  league: { bg: 'bg-[#c9a84c]/20', text: 'text-[#c9a84c]', label: 'PL' },
  ucl:    { bg: 'bg-blue-500/20',   text: 'text-blue-400',  label: 'UCL' },
  europa: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'UEL' },
  super_cup: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'SC' },
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

  const supabase = await createClient()

  const [{ data: fixtures }, { data: breaks }] = await Promise.all([
    supabase
      .from('fixtures')
      .select(`
        id, matchday, scheduled_date, status, round_type,
        home_team:teams!home_team_id (id, name, logo_league_folder, logo_team_slug),
        away_team:teams!away_team_id (id, name, logo_league_folder, logo_team_slug),
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

  // Index fixtures by date
  const byDate: Record<string, any[]> = {}
  for (const f of (fixtures ?? []) as any[]) {
    const d = f.scheduled_date as string
    if (!byDate[d]) byDate[d] = []
    byDate[d]!.push(f)
  }

  // Break date set
  const breakDates = new Set<string>()
  for (const b of (breaks ?? []) as any[]) {
    const start = parseISO(b.break_start as string)
    const end = parseISO(b.break_end as string)
    eachDayOfInterval({ start, end }).forEach((d) =>
      breakDates.add(format(d, 'yyyy-MM-dd'))
    )
  }

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = (getDay(monthStart) + 6) % 7 // Mon=0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <Link href={`?month=${prevMonth}`} className="btn-outline text-xs px-3 py-2">← Prev</Link>
          <Link href={`?month=${format(now, 'yyyy-MM')}`} className="text-xs text-[#c9a84c] px-3 py-2">Today</Link>
          <Link href={`?month=${nextMonth}`} className="btn-outline text-xs px-3 py-2">Next →</Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TOURNAMENT_COLORS).map(([type, c]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded ${c.bg} ${c.text} font-bold`}>
            {c.label}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-500 font-bold">Break</span>
      </div>

      {/* Calendar grid */}
      <div className="card p-2 overflow-x-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs text-slate-500 font-medium py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {/* Padding */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="bg-slate-50 min-h-[80px]" />
          ))}

          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const isBreak = breakDates.has(dateStr)
            const dayFixtures = byDate[dateStr] ?? []
            const isToday = dateStr === format(now, 'yyyy-MM-dd')

            return (
              <div
                key={dateStr}
                className={`bg-slate-50 min-h-[80px] p-1.5 ${
                  isBreak ? 'opacity-40' : ''
                } ${isToday ? 'ring-1 ring-[#c9a84c] ring-inset' : ''}`}
              >
                <div className={`text-xs font-bold mb-1 ${
                  isToday ? 'text-[#c9a84c]' : 'text-slate-500'
                }`}>
                  {format(day, 'd')}
                </div>

                {isBreak && (
                  <div className="text-[9px] text-slate-600 bg-slate-200 rounded px-1 py-0.5">
                    Break
                  </div>
                )}

                <div className="space-y-0.5">
                  {dayFixtures.slice(0, 4).map((f: any) => {
                    const colors = TOURNAMENT_COLORS[f.tournament?.type] ?? TOURNAMENT_COLORS.league
                    const result = f.results?.[0]
                    return (
                      <Link
                        key={f.id}
                        href={result ? `/results` : `/admin/results/submit?fixture=${f.id}`}
                        className={`block rounded px-1 py-0.5 ${colors.bg} hover:opacity-80 transition-opacity`}
                      >
                        <div className="flex items-center gap-0.5">
                          {f.home_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                              alt=""
                              width={12} height={12}
                              className="object-contain"
                            />
                          )}
                          <span className={`text-[9px] font-bold ${colors.text}`}>
                            {result
                              ? `${result.home_score}-${result.away_score}`
                              : 'vs'
                            }
                          </span>
                          {f.away_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                              alt=""
                              width={12} height={12}
                              className="object-contain"
                            />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {dayFixtures.length > 4 && (
                    <div className="text-[9px] text-slate-500 px-1">
                      +{dayFixtures.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* List view for today */}
      {byDate[format(now, 'yyyy-MM-dd')]?.length ? (
        <div className="card p-4">
          <h2 className="section-header">Today's Fixtures</h2>
          <div className="space-y-2">
            {(byDate[format(now, 'yyyy-MM-dd')] ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                <div className="flex items-center gap-2">
                  {f.home_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                  )}
                  <span className="text-sm text-slate-900">{f.home_team?.name}</span>
                </div>
                <div className="text-center px-3">
                  {f.results?.[0]
                    ? <span className="text-slate-900 font-bold">{f.results[0].home_score}–{f.results[0].away_score}</span>
                    : <span className="text-xs text-[#c9a84c]">vs</span>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-900">{f.away_team?.name}</span>
                  {f.away_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                  )}
                </div>
                <Link href={`/results/submit?fixture=${f.id}`} className="btn-gold text-xs px-3 py-1.5 ml-2">
                  Submit
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
