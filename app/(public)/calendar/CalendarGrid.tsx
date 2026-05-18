'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'

interface FixtureSummary {
  id: string
  scheduled_date: string | null
  status: string
  home_team: { id: string; name: string; logo_league_folder: string; logo_team_slug: string } | null
  away_team: { id: string; name: string; logo_league_folder: string; logo_team_slug: string } | null
  result: { home_score: number; away_score: number } | null
}

interface SeasonBreak {
  id: string
  break_start: string
  break_end: string
  reason: string | null
}

interface Props {
  year: number
  month: number // 1-indexed
  fixtures: FixtureSummary[]
  breaks: SeasonBreak[]
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

// Monday = 0 … Sunday = 6
function dayOfWeekMon(d: Date): number {
  return (d.getDay() + 6) % 7
}

function isInBreak(date: Date, breaks: SeasonBreak[]): SeasonBreak | null {
  const ds = isoDate(date)
  for (const b of breaks) {
    if (ds >= b.break_start.slice(0, 10) && ds <= b.break_end.slice(0, 10)) {
      return b
    }
  }
  return null
}

const STATUS_PILL: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400',
  awaiting_confirmation: 'bg-yellow-500/20 text-yellow-400',
  abandoned: 'bg-red-500/20 text-red-400',
  scheduled: 'bg-slate-500/20 text-slate-400',
}

export default function CalendarGrid({ year, month, fixtures, breaks }: Props) {
  const days = getDaysInMonth(year, month)

  // Build a map: ISO date → fixture[]
  const fixtureMap: Record<string, FixtureSummary[]> = {}
  for (const f of fixtures) {
    if (!f.scheduled_date) continue
    const key = f.scheduled_date.slice(0, 10)
    if (!fixtureMap[key]) fixtureMap[key] = []
    fixtureMap[key].push(f)
  }

  // Leading blank cells to align to Monday start
  const firstDow = dayOfWeekMon(days[0])
  const blanks = Array.from({ length: firstDow }, (_, i) => i)

  const today = isoDate(new Date())

  return (
    <>
      {/* ── Desktop Grid ──────────────────────────────────────────────────── */}
      <div className="hidden sm:block">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="bg-[#0f1a3d] py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="grid grid-cols-7 gap-px bg-[#1e2d5a]">
          {blanks.map((i) => (
            <div key={`blank-${i}`} className="bg-[#0a1128] min-h-[100px]" />
          ))}

          {days.map((day) => {
            const ds = isoDate(day)
            const isToday = ds === today
            const isPastDay = ds < today
            const dayFixtures = fixtureMap[ds] ?? []
            const breakInfo = isInBreak(day, breaks)

            return (
              <div
                key={ds}
                className={`relative bg-[#0a1128] min-h-[100px] p-2 flex flex-col gap-1.5 transition-colors ${
                  isToday ? 'ring-1 ring-inset ring-[#c9a84c]/60 bg-[#c9a84c]/[0.04]' : ''
                } ${isPastDay && !dayFixtures.length ? 'opacity-50' : ''}`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-[#c9a84c] text-[#0a1128] flex items-center justify-center text-[10px]'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {breakInfo && (
                    <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded leading-none">
                      Break
                    </span>
                  )}
                </div>

                {/* Fixtures */}
                {dayFixtures.map((f) => {
                  const hasResult = !!f.result
                  return (
                    <Link
                      key={f.id}
                      href={`/fixtures/${f.id}`}
                      className="group block rounded-lg border border-[#1e2d5a] hover:border-[#c9a84c]/50 bg-[#111c3d] px-2 py-1.5 transition-all"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {f.home_team?.logo_league_folder && (
                          <Image
                            src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                            alt={f.home_team.name}
                            width={16}
                            height={16}
                            className="object-contain shrink-0"
                          />
                        )}
                        {hasResult ? (
                          <span className="text-[10px] font-bold text-white tabular-nums mx-0.5">
                            {f.result!.home_score}–{f.result!.away_score}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-[#c9a84c] mx-0.5">vs</span>
                        )}
                        {f.away_team?.logo_league_folder && (
                          <Image
                            src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                            alt={f.away_team.name}
                            width={16}
                            height={16}
                            className="object-contain shrink-0"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 min-w-0">
                        <span className="text-[9px] text-slate-500 truncate">
                          {f.home_team?.name?.split(' ').slice(-1)[0]}
                        </span>
                        <span className="text-[9px] text-slate-600">v</span>
                        <span className="text-[9px] text-slate-500 truncate">
                          {f.away_team?.name?.split(' ').slice(-1)[0]}
                        </span>
                      </div>
                      <div className={`mt-0.5 h-1 w-full rounded-full ${STATUS_PILL[f.status]?.split(' ')[0] ?? 'bg-slate-500/20'}`} />
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Mobile List View ──────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {days.map((day) => {
          const ds = isoDate(day)
          const dayFixtures = fixtureMap[ds] ?? []
          const isToday = ds === today
          const breakInfo = isInBreak(day, breaks)
          if (!dayFixtures.length && !breakInfo) return null

          return (
            <div
              key={ds}
              className={`card overflow-hidden ${isToday ? 'ring-1 ring-[#c9a84c]/50' : ''}`}
            >
              <div
                className={`px-4 py-2 border-b border-[#1e2d5a] flex items-center justify-between ${
                  isToday ? 'bg-[#c9a84c]/10' : 'bg-[#0f1a3d]'
                }`}
              >
                <span
                  className={`text-sm font-bold ${
                    isToday ? 'text-[#c9a84c]' : 'text-slate-300'
                  }`}
                >
                  {day.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {isToday && (
                    <span className="ml-2 text-[10px] bg-[#c9a84c] text-[#0a1128] px-1.5 py-0.5 rounded font-black">
                      TODAY
                    </span>
                  )}
                </span>
                {breakInfo && (
                  <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                    {breakInfo.reason ?? 'Season break'}
                  </span>
                )}
              </div>

              {dayFixtures.map((f) => {
                const hasResult = !!f.result
                return (
                  <Link
                    key={f.id}
                    href={`/fixtures/${f.id}`}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2d5a]/60 last:border-b-0 hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Home */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {f.home_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                          alt={f.home_team.name}
                          width={28}
                          height={28}
                          className="object-contain shrink-0"
                        />
                      )}
                      <span className="text-sm font-semibold text-white truncate">
                        {f.home_team?.name ?? 'TBD'}
                      </span>
                    </div>

                    {/* Score / vs */}
                    <div className="shrink-0 text-center min-w-[48px]">
                      {hasResult ? (
                        <span className="text-base font-black text-white tabular-nums">
                          {f.result!.home_score}–{f.result!.away_score}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#c9a84c]">vs</span>
                      )}
                      <div
                        className={`text-[9px] px-1.5 py-0.5 rounded mt-0.5 font-semibold ${
                          STATUS_PILL[f.status] ?? 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {f.status === 'confirmed' ? 'FT' : f.status === 'awaiting_confirmation' ? 'Awaiting' : f.status === 'abandoned' ? 'Abandoned' : 'Scheduled'}
                      </div>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm font-semibold text-white truncate text-right">
                        {f.away_team?.name ?? 'TBD'}
                      </span>
                      {f.away_team?.logo_league_folder && (
                        <Image
                          src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                          alt={f.away_team.name}
                          width={28}
                          height={28}
                          className="object-contain shrink-0"
                        />
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )
        })}

        {/* Empty month */}
        {Object.keys(fixtureMap).length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-slate-500 text-sm">No fixtures this month.</p>
          </div>
        )}
      </div>
    </>
  )
}
