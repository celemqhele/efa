'use client'

import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO } from 'date-fns'
import CalendarGrid from './CalendarGrid'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
    prev: { year: number; month: number }
    next: { year: number; month: number }
  }
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function Desktop({ data }: DesktopProps) {
  const { year, month, fixtures, breaks, user, userTeams, nextFixture, daysUntilNext, prev, next } = data

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
                      <Image
                        src={getTeamLogo(nextFixture.home_team.logo_league_folder, nextFixture.home_team.logo_team_slug, 'standings_row')}
                        alt={nextFixture.home_team.name}
                        width={36}
                        height={36}
                        className="object-contain shrink-0"
                      />
                    )}
                  </div>

                  <span className="text-xs font-bold text-accent shrink-0">vs</span>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {nextFixture.away_team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(nextFixture.away_team.logo_league_folder, nextFixture.away_team.logo_team_slug, 'standings_row')}
                        alt={nextFixture.away_team.name}
                        width={36}
                        height={36}
                        className="object-contain shrink-0"
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
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          {userTeams.length > 0 && (
            <p className="text-sm text-accent mt-0.5">{userTeams.map(t => t.name).join(', ')}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Link
            href="/calendar"
            className="px-3 py-1.5 rounded-xl border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors text-xs font-semibold"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CalendarGrid
          year={year}
          month={month}
          fixtures={fixtures}
          breaks={breaks}
        />
      </Card>

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
          <Button as={Link} href="/login" variant="primary">
            Sign In
          </Button>
        </Card>
      )}
    </div>
  )
}
