import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-slate-500/20 text-text-muted border-slate-500/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  confirmed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  completed: { label: 'FT', pill: 'bg-green-500/20 text-green-600 border-green-500/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-red-500/20 text-red-500 border-red-500/30' },
}

const TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-accent border-accent/40 bg-accent/5',
  ucl: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  europa: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  super_cup: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
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

export default async function FixturesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground-primary">My Fixtures</h1>
        <div className="card p-12 text-center space-y-3">
          <p className="text-4xl">⚽</p>
          <p className="text-text-muted text-sm">Log in to see your team&apos;s fixtures.</p>
          <Link href="/login" className="btn-gold inline-block text-sm">Log in</Link>
        </div>
      </div>
    )
  }

  // User's team(s) — same club can exist across multiple phases
  const { data: _userTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('manager_id', user.id)
  const userTeams = (_userTeams ?? []) as any[]

  const teams = userTeams
  const teamIds = teams.map((t) => t.id)

  if (teamIds.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground-primary">My Fixtures</h1>
        <div className="card p-12 text-center space-y-3">
          <p className="text-4xl">🎯</p>
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

  const upcomingStatuses = new Set(['scheduled', 'awaiting_confirmation'])
  const upcoming = (fixtures ?? []).filter((f: any) => upcomingStatuses.has(f.status))

  const primaryTeam = teams[0]

  function FixtureRow({ f }: { f: any }) {
    const home = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const away = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament

    const isHome = teamIds.includes(home?.id)
    const opponent = isHome ? away : home
    const result = resultsByFixture[f.id]
    const myScore = isHome ? result?.home_score : result?.away_score
    const oppScore = isHome ? result?.away_score : result?.home_score
    const won = result != null && myScore != null && oppScore != null && myScore > oppScore
    const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
    const drew = result != null && myScore != null && oppScore != null && myScore === oppScore

    const tournamentType = t?.type ?? 'unknown'
    const tournamentLabel = TYPE_LABELS[tournamentType] ?? t?.name ?? '—'
    const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

    let resultBadge: React.ReactNode = null
    if (won) {
      resultBadge = (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">
          W
        </span>
      )
    } else if (lost) {
      resultBadge = (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 border border-red-500/30">
          L
        </span>
      )
    } else if (drew) {
      resultBadge = (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-500/20 text-text-muted border border-slate-500/30">
          D
        </span>
      )
    }

    return (
      <Link
        href={`/fixtures/${f.id}`}
        className="card flex items-center gap-3 px-4 py-3 hover:border-accent/30 hover:bg-black/[0.03] transition-all"
      >
        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${TYPE_ACCENT[tournamentType] ?? 'text-text-muted border-border'}`}>
          {tournamentLabel}
        </div>

        <div className="text-xs text-text-muted font-mono shrink-0 w-8 text-center">
          {isHome ? 'vs' : '@'}
        </div>

        {opponent?.logo_league_folder && (
          <TeamLogo
            leagueFolder={opponent.logo_league_folder}
            teamSlug={opponent.logo_team_slug}
            context="standings_row"
            alt={opponent.name}
            className="w-8 h-8 shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground-primary">
            {opponent?.name ?? 'TBC'}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatWhen(f.scheduled_date)}
          </p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {result ? (
            <span className="text-base font-black text-foreground-primary tabular-nums">
              {myScore}–{oppScore}
            </span>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
              {statusInfo.label}
            </span>
          )}
          {resultBadge}
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {primaryTeam?.logo_league_folder && (
          <TeamLogo
            leagueFolder={primaryTeam.logo_league_folder}
            teamSlug={primaryTeam.logo_team_slug}
            context="standings_row"
            alt={primaryTeam.name}
            className="w-12 h-12"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground-primary">My Fixtures</h1>
          {primaryTeam && (
            <p className="text-sm text-accent">{primaryTeam.name}</p>
          )}
        </div>
      </div>

      {/* Upcoming */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">Upcoming</h2>
            <span className="text-xs text-text-muted">{upcoming.length}</span>
          </div>
          <Link href="/results" className="text-xs text-accent hover:text-[#e0c06a]">
            See results →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center text-sm text-text-muted">
            No upcoming fixtures.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((f: any) => <FixtureRow key={f.id} f={f} />)}
          </div>
        )}
      </section>
    </div>
  )
}

