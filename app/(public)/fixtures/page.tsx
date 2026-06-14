import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { CircleDot, Crosshair, CalendarDays, ChevronRight } from 'lucide-react'
import { FixtureListSkeleton } from '@/components/ui/Skeleton'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-slate-500/20 text-text-muted border-slate-500/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  confirmed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  completed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-red-500/20 text-red-500 border-red-500/30' },
}

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'bg-accent/10 text-accent border-accent/25' },
  ucl: { label: 'UCL', colour: 'bg-blue-500/10 text-blue-400 border-blue-500/25' },
  europa: { label: 'EL', colour: 'bg-orange-500/10 text-orange-400 border-orange-500/25' },
  super_cup: { label: 'SC', colour: 'bg-purple-500/10 text-purple-400 border-purple-500/25' },
}

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      timeZone: APP_TIME_ZONE,
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
    return `${datePart} · ${timePart}`
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return parseISO(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return null
  }
}

function formatDateGroup(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = parseISO(dateStr)
    const today = new Date()
    const todayKey = today.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = tomorrow.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })
    const dateKey = d.toLocaleDateString('en-GB', { timeZone: APP_TIME_ZONE })

    if (dateKey === todayKey) return 'Today'
    if (dateKey === tomorrowKey) return 'Tomorrow'

    return d.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return dateStr
  }
}

