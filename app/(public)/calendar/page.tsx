import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { differenceInDays, format, parseISO } from 'date-fns'
import CalendarGrid from './CalendarGrid'

export const dynamic = 'force-dynamic'

// ─── Month navigation helpers ────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  let isAdmin = false
  if (user) {
    const [{ data: teamRaw }, { data: profileRaw }] = await Promise.all([
      supabase.from('teams').select('id, name').eq('manager_id', user.id).maybeSingle(),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])
    userTeam = (teamRaw as any) ?? null
    isAdmin = (profileRaw as any)?.role === 'admin'
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
  // The server runs in UTC; subtract 1 day so "today" fixtures are never missed
  // for users in UTC-X timezones (already-played fixtures are excluded by status filter).
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
    <div className="space-y-6">

      {/* ── Next Fixture Banner ───────────────────────────────────────────── */}
      {nextFixture && daysUntilNext != null && (
        <Link
          href={`/fixtures/${nextFixture.id}`}
          className="block card p-4 sm:p-5 hover:border-[#c9a84c]/40 transition-all group"
        >
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            {/* Countdown pill */}
            <div className="shrink-0 text-center bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl px-4 py-3 min-w-[80px]">
              {daysUntilNext === 0 ? (
                <>
                  <p className="text-2xl font-black text-[#c9a84c] leading-none">TODAY</p>
                  <p className="text-[10px] text-slate-400 mt-1">Match day</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-[#c9a84c] leading-none">{daysUntilNext}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">day{daysUntilNext !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                Next Fixture
              </p>
              <div className="flex items-center gap-3">
                {/* Home */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {nextFixture.home_team?.logo_league_folder && (
                    <Image
                      src={getTeamLogo(nextFixture.home_team.logo_league_folder, nextFixture.home_team.logo_team_slug, 'standings_row')}
                      alt={nextFixture.home_team.name}
                      width={36}
                      height={36}
                      className="object-contain shrink-0"
                    />
                  )}
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {nextFixture.home_team?.name ?? 'TBD'}
                  </span>
                </div>

                <span className="text-xs font-bold text-[#c9a84c] shrink-0">vs</span>

                {/* Away */}
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-bold text-slate-900 truncate text-right">
                    {nextFixture.away_team?.name ?? 'TBD'}
                  </span>
                  {nextFixture.away_team?.logo_league_folder && (
                    <Image
                      src={getTeamLogo(nextFixture.away_team.logo_league_folder, nextFixture.away_team.logo_team_slug, 'standings_row')}
                      alt={nextFixture.away_team.name}
                      width={36}
                      height={36}
                      className="object-contain shrink-0"
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {nextFixture.scheduled_date
                  ? format(parseISO(nextFixture.scheduled_date), "EEEE, d MMMM yyyy 'at' HH:mm")
                  : 'Date TBD'}
              </p>
            </div>

            <span className="text-slate-500 group-hover:text-[#c9a84c] transition-colors text-sm shrink-0">
              →
            </span>
          </div>
        </Link>
      )}

      {/* ── Month Navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          {userTeam && (
            <p className="text-sm text-[#c9a84c] mt-0.5">{userTeam.name}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors font-bold"
            aria-label="Previous month"
          >
            ‹
          </Link>
          <Link
            href="/calendar"
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors text-xs font-semibold"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors font-bold"
            aria-label="Next month"
          >
            ›
          </Link>
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <CalendarGrid
          year={year}
          month={month}
          fixtures={allFixtures}
          breaks={allBreaks}
        />
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 px-1">
        {[
          { color: 'bg-green-500/30', label: 'Confirmed' },
          { color: 'bg-yellow-500/30', label: 'Awaiting result' },
          { color: 'bg-red-500/30', label: 'Abandoned' },
          { color: 'bg-slate-500/30', label: 'Scheduled' },
          { color: 'bg-orange-500/20', label: 'Season break' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-1.5 rounded-full ${color}`} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Guest prompt ─────────────────────────────────────────────────── */}
      {!user && (
        <div className="card p-5 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">See your team&apos;s fixtures</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Sign in to filter the calendar to your team&apos;s schedule.
            </p>
          </div>
          <Link href="/login" className="btn-gold shrink-0">
            Sign In
          </Link>
        </div>
      )}

    </div>
  )
}
