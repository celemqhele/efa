import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { format, parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-text-muted/20 text-text-muted border-text-muted/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-feedback-warning/20 text-feedback-warning border-feedback-warning/30' },
  confirmed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  completed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30' },
}

const TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  tournament_club: 'Tournament',
  tournament_international: 'Intl',
  friendlies: 'Friendly',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-accent border-accent/40 bg-accent/5',
  tournament_club: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  tournament_international: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  friendlies: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
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

export default async function TeamFixturesPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // Get the team details
  const { data: _team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single() as any
  const team = _team as any

  if (!team) notFound()

  // Resolve all sibling team IDs for this club (same slug across phases)
  const { data: siblingTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('logo_league_folder', team.logo_league_folder)
    .eq('logo_team_slug', team.logo_team_slug)
  
  const siblingIdsAll = (siblingTeams ?? []).map((t: any) => t.id)
  const siblingIds = siblingIdsAll.length > 0 ? siblingIdsAll : [id]
  const teamOrFilter = siblingIds
    .flatMap((tid) => [`home_team_id.eq.${tid}`, `away_team_id.eq.${tid}`])
    .join(',')

  // Fetch all fixtures for this team
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg, home_team_id, away_team_id,
      tournament:tournaments(id, name, type, status),
      home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .or(teamOrFilter)
    .order('scheduled_date', { ascending: false })

  const fixtureIds = (allFixtures ?? []).map((f: any) => f.id)
  const { data: resultsData } = fixtureIds.length > 0
    ? await supabase
        .from('results')
        .select('id, fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, { id: string; home_score: number; away_score: number }> = {}
  for (const r of resultsData ?? []) {
    resultsByFixture[(r as any).fixture_id] = r as any
  }

  // Split into upcoming and past
  const upcoming = (allFixtures ?? [])
    .filter((f: any) => f.status === 'scheduled' || f.status === 'awaiting_confirmation')
    .reverse() // Most recent upcoming first
  
  const past = (allFixtures ?? [])
    .filter((f: any) => f.status !== 'scheduled' && f.status !== 'awaiting_confirmation')

    function FixtureRow({ f }: { f: any }) {
    // Safely extract joined team data (Supabase sometimes returns arrays)
    const homeTeam = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
    const awayTeam = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team
    
    const isHome = homeTeam ? siblingIds.includes(homeTeam.id) : siblingIds.includes(f.home_team_id)
    const opponent = isHome ? awayTeam : homeTeam
    
    // Result fetching (handles cases where results might be null)
    const result = resultsByFixture[f.id]
    
    // Correctly define score based on team's position (home/away)
    const myScore = isHome ? result?.home_score : result?.away_score
    const oppScore = isHome ? result?.away_score : result?.home_score
    
    // Outcome logic: handle nulls gracefully
    const hasResult = result != null && myScore != null && oppScore != null
    const won = hasResult && myScore > oppScore
    const lost = hasResult && myScore < oppScore
    const drew = hasResult && myScore === oppScore

    const tournament = f.tournament
    const tournamentType = tournament?.type ?? 'unknown'
    const tournamentLabel = TYPE_LABELS[tournamentType] ?? tournament?.name ?? '—'
    const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

    let resultBadge: React.ReactNode = null
    if (won) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-feedback-success/20 text-feedback-success border border-feedback-success/30">W</span>
    } else if (lost) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-feedback-error/20 text-feedback-error border border-feedback-error/30">L</span>
    } else if (drew) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-text-muted/20 text-text-muted border border-text-muted/30">D</span>
    }

    return (
      <Link
        href={result ? `/results/${result.id}` : `/fixtures/${f.id}`}
        className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-bg-surface hover:border-accent/30 hover:bg-black/[0.03] transition-all"
      >
        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${TYPE_ACCENT[tournamentType] ?? 'text-text-muted border-border'}`}>
          {tournamentLabel}
        </div>

        <div className="text-xs text-text-muted font-mono shrink-0 w-8 text-center">
          {isHome ? 'vs' : '@'}
        </div>

        {opponent?.logo_league_folder ? (
          <TeamLogo
            leagueFolder={opponent.logo_league_folder}
            teamSlug={opponent.logo_team_slug}
            context="standings_row"
            alt={opponent.name}
            className="w-8 h-8 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-bg-base shrink-0 flex items-center justify-center text-[10px] text-text-muted">?</div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {opponent?.name ?? 'TBC'}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatWhen(f.scheduled_date)}
          </p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {result ? (
            <span className="text-base font-black text-text-primary tabular-nums">
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
      <div className="flex items-center gap-4">
        <Link 
          href={`/teams/${id}`}
          className="w-10 h-10 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
        >
          ‹
        </Link>
        <div className="flex items-center gap-3">
          <TeamLogo
            leagueFolder={team.logo_league_folder}
            teamSlug={team.logo_team_slug}
            context="standings_row"
            alt={team.name}
            className="w-12 h-12"
          />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Fixtures & Results</h1>
            <p className="text-sm text-accent font-medium">{team.name}</p>
          </div>
        </div>
      </div>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent" />
          Upcoming
          <span className="ml-auto text-text-muted font-normal">{upcoming.length}</span>
        </h2>
        {upcoming.length === 0 ? (
          <Card className="p-8 text-center text-sm text-text-muted">
            No upcoming fixtures scheduled.
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((f: any) => <FixtureRow key={f.id} f={f} />)}
          </div>
        )}
      </section>

      {/* Past Results */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-feedback-success" />
          Past Results
          <span className="ml-auto text-text-muted font-normal">{past.length}</span>
        </h2>
        {past.length === 0 ? (
          <Card className="p-8 text-center text-sm text-text-muted">
            No past results on record.
          </Card>
        ) : (
          <div className="space-y-2">
            {past.map((f: any) => <FixtureRow key={f.id} f={f} />)}
          </div>
        )}
      </section>
    </div>
  )
}
