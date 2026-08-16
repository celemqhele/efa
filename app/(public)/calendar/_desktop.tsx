'use client'

import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { format, parseISO } from 'date-fns'
import CalendarGrid from './CalendarGrid'
import { Card } from '@/components/ui/Card'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

interface DesktopProps {
  data: {
    year: number
    month: number
    fixtures: any[]
    breaks: any[]
    user: any | null
    userTeams: { id: string; name: string }[]
    nextFixture: any | null
    daysUntilNext: number | null
    scope: string
  }
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

export default function Desktop({ data }: DesktopProps) {
  const { year, month, fixtures, breaks, user, userTeams, nextFixture, daysUntilNext, scope } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {nextFixture && daysUntilNext != null && (
        <Card className="p-5 hover:border-accent/40 transition-all group">
          <Link href={`/fixtures/${nextFixture.id}`} className="block">
            <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
              <div className="shrink-0 text-center bg-accent/10 border border-accent/30 rounded-xl px-5 py-3 min-w-[80px]">
                {daysUntilNext === 0 ? (
                  <>
                    <p className="text-2xl font-black text-accent leading-none">TODAY</p>
                    <p className="text-[10px] text-text-muted mt-1">Match day</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-accent leading-none">{daysUntilNext}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">day{daysUntilNext !== 1 ? 's' : ''}</p>
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
                  Next Fixture
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-bold text-text-primary truncate">
                      {nextFixture.home_team?.name ?? 'TBD'}
                    </span>
                    {nextFixture.home_team?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={nextFixture.home_team.logo_league_folder}
                        teamSlug={nextFixture.home_team.logo_team_slug}
                        context="standings_row"
                        alt={nextFixture.home_team.name}
                        className="w-9 h-9 shrink-0"
                      />
                    )}
                  </div>

                  <span className="text-xs font-bold text-accent shrink-0">vs</span>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {nextFixture.away_team?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={nextFixture.away_team.logo_league_folder}
                        teamSlug={nextFixture.away_team.logo_team_slug}
                        context="standings_row"
                        alt={nextFixture.away_team.name}
                        className="w-9 h-9 shrink-0"
                      />
                    )}
                    <span className="text-sm font-bold text-text-primary truncate">
                      {nextFixture.away_team?.name ?? 'TBD'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-1.5">
                  {nextFixture.scheduled_date
                    ? format(parseISO(nextFixture.scheduled_date), "EEEE, d MMMM yyyy 'at' HH:mm")
                    : 'Date TBD'}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors shrink-0" />
            </div>
          </Link>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          {userTeams.length > 0 && scope === 'mine' && (
            <p className="text-sm text-accent mt-0.5">{userTeams.map(t => t.name).join(', ')}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/calendar?month=${monthParam(prevMonth(year, month).year, prevMonth(year, month).month)}&scope=${scope}`}
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            href={`/calendar?scope=${scope}`}
            className="px-3 py-1.5 rounded-xl border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors text-xs font-semibold"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthParam(nextMonth(year, month).year, nextMonth(year, month).month)}&scope=${scope}`}
            className="w-8 h-8 rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>

          <div className="w-px h-6 bg-border mx-1" />

          <div className="relative flex bg-bg-elevated/50 rounded-xl p-0.5 gap-0.5">
            <Link
              href={`/calendar?month=${monthParam(year, month)}&scope=mine`}
              className={`relative z-10 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
                scope === 'mine' ? 'text-bg-base' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Mine
            </Link>
            <Link
              href={`/calendar?month=${monthParam(year, month)}&scope=all`}
              className={`relative z-10 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
                scope === 'all' ? 'text-bg-base' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </Link>
            <div
              className={`absolute top-0.5 bottom-0.5 rounded-[10px] bg-accent shadow-sm transition-all duration-200 ${
                scope === 'all' ? 'left-1/2 right-0.5' : 'left-0.5 right-1/2'
              }`}
            />
          </div>
        </div>
      </div>

      {scope === 'all' ? (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {fixtures.length === 0 ? (
              <div className="p-10 text-center text-sm text-text-muted">No fixtures this month.</div>
            ) : (
              fixtures.map((f: any) => {
                const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
                const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
                const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
                const result = f.result
                const tournamentType = t?.type ?? 'unknown'
                const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }
                const dateStr = f.scheduled_date ? format(parseISO(f.scheduled_date), 'd MMM') : '—'
                const timeStr = f.scheduled_date ? format(parseISO(f.scheduled_date), 'HH:mm') : '—'

                return (
                  <Link
                    key={f.id}
                    href={`/fixtures/${f.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-accent/5 transition-colors"
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-xs font-semibold text-text-muted tabular-nums">{dateStr}</p>
                      <p className="text-[11px] text-text-muted tabular-nums">{timeStr}</p>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 ${typeStyle.colour}`}>
                      {typeStyle.label}
                    </span>
                    <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                      <span className="text-sm font-semibold text-text-primary truncate text-right">{home?.name ?? 'TBC'}</span>
                      {home?.logo_league_folder && (
                        <TeamLogo leagueFolder={home.logo_league_folder} teamSlug={home.logo_team_slug} context="standings_row" alt="" className="w-6 h-6 shrink-0" />
                      )}
                    </div>
                    <div className="w-14 text-center shrink-0">
                      {result ? (
                        <span className="text-base font-black text-text-primary tabular-nums leading-none">
                          {result.home_score}–{result.away_score}
                        </span>
                      ) : (
                        <span className="text-xs font-black uppercase tracking-widest text-text-muted">vs</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {away?.logo_league_folder && (
                        <TeamLogo leagueFolder={away.logo_league_folder} teamSlug={away.logo_team_slug} context="standings_row" alt="" className="w-6 h-6 shrink-0" />
                      )}
                      <span className="text-sm font-semibold text-text-primary truncate">{away?.name ?? 'TBC'}</span>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CalendarGrid
            year={year}
            month={month}
            fixtures={fixtures}
            breaks={breaks}
          />
        </Card>
      )}

      <div className="flex flex-wrap gap-4 px-1">
        {[
          { color: 'bg-feedback-success/30', label: 'Confirmed' },
          { color: 'bg-feedback-warning/30', label: 'Awaiting result' },
          { color: 'bg-feedback-error/30', label: 'Abandoned' },
          { color: 'bg-text-muted/30', label: 'Scheduled' },
          { color: 'bg-feedback-warning/20', label: 'Season break' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-1.5 rounded-full ${color}`} />
            <span className="text-xs text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {!user && (
        <Card className="p-5 flex items-center gap-5 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">See your team&apos;s fixtures</p>
            <p className="text-xs text-text-muted mt-0.5">
              Sign in to filter the calendar to your team&apos;s schedule.
            </p>
          </div>
          <Link href="/login" className="text-sm font-bold px-4 py-2 rounded-xl bg-accent text-bg-base hover:bg-accent/90 transition-colors shadow-sm">
            Sign In
          </Link>
        </Card>
      )}
    </div>
  )
}
