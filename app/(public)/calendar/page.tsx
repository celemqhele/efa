import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { differenceInDays, format, parseISO } from 'date-fns'
import CalendarGrid from './CalendarGrid'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

// --- Month navigation helpers ------------------------------------------------

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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// --- Page ---------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams

  const { year, month } = parseMonthParam(params.month)

  // Month boundaries (ISO strings)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Current user (optional)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // User's team + role (if logged in)
  let userTeam: { id: string; name: string } | null = null
  if (user) {
    const [{ data: teamRaw }] = await Promise.all([
      supabase.from('teams').select('id, name').eq('manager_id', user.id).maybeSingle(),
    ])
    userTeam = (teamRaw as any) ?? null
  }

  // Fixtures for this month
  // Admins see all fixtures; regular users with a team see only their team's fixtures
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

  if (userTeam) {
    fixtureQuery = fixtureQuery.or(
      `home_team_id.eq.${userTeam.id},away_team_id.eq.${userTeam.id}`
    )
  }

  const { data: fixtures } = await fixtureQuery.limit(500)

  // Season breaks that overlap this month
  const { data: breaksRaw } = await supabase
    .from('season_breaks')
    .select('id, break_start, break_end, reason')
    .lte('break_start', monthEnd)
    .gte('break_end', monthStart)

  const allFixtures = (fixtures ?? []) as any[]
  const allBreaks = (breaksRaw ?? []) as any[]

  // Next upcoming fixture for this user's team.
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

  if (userTeam) {
    nextQuery = nextQuery.or(
      `home_team_id.eq.${userTeam.id},away_team_id.eq.${userTeam.id}`
    )
  }

  const { data: nextFixtureArr } = await nextQuery
  const nextFixture = (nextFixtureArr ?? [])[0] as any ?? null

  // Compute countdown
  let daysUntilNext: number | null = null
  if (nextFixture?.scheduled_date) {
    const diff = differenceInDays(parseISO(nextFixture.scheduled_date), new Date())
    daysUntilNext = diff >= 0 ? diff : null
  }

  const prev = prevMonth(year, month)
  const next = nextMonth(year, month)

  return (
    <div className="space-y-space-6">

      {/* -- Next Fixture Banner --------------------------------------------- */}
      {nextFixture && daysUntilNext != null && (
        <Card className="p-space-4 sm:p-space-5 hover:border-accent/40 transition-all group">
          <Link href={`/fixtures/${nextFixture.id}`} className="block">
            <div className="flex items-center gap-space-4 flex-wrap sm:flex-nowrap">
              {/* Countdown pill */}
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
                  {/* Home */}
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

                  {/* Away */}
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

      {/* -- Month Navigation ----------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          {userTeam && (
            <p className="text-sm text-accent mt-space-0.5">{userTeam.name}</p>
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

      {/* -- Calendar ------------------------------------------------------- */}
      <Card className="overflow-hidden">
        <CalendarGrid
          year={year}
          month={month}
          fixtures={allFixtures}
          breaks={allBreaks}
        />
      </Card>

      {/* -- Legend --------------------------------------------------------- */}
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

      {/* -- Guest prompt --------------------------------------------------- */}
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
