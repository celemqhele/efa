'use client'

import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO } from 'date-fns'
import CalendarGrid from './CalendarGrid'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

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

  return (
    <div className="space-y-space-6">
      {nextFixture && daysUntilNext != null && (
        <Card className="p-space-4 sm:p-space-5 hover:border-accent/40 transition-all group">
          <Link href={`/fixtures/${nextFixture.id}`} className="block">
            <div className="flex items-center gap-space-4 flex-wrap sm:flex-nowrap">
              <div className="shrink-0 text-center bg-accent/10 border border-accent/30 rounded-xl px-space-4 py-space-3 min-w-[80px]">
                {daysUntilNext === 0 ? (
                  <>
                    <p className="text-2xl font-black text-accent leading-none">TODAY</p>
                    <p className="text-[10px] text-text-muted mt-space-1">Match day</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-accent leading-none">{daysUntilNext}</p>
                    <p className="text-[10px] text-text-muted mt-space-0.5">day{daysUntilNext !== 1 ? 's' : ''}</p>
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-space-2">
                  Next Fixture
                </p>
                <div className="flex items-center gap-space-3">
                  <div className="flex items-center gap-space-2 flex-1 min-w-0 justify-end">
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

                  <div className="flex items-center gap-space-2 flex-1 min-w-0">
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
                <p className="text-xs text-text-muted mt-space-1.5">
                  {nextFixture.scheduled_date
                    ? format(parseISO(nextFixture.scheduled_date), "EEEE, d MMMM yyyy 'at' HH:mm")
                    : 'Date TBD'}
                </p>
              </div>

              <span className="text-text-muted group-hover:text-accent transition-colors text-sm shrink-0">
                →
              </span>
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
            <p className="text-sm text-accent mt-space-0.5">{userTeams.map(t => t.name).join(', ')}</p>
          )}
        </div>

        <div className="flex items-center gap-space-2">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="w-space-9 h-space-9 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors font-bold"
            aria-label="Previous month"
          >
            ←
          </Link>
          <Link
            href="/calendar"
            className="px-space-3 py-space-1.5 rounded-lg border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors text-xs font-semibold"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="w-space-9 h-space-9 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors font-bold"
            aria-label="Next month"
          >
            →
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

      <div className="flex flex-wrap gap-space-4 px-space-1">
        {[
          { color: 'bg-feedback-success/30', label: 'Confirmed' },
          { color: 'bg-feedback-warning/30', label: 'Awaiting result' },
          { color: 'bg-feedback-error/30', label: 'Abandoned' },
          { color: 'bg-text-muted/30', label: 'Scheduled' },
          { color: 'bg-feedback-warning/20', label: 'Season break' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-space-1.5">
            <span className={`w-space-3 h-space-1.5 rounded-full ${color}`} />
            <span className="text-xs text-text-muted">{label}</span>
          </div>
        ))}
      </div>

      {!user && (
        <Card className="p-space-5 flex items-center gap-space-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">See your team&apos;s fixtures</p>
            <p className="text-xs text-text-muted mt-space-0.5">
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
