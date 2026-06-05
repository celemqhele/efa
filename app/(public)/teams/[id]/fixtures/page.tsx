import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { format, parseISO } from 'date-fns'
import { APP_TIME_ZONE } from '@/lib/app-time'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-slate-500/20 text-slate-500 border-slate-500/30' },
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
  league: 'text-[#c9a84c] border-[#c9a84c]/40 bg-[#c9a84c]/5',
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

export default async function TeamFixturesPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = params

  // Get the team details
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single()

  if (!team) notFound()

  // Resolve all sibling team IDs for this club (same slug across phases)
  const { data: siblingTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('logo_league_folder', team.logo_league_folder)
    .eq('logo_team_slug', team.logo_team_slug)
  
  const siblingIds = (siblingTeams ?? []).map((t: any) => t.id)
  const teamOrFilter = siblingIds
    .flatMap((tid) => [`home_team_id.eq.${tid}`, `away_team_id.eq.${tid}`])
    .join(',')

  // Fetch all fixtures for this team
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date, status, round_type, leg,
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
        .select('fixture_id, home_score, away_score')
        .in('fixture_id', fixtureIds)
    : { data: [] }

  const resultsByFixture: Record<string, { home_score: number; away_score: number }> = {}
  for (const r of resultsData ?? []) {
    resultsByFixture[(r as any).fixture_id] = r as any
  }

  // Split into upcoming and past
  const now = new Date()
  const upcoming = (allFixtures ?? [])
    .filter((f: any) => f.status === 'scheduled' || f.status === 'awaiting_confirmation')
    .reverse() // Most recent upcoming first
  
  const past = (allFixtures ?? [])
    .filter((f: any) => f.status !== 'scheduled' && f.status !== 'awaiting_confirmation')

  function FixtureRow({ f }: { f: any }) {
    const isHome = siblingIds.includes(f.home_team_id)
    const opponent = isHome ? f.away_team : f.home_team
    const result = resultsByFixture[f.id]
    const myScore = isHome ? result?.home_score : result?.away_score
    const oppScore = isHome ? result?.away_score : result?.home_score
    const won = result != null && myScore != null && oppScore != null && myScore > oppScore
    const lost = result != null && myScore != null && oppScore != null && myScore < oppScore
    const drew = result != null && myScore != null && oppScore != null && myScore === oppScore

    const tournament = f.tournament
    const tournamentType = tournament?.type ?? 'unknown'
    const tournamentLabel = TYPE_LABELS[tournamentType] ?? tournament?.name ?? '—'
    const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

    let resultBadge: React.ReactNode = null
    if (won) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">W</span>
    } else if (lost) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 border border-red-500/30">L</span>
    } else if (drew) {
      resultBadge = <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-500 border border-slate-500/30">D</span>
    }

    return (
      <Link
        href={f.status === 'confirmed' || f.status === 'completed' ? `/results/${f.id}` : `/fixtures/${f.id}`}
        className="card flex items-center gap-3 px-4 py-3 hover:border-[#c9a84c]/30 hover:bg-black/[0.03] transition-all"
      >
        <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${TYPE_ACCENT[tournamentType] ?? 'text-slate-500 border-slate-200'}`}>
          {tournamentLabel}
        </div>

        <div className="text-xs text-slate-500 font-mono shrink-0 w-8 text-center">
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
          <p className="text-sm font-semibold text-slate-900 truncate">
            {opponent?.name ?? 'TBC'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {formatWhen(f.scheduled_date)}
          </p>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          {result ? (
            <span className="text-base font-black text-slate-900 tabular-nums">
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
          className="w-10 h-10 rounded-lg flex items-center justify-center border border-slate-200 text-slate-400 hover:border-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors"
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
            <h1 className="text-2xl font-bold text-slate-900">Fixtures & Results</h1>
            <p className="text-sm text-[#c9a84c] font-medium">{team.name}</p>
          </div>
        </div>
      </div>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold" />
          Upcoming
          <span className="ml-auto text-slate-400 font-normal">{upcoming.length}</span>
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No upcoming fixtures scheduled.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((f: any) => <FixtureRow key={f.id} f={f} />)}
          </div>
        )}
      </section>

      {/* Past Results */}
      <section className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Past Results
          <span className="ml-auto text-slate-400 font-normal">{past.length}</span>
        </h2>
        {past.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No past results on record.
          </div>
        ) : (
          <div className="space-y-2">
            {past.map((f: any) => <FixtureRow key={f.id} f={f} />)}
          </div>
        )}
      </section>
    </div>
  )
}
