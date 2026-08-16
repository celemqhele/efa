'use client'

import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { format, parseISO, isSameDay } from 'date-fns'
import CalendarGrid from './CalendarGrid'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useMemo } from 'react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MobileProps {
  data: {
    year: number
    month: number
    fixtures: any[]
    breaks: any[]
    user: any | null
    userTeams: { id: string; name: string }[]
    nextFixture: any | null
    daysUntilNext: number | null
    prev: { year: number; month: number }
    next: { year: number; month: number }
  }
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function Mobile({ data }: MobileProps) {
  const { year, month, fixtures, breaks, user, userTeams, nextFixture, daysUntilNext, prev, next } = data

  const todayFixtures = useMemo(() => {
    const today = new Date()
    return fixtures.filter((f: any) => {
      if (!f.scheduled_date) return false
      return isSameDay(parseISO(f.scheduled_date), today)
    })
  }, [fixtures])

  return (
    <div className="px-4 pb-8 space-y-5">
      {nextFixture && daysUntilNext != null && (
        <Link href={`/fixtures/${nextFixture.id}`} className="block bg-bg-elevated border border-border rounded-xl p-4 hover:border-accent/40 transition-colors min-h-[48px]">
          <div className="flex items-center gap-3">
            <div className="shrink-0 text-center bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 min-w-[64px] min-h-[48px] flex flex-col items-center justify-center">
              {daysUntilNext === 0 ? (
                <p className="text-sm font-black text-accent">TODAY</p>
              ) : (
                <>
                  <p className="text-xl font-black text-accent leading-none">{daysUntilNext}</p>
                  <p className="text-[10px] text-text-muted">day{daysUntilNext !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Next Fixture</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-text-primary truncate">{nextFixture.home_team?.name ?? 'TBD'}</span>
                <span className="text-xs font-bold text-accent shrink-0">vs</span>
                <span className="text-sm font-bold text-text-primary truncate">{nextFixture.away_team?.name ?? 'TBD'}</span>
              </div>
            </div>
            <span className="text-text-muted text-sm shrink-0">→</span>
          </div>
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="min-h-[48px] min-w-[48px] rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Previous month"
          >
            ←
          </Link>
          <Link
            href="/calendar"
            className="min-h-[48px] px-4 rounded-xl border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors text-xs font-semibold flex items-center"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="min-h-[48px] min-w-[48px] rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Next month"
          >
            →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <CalendarGrid
          year={year}
          month={month}
          fixtures={fixtures}
          breaks={breaks}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-elevated border border-border rounded-xl p-3 text-center min-h-[48px] flex flex-col items-center justify-center">
          <p className="text-lg font-black text-accent">{fixtures.filter((f: any) => f.status === 'confirmed').length}</p>
          <p className="text-[10px] text-text-muted">Confirmed</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-xl p-3 text-center min-h-[48px] flex flex-col items-center justify-center">
          <p className="text-lg font-black text-feedback-warning">{fixtures.filter((f: any) => f.status === 'awaiting_result' || f.status === 'pending').length}</p>
          <p className="text-[10px] text-text-muted">Pending</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-xl p-3 text-center min-h-[48px] flex flex-col items-center justify-center">
          <p className="text-lg font-black text-feedback-error">{fixtures.filter((f: any) => f.status === 'abandoned').length}</p>
          <p className="text-[10px] text-text-muted">Abandoned</p>
        </div>
      </div>

      {todayFixtures.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-accent" />
            Today&apos;s Fixtures ({todayFixtures.length})
          </h2>
          {todayFixtures.map((f: any) => (
            <Link key={f.id} href={`/fixtures/${f.id}`} className="block bg-bg-elevated border border-border rounded-xl p-4 hover:border-accent/40 transition-colors min-h-[48px]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {f.home_team?.logo_league_folder && (
                    <TeamLogo leagueFolder={f.home_team.logo_league_folder} teamSlug={f.home_team.logo_team_slug} context="standings_row" alt="" className="w-7 h-7 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-text-primary truncate">{f.home_team?.name}</span>
                </div>
                <span className="text-xs font-bold text-accent shrink-0">vs</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-bold text-text-primary truncate">{f.away_team?.name}</span>
                  {f.away_team?.logo_league_folder && (
                    <TeamLogo leagueFolder={f.away_team.logo_league_folder} teamSlug={f.away_team.logo_team_slug} context="standings_row" alt="" className="w-7 h-7 shrink-0" />
                  )}
                </div>
              </div>
              {f.scheduled_date && (
                <p className="text-xs text-text-muted mt-1">{format(parseISO(f.scheduled_date), 'HH:mm')}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {[
          { color: 'bg-feedback-success/30', label: 'Confirmed' },
          { color: 'bg-feedback-warning/30', label: 'Awaiting result' },
          { color: 'bg-feedback-error/30', label: 'Abandoned' },
          { color: 'bg-text-muted/30', label: 'Scheduled' },
          { color: 'bg-feedback-warning/20', label: 'Season break' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 min-h-[32px]">
            <span className={`w-3 h-1.5 rounded-full ${color}`} />
            <span className="text-xs text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {!user && (
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">See your team&apos;s fixtures</p>
            <p className="text-xs text-text-muted">Sign in to filter the calendar to your team&apos;s schedule.</p>
          </div>
          <Button as={Link} href="/login" variant="primary" className="min-h-[48px] w-full">
            Sign In
          </Button>
        </Card>
      )}
    </div>
  )
}
