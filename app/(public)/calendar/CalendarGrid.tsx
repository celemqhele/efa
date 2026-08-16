'use client'

import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { Card } from '@/components/ui/Card'

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
  // Use local date parts  toISOString() returns UTC which causes off-by-one
  // in timezones that are behind UTC (e.g. UTC-1 at 23:00 = next UTC day).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

// Monday = 0  Sunday = 6
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
  confirmed: 'bg-feedback-success/20 text-feedback-success',
  awaiting_confirmation: 'bg-feedback-warning/20 text-feedback-warning',
  abandoned: 'bg-feedback-error/20 text-feedback-error',
  scheduled: 'bg-text-muted/20 text-text-muted',
}

export default function CalendarGrid({ year, month, fixtures, breaks }: Props) {
  const days = getDaysInMonth(year, month)

  // Bucket fixtures by the UTC-date prefix of their scheduled_date string.
  // This matches how scheduled_date is stored, and how admin manage filters.
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
      {/* -- Desktop Grid ---------------------------------------------------- */}
      <div className="hidden sm:block">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="bg-bg-base py-2 text-center text-xs font-bold text-text-muted uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {blanks.map((i) => (
            <div key={`blank-${i}`} className="bg-bg-base min-h-[100px]" />
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
                className={`relative bg-bg-base min-h-[80px] p-2 flex flex-col gap-1 transition-colors ${
                  isToday ? 'ring-1 ring-inset ring-accent/60 bg-accent/[0.04]' : ''
                } ${isPastDay && !dayFixtures.length ? 'opacity-50' : ''}`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-accent text-bg-base flex items-center justify-center text-[10px]'
                        : 'text-text-muted'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {breakInfo && (
                    <span className="text-[9px] text-feedback-warning bg-feedback-warning/10 px-1 py-0.5 rounded leading-none">
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
                      className="group block rounded-lg border border-border hover:border-accent/50 bg-bg-surface px-2 py-1.5 transition-all"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {f.home_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt={f.home_team.name} className="w-4 h-4 shrink-0" />
                        )}
                        {hasResult ? (
                          <span className="text-[10px] font-bold text-text-primary tabular-nums mx-0.5">
                            {f.result!.home_score}–{f.result!.away_score}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-accent mx-0.5">vs</span>
                        )}
                        {f.away_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt={f.away_team.name} className="w-4 h-4 shrink-0" />
                        )}
                      </div>
                      <div className={`mt-0.5 h-1 w-full rounded-full ${STATUS_PILL[f.status]?.split(' ')[0] ?? 'bg-border/20'}`} />
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* -- Mobile List View ------------------------------------------------ */}
      <div className="sm:hidden space-y-3">
        {days.map((day) => {
          const ds = isoDate(day)
          const dayFixtures = fixtureMap[ds] ?? []
          const isToday = ds === today
          const breakInfo = isInBreak(day, breaks)
          if (!dayFixtures.length && !breakInfo) return null

          return (
            <Card
              key={ds}
              className={`overflow-hidden ${isToday ? 'ring-1 ring-accent/50' : ''}`}
            >
              <div
                className={`px-4 py-2 border-b border-border flex items-center justify-between ${
                  isToday ? 'bg-accent/10' : 'bg-bg-base'
                }`}
              >
                <span
                  className={`text-sm font-bold ${
                    isToday ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {day.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {isToday && (
                    <span className="ml-2 text-[10px] bg-accent text-bg-base px-1.5 py-0.5 rounded font-black">
                      TODAY
                    </span>
                  )}
                </span>
                {breakInfo && (
                  <span className="text-[10px] text-feedback-warning bg-feedback-warning/10 px-2 py-0.5 rounded">
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
                    className="flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-black/[0.03] transition-colors"
                  >
                    {/* Home */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {f.home_team?.logo_league_folder && (
                        <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt={f.home_team.name} className="w-7 h-7 shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {f.home_team?.name ?? 'TBD'}
                      </span>
                    </div>

                    {/* Score / vs */}
                    <div className="shrink-0 text-center min-w-[48px]">
                      {hasResult ? (
                        <span className="text-base font-black text-text-primary tabular-nums">
                          {f.result!.home_score}–{f.result!.away_score}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-accent">vs</span>
                      )}
                      <div
                        className={`text-[9px] px-1.5 py-0.5 rounded mt-0.5 font-semibold ${
                          STATUS_PILL[f.status] ?? 'bg-border/20 text-text-muted'
                        }`}
                      >
                        {f.status === 'confirmed' ? 'FT' : f.status === 'awaiting_confirmation' ? 'Awaiting' : f.status === 'abandoned' ? 'Abandoned' : 'Scheduled'}
                      </div>
                    </div>

                    {/* Away */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm font-semibold text-text-primary truncate text-right">
                        {f.away_team?.name ?? 'TBD'}
                      </span>
                      {f.away_team?.logo_league_folder && (
                        <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt={f.away_team.name} className="w-7 h-7 shrink-0" />
                      )}
                    </div>
                  </Link>
                )
              })}
            </Card>
          )
        })}

        {/* Empty month */}
        {Object.keys(fixtureMap).length === 0 && (
          <Card className="p-10 text-center">
            <p className="text-text-secondary text-sm">No fixtures this month.</p>
          </Card>
        )}
      </div>
    </>
  )
}