function FixtureCard({ f, teamIds }: { f: any; teamIds: string[] }) {
  const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
  const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
  const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament

  const isHome = teamIds.includes(home?.id)
  const opponent = isHome ? away : home
  const result = f._result
  const myScore = isHome ? result?.home_score : result?.away_score
  const oppScore = isHome ? result?.away_score : result?.home_score
  const won = result != null && myScore != null && oppScore != null && myScore > oppScore
  const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
  const drew = result != null && myScore != null && oppScore != null && myScore === oppScore

  const tournamentType = t?.type ?? 'unknown'
  const typeStyle = TYPE_STYLES[tournamentType] ?? { label: t?.name ?? '—', colour: 'bg-slate-500/10 text-text-muted border-slate-500/25' }
  const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']
  const time = formatTime(f.scheduled_date)

  let resultBadge: React.ReactNode = null
  if (won) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">W</span>
  } else if (lost) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 border border-red-500/30">L</span>
  } else if (drew) {
    resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-500/20 text-text-muted border border-slate-500/30">D</span>
  }

  return (
    <Link
      href={`/fixtures/${f.id}`}
      className="card flex flex-col gap-2.5 active:scale-[0.98] transition-transform"
    >
      {/* Top row: tournament badge + matchday + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border ${typeStyle.colour}`}>
            {typeStyle.label}
          </span>
          <span className="text-[10px] text-text-muted font-semibold">MD{f.matchday}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Teams area: two rows with centered VS */}
      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {home?.logo_league_folder && (
            <TeamLogo
              leagueFolder={home.logo_league_folder}
              teamSlug={home.logo_team_slug}
              context="fixture_card"
              alt={home.name}
              className="w-12 h-12"
            />
          )}
          <span className="text-sm font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">
            {home?.name ?? 'TBC'}
          </span>
        </div>

        {/* VS divider */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">vs</span>
          {result ? (
            <span className="text-lg font-black text-foreground-primary tabular-nums">
              {myScore}–{oppScore}
            </span>
          ) : time ? (
            <span className="text-xs font-mono text-text-muted font-semibold">{time}</span>
          ) : null}
        </div>

        {/* Away team */}
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {away?.logo_league_folder && (
            <TeamLogo
              leagueFolder={away.logo_league_folder}
              teamSlug={away.logo_team_slug}
              context="fixture_card"
              alt={away.name}
              className="w-12 h-12"
            />
          )}
          <span className="text-sm font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">
            {away?.name ?? 'TBC'}
          </span>
        </div>
      </div>

      {/* Bottom row: result badge + tap hint */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {resultBadge}
          {f.status === 'awaiting_confirmation' && (
            <span className="text-[10px] text-yellow-500 font-medium">Confirm result</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted" />
      </div>
    </Link>
  )
}

async function FixturesContent() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="space-y-6 px-4">
        <h1 className="text-xl font-bold text-foreground-primary">My Fixtures</h1>
        <div className="card p-10 text-center space-y-3">
          <CircleDot className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">Log in to see your team&apos;s fixtures.</p>
          <Link href="/login" className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  const { data: _userTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('manager_id', user.id)
  const userTeams = (_userTeams ?? []) as any[]

  const teams = userTeams
  const teamIds = teams.map((t) => t.id)

  if (teamIds.length === 0) {
    return (
      <div className="space-y-6 px-4">
        <h1 className="text-xl font-bold text-foreground-primary">My Fixtures</h1>
        <div className="card p-10 text-center space-y-3">
          <Crosshair className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">You don&apos;t have a team yet.</p>
          <Link href="/select-team" className="btn-gold inline-block text-sm">Pick a team</Link>
        </div>
      </div>
    )
  }

  const teamOrFilter = teamIds
    .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
    .join(',')

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg,
      tournament:tournaments(id, name, type),
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .or(teamOrFilter)
    .order('scheduled_date', { ascending: true })

  const fixtureIds = (fixtures ?? []).map((f: any) => f.id)
  const { data: resultsData } = fixtureIds.length > 0
    ? await supabase
        .from('results')
        .select('fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, { home_score: number; away_score: number }> = {}
  for (const r of resultsData ?? []) {
    resultsByFixture[(r as any).fixture_id] = r as any
  }

  const fixturesWithResults = (fixtures ?? []).map((f: any) => ({
    ...f,
    _result: resultsByFixture[f.id] ?? null,
  }))

  const upcomingStatuses = new Set(['scheduled', 'awaiting_confirmation'])
  const upcoming = fixturesWithResults.filter((f: any) => upcomingStatuses.has(f.status))

  // Group by date
  const grouped: Record<string, any[]> = {}
  for (const f of upcoming) {
    const key = f.scheduled_date ? f.scheduled_date.slice(0, 10) : 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key]!.push(f)
  }

  const sortedKeys = Object.keys(grouped).sort()

  const primaryTeam = teams[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="fixture_card"
            alt={primaryTeam.name}
            className="w-10 h-10"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground-primary">My Fixtures</h1>
          {primaryTeam && (
            <p className="text-xs text-accent truncate">{primaryTeam.name}</p>
          )}
        </div>
        <Link href="/results" className="text-xs font-semibold text-accent shrink-0">
          Results →
        </Link>
      </div>

      {/* Date-grouped fixture cards */}
      {upcoming.length === 0 ? (
        <div className="card p-8 text-center text-sm text-text-muted">
          <CalendarDays className="w-8 h-8 text-text-muted mx-auto mb-2" />
          No upcoming fixtures.
        </div>
      ) : (
        <div className="space-y-5">
          {sortedKeys.map((dateKey) => {
            const fixturesInGroup = grouped[dateKey]!
            return (
              <section key={dateKey}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <div className="w-1 h-4 rounded-full bg-accent" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">
                    {formatDateGroup(dateKey)}
                  </h2>
                  <span className="text-[10px] text-text-muted">({fixturesInGroup.length})</span>
                </div>
                <div className="space-y-2.5">
                  {fixturesInGroup.map((f: any) => (
                    <FixtureCard key={f.id} f={f} teamIds={teamIds} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default async function FixturesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bg-surface0 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-32 bg-bg-surface0 animate-pulse rounded" />
            <div className="h-3 w-20 bg-bg-surface0 animate-pulse rounded" />
          </div>
        </div>
        <FixtureListSkeleton count={3} />
      </div>
    }>
      <FixturesContent />
    </Suspense>
  )
}
