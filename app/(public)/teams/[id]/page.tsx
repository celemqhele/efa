import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import { getTeamDNA, getTeamCombination, buildTeamStatsMixed } from '@/lib/dna-engine'
import DNABadge from '@/components/ui/DNABadge'
import CombinationBadge from '@/components/ui/CombinationBadge'
import TeamManagerAdmin from './TeamManagerAdmin'
import ApplyManagerButton from '@/components/ui/ApplyManagerButton'
import MessageManagerButton from '@/components/ui/MessageManagerButton'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

const TROPHY_ICON: Record<string, string> = {
  league: '🏆',
  ucl: '⭐',
  europa: '🌍',
  super_cup: '🏅',
}

const TROPHY_LABEL: Record<string, string> = {
  league: 'League Champion',
  ucl: 'UCL Winner',
  europa: 'Europa Winner',
  super_cup: 'Super Cup',
}

export default async function TeamProfilePage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = params

  // Team with manager
  const { data: team } = await supabase
    .from('teams')
    .select('*, manager:profiles!teams_manager_id_fkey(*)')
    .eq('id', id)
    .single()

  if (!team) notFound()

  // Resolve all sibling team IDs for this club (same slug across phases)
  // Must run early so trophies + standings can use it
  const { data: siblingTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('logo_league_folder', team.logo_league_folder)
    .eq('logo_team_slug', team.logo_team_slug)
  const allTeamIds = (siblingTeams ?? []).map((t: any) => t.id)
  const siblingIds: string[] = allTeamIds.length > 0 ? allTeamIds : [id]
  const teamOrFilter = siblingIds
    .flatMap((tid) => [`home_team_id.eq.${tid}`, `away_team_id.eq.${tid}`])
    .join(',')

  const manager = (team as any).manager

  // Check if current user is admin (for manager controls)
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  let isAdmin = false
  let isCurrentManager = false
  let hasPendingApplication = false
  let allProfiles: { id: string; username: string; avatar_url: string | null }[] = []
  const managedTeamByUser: Record<string, string> = {}

  if (currentUser) {
    const { data: currentProfile } = await supabase
      .from('profiles').select('role').eq('id', currentUser.id).single()
    isAdmin = currentProfile?.role === 'admin'
    isCurrentManager = (team as any).manager_id === currentUser.id

    if (isAdmin) {
      const [{ data: profiles }, { data: allTeams }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').order('username'),
        supabase.from('teams').select('name, manager_id').not('manager_id', 'is', null),
      ])
      allProfiles = profiles ?? []
      for (const t of allTeams ?? []) {
        if (t.manager_id && !managedTeamByUser[t.manager_id]) {
          managedTeamByUser[t.manager_id] = t.name
        }
      }
    } else if (!isCurrentManager) {
      // Check if user has a pending application for this team
      const { data: pendingApp } = await supabase
        .from('manager_applications' as any)
        .select('id')
        .eq('applicant_id', currentUser.id)
        .eq('team_id', id)
        .eq('status', 'pending')
        .maybeSingle()
      hasPendingApplication = !!pendingApp
    }
  }

  // Trophies with tournament + season — across ALL sibling team rows
  const { data: trophies } = await supabase
    .from('trophies')
    .select('*, tournament:tournaments(*), season:seasons(*)')
    .in('team_id', siblingIds)
    .order('awarded_at', { ascending: false })

  // Standings across all tournaments — across ALL sibling team rows so Phase 1 history shows
  const { data: standings } = await supabase
    .from('standings')
    .select('*, tournament:tournaments(*)')
    .in('team_id', siblingIds)

  // Active standings (from active tournaments)
  const activeStandings = (standings ?? []).filter(
    (s: any) => s.tournament?.status === 'active'
  )

  // Current season stats — active tournament only (resets to 0 at season start)
  const currentStanding = (activeStandings[0] as any) ?? null
  const totalPlayed = currentStanding?.played ?? 0
  const totalWins = currentStanding?.wins ?? 0
  const totalDraws = currentStanding?.draws ?? 0
  const totalLosses = currentStanding?.losses ?? 0
  const totalGF = currentStanding?.goals_for ?? 0
  const totalGA = currentStanding?.goals_against ?? 0
  const totalGD = totalGF - totalGA
  const totalPoints = currentStanding?.points ?? 0
  const totalCleanSheets = currentStanding?.clean_sheets ?? 0

  // Biggest win — from current season only
  const biggestWin = currentStanding?.biggest_win_score ? currentStanding : null

  // Form from most active standing
  const primaryStanding =
    activeStandings[0] ?? (standings && standings.length > 0 ? standings[0] : null)
  const currentForm = (primaryStanding?.form ?? '').slice(-6)
  const unbeatenRun = primaryStanding?.unbeaten_run ?? 0

  // Manager tenure history
  const { data: tenures } = await supabase
    .from('manager_tenures' as any)
    .select('id, manager_id, manager_username, started_at, ended_at, wins, draws, losses, goals_for, goals_against')
    .eq('team_id', id)
    .order('started_at', { ascending: false }) as any

  // H2H records vs all opponents
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select(
      `id, home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name),
      away_team:teams!fixtures_away_team_id_fkey(id, name),
      result:results(*)`
    )
    .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
    .not('status', 'eq', 'scheduled')

  // Build H2H map keyed by opponent id
  const h2hMap: Record<
    string,
    { name: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number }
  > = {}

  for (const f of allFixtures ?? []) {
    const r = (f as any).result
    if (!r) continue
    const isHome = f.home_team_id === id
    const opponentId = isHome ? f.away_team_id : f.home_team_id
    const opponentName = isHome
      ? (f as any).away_team?.name ?? 'Unknown'
      : (f as any).home_team?.name ?? 'Unknown'
    const myScore = isHome ? r.home_score : r.away_score
    const theirScore = isHome ? r.away_score : r.home_score

    if (!h2hMap[opponentId]) {
      h2hMap[opponentId] = { name: opponentName, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
    }
    h2hMap[opponentId].played++
    h2hMap[opponentId].gf += myScore
    h2hMap[opponentId].ga += theirScore
    if (myScore > theirScore) h2hMap[opponentId].wins++
    else if (myScore === theirScore) h2hMap[opponentId].draws++
    else h2hMap[opponentId].losses++
  }

  const h2hEntries = Object.entries(h2hMap).sort(
    (a, b) => b[1].played - a[1].played
  )

  // DNA — last 5 confirmed fixtures with correct home/away attribution
  const dnaProfiles = await (async () => {
    const { data: last5Fixtures } = await supabase
      .from('fixtures')
      .select('id, home_team_id')
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
      .eq('status', 'confirmed')
      .order('scheduled_date', { ascending: false })
      .limit(5)

    if (!last5Fixtures?.length) return []

    const { data: dnaResults } = await supabase
      .from('results')
      .select('id, fixture_id, home_score, away_score')
      .in('fixture_id', last5Fixtures.map((f: any) => f.id))

    if (!dnaResults?.length) return []

    const resultIds = dnaResults.map((r: any) => r.id)
    const { data: dnaStatsList } = await supabase
      .from('match_stats')
      .select('*')
      .in('result_id', resultIds)

    const resultMap: Record<string, { fixture_id: string; home_score: number; away_score: number }> = {}
    for (const r of dnaResults) resultMap[r.id] = r

    const dnaGames = (dnaStatsList ?? []).flatMap((ms: any) => {
      const result = resultMap[ms.result_id]
      if (!result) return []
      const fixture = last5Fixtures.find((f: any) => f.id === result.fixture_id)
      if (!fixture) return []
      const isHomeTeam = (fixture as any).home_team_id === id
      return [{
        stats: ms,
        isHome: isHomeTeam,
        goalsAgainst: isHomeTeam ? result.away_score : result.home_score,
      }]
    })

    return dnaGames.length >= 1 ? getTeamDNA(buildTeamStatsMixed(dnaGames)) : []
  })()

  const dnaCombination = getTeamCombination(dnaProfiles)

  // Upcoming fixtures for this club
  const { data: upcomingFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, scheduled_date, matchday, round_type, status,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments(name, type)
    `)
    .or(teamOrFilter)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .order('scheduled_date', { ascending: true })
    .limit(5)

  // Recent results for this club (displayed on page)
  const { data: clubRecentResults } = await supabase
    .from('fixtures')
    .select(`
      id, scheduled_date, matchday, round_type, home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments(name, type),
      result:results(home_score, away_score, override_reason, created_at)
    `)
    .or(teamOrFilter)
    .eq('status', 'confirmed')
    .order('scheduled_date', { ascending: false })
    .limit(6)

  // Sort by date AND then result creation as a tie-breaker for same-day matches
  const sortedRecentResults = [...(clubRecentResults ?? [])].sort((a: any, b: any) => {
    const dateA = new Date(a.scheduled_date || 0).getTime()
    const dateB = new Date(b.scheduled_date || 0).getTime()
    if (dateB !== dateA) return dateB - dateA
    
    const resA = new Date(a.result?.created_at || 0).getTime()
    const resB = new Date(b.result?.created_at || 0).getTime()
    return resB - resA
  })

  return (
    <div className="space-y-space-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-24 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
        </div>
        <div className="px-space-6 pb-space-6 -mt-12 relative">
          <div className="flex items-end gap-space-5">
            <div className={`rounded-2xl overflow-hidden border-4 shadow-md ${
              team.logo_team_slug === 'tottenham'
                ? 'border-accent-hover bg-bg-surface p-1.5'
                : 'border-border bg-bg-base'
            }`}>
              <Image
                src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'match_detail_hero')}
                alt={team.name}
                width={96}
                height={96}
                className="object-contain w-24 h-24"
              />
            </div>
            <div className="pb-1 flex-1">
              <h1 className="text-2xl font-black text-text-primary">{team.name}</h1>
              <div className="flex items-center gap-space-3 flex-wrap mt-0.5">
                <p className="text-text-muted text-sm">
                  Manager:{' '}
                  {manager ? (
                    <Link href={`/managers/${manager.id}`} className="text-accent font-semibold hover:underline">
                      @{manager.username}
                    </Link>
                  ) : (
                    <span className="text-accent font-semibold">(NO MANAGER)</span>
                  )}
                </p>
                {/* Message button — shown to logged-in users who aren't the manager */}
                {manager && currentUser && currentUser.id !== manager.id && (
                  <MessageManagerButton
                    managerId={manager.id}
                    managerUsername={manager.username}
                  />
                )}
              </div>
            </div>
          </div>

          {/* DNA Badges */}
          {dnaProfiles.length > 0 && (
            <div className="mt-space-4">
              {dnaCombination ? (
                <CombinationBadge
                  combination={dnaCombination}
                  profiles={dnaProfiles}
                  isOwnTeam={isCurrentManager}
                />
              ) : (
                <div className="flex flex-wrap gap-space-1.5">
                  {dnaProfiles.map((dna) => (
                    <DNABadge
                      key={dna.label}
                      label={dna.label}
                      emoji={dna.emoji}
                      color={dna.color}
                      level={dna.level}
                      isOwnTeam={isCurrentManager}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Admin Manager Controls ───────────────────────────────────────── */}
      {isAdmin && (
        <TeamManagerAdmin
          teamId={id}
          currentManagerId={team.manager_id ?? null}
          currentManagerUsername={manager?.username ?? null}
          currentManagerAvatar={manager?.avatar_url ?? null}
          allProfiles={allProfiles}
          managedTeamByUser={managedTeamByUser}
        />
      )}

      {/* ── Apply to Manage ──────────────────────────────────────────────── */}
      {currentUser && !isAdmin && !isCurrentManager && (
        <Card className="p-space-5 space-y-space-2">
          <h2 className="section-header mb-1">
            <span className="text-accent">🏟️</span> Management Application
          </h2>
          <p className="text-sm text-text-secondary">
            {(team as any).manager_id
              ? 'This club currently has a manager. You can still apply — if approved, the current manager will be replaced.'
              : 'This club has no manager. Apply to take charge.'}
          </p>
          <ApplyManagerButton
            teamId={id}
            teamName={team.name}
            hasPending={hasPendingApplication}
          />
        </Card>
      )}

      {/* ── Upcoming Fixtures ────────────────────────────────────────────── */}
      <Card className="p-space-5">
        <div className="flex items-center justify-between mb-space-4">
          <h2 className="section-header mb-0">
            <span className="text-accent">📅</span> Upcoming Fixtures
          </h2>
          <Link href={`/teams/${id}/fixtures`} className="text-xs text-accent hover:text-accent-hover transition-colors">
            All fixtures →
          </Link>
        </div>
        {!upcomingFixtures?.length ? (
          <p className="text-text-muted text-sm text-center py-space-4">No upcoming fixtures scheduled.</p>
        ) : (
          <div className="divide-y divide-border">
            {(upcomingFixtures as any[]).map((f) => {
              const isHome = allTeamIds.includes(f.home_team?.id)
              const opponent = isHome ? f.away_team : f.home_team
              const dateStr = f.scheduled_date
                ? format(parseISO(f.scheduled_date), 'EEE d MMM')
                : 'TBD'
              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="flex items-center gap-space-3 py-space-3 hover:bg-bg-base/50 -mx-space-5 px-space-5 transition-colors"
                >
                  {/* Opponent logo */}
                  {opponent?.logo_league_folder ? (
                    <TeamLogo
                      leagueFolder={opponent.logo_league_folder}
                      teamSlug={opponent.logo_team_slug}
                      context="standings_row"
                      alt={opponent.name}
                      className="w-8 h-8 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-bg-base flex items-center justify-center text-xs text-text-muted shrink-0">?</div>
                  )}

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'TBD'}
                    </p>
                    <p className="text-xs text-text-muted truncate">{f.tournament?.name}</p>
                  </div>

                  {/* Date + status */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-text-primary">{dateStr}</p>
                    {f.status === 'awaiting_confirmation' && (
                      <span className="text-[10px] text-feedback-warning font-semibold">Pending</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Recent Results ────────────────────────────────────────────────── */}
      <Card className="p-space-5">
        <div className="flex items-center justify-between mb-space-4">
          <h2 className="section-header mb-0">
            <span className="text-accent">🏁</span> Recent Results
          </h2>
          <Link href={`/teams/${id}/fixtures`} className="text-xs text-accent hover:text-accent-hover transition-colors">
            All results →
          </Link>
        </div>

        {!sortedRecentResults?.length ? (
          <p className="text-text-muted text-sm text-center py-space-4">No results yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {sortedRecentResults.map((f: any) => {
              const result = Array.isArray(f.result) ? f.result[0] : f.result
              if (!result) return null
              const isHome = allTeamIds.includes(f.home_team_id)
              const myScore = isHome ? result.home_score : result.away_score
              const theirScore = isHome ? result.away_score : result.home_score
              const opponent = isHome ? f.away_team : f.home_team
              const won = myScore > theirScore
              const drew = myScore === theirScore
              const outcomeColor = won ? 'text-feedback-success' : drew ? 'text-feedback-warning' : 'text-feedback-error'
              const outcomeLetter = won ? 'W' : drew ? 'D' : 'L'
              const dateStr = f.scheduled_date
                ? format(parseISO(f.scheduled_date), 'EEE d MMM')
                : '—'
              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="flex items-center gap-space-3 py-space-3 hover:bg-bg-base/50 -mx-space-5 px-space-5 transition-colors"
                >
                  {/* Outcome badge */}
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                    won ? 'bg-feedback-success/20 text-feedback-success' : drew ? 'bg-feedback-warning/20 text-feedback-warning' : 'bg-feedback-error/20 text-feedback-error'
                  }`}>
                    {outcomeLetter}
                  </span>

                  {/* Opponent logo */}
                  {opponent?.logo_league_folder ? (
                    <TeamLogo
                      leagueFolder={opponent.logo_league_folder}
                      teamSlug={opponent.logo_team_slug}
                      context="standings_row"
                      alt={opponent.name}
                      className="w-7 h-7 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-bg-base flex items-center justify-center text-xs text-text-muted shrink-0">?</div>
                  )}

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-text-muted truncate">{f.tournament?.name}</p>
                  </div>

                  {/* Score + date */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black tabular-nums ${outcomeColor}`}>
                      {myScore}–{theirScore}
                    </p>
                    <p className="text-[10px] text-text-muted">{dateStr}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Season Stats ─────────────────────────────────────────────────── */}
      <Card className="p-space-5">
        <h2 className="section-header">
          <span className="text-accent">📊</span> Season Statistics
          {currentStanding?.tournament?.name && (
            <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">
              {currentStanding.tournament.name}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-4 gap-space-3 sm:grid-cols-8">
          {[
            { label: 'P', value: totalPlayed },
            { label: 'W', value: totalWins },
            { label: 'D', value: totalDraws },
            { label: 'L', value: totalLosses },
            { label: 'GF', value: totalGF },
            { label: 'GA', value: totalGA },
            { label: 'GD', value: totalGD >= 0 ? `+${totalGD}` : totalGD },
            { label: 'PTS', value: totalPoints },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-space-3 rounded-lg bg-border-subtle/30">
              <p className="text-xl font-black text-text-primary">{value}</p>
              <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-space-4 flex flex-wrap gap-space-4 text-sm">
          <div className="flex items-center gap-space-2">
            <span className="text-text-muted">Clean Sheets:</span>
            <span className="font-bold text-text-primary">{totalCleanSheets}</span>
          </div>
          {biggestWin?.biggest_win_score && (
            <div className="flex items-center gap-space-2">
              <span className="text-text-muted">Biggest Win:</span>
              <span className="font-bold text-feedback-success">{biggestWin.biggest_win_score}</span>
            </div>
          )}
          {unbeatenRun > 0 && (
            <div className="flex items-center gap-space-2">
              <span className="inline-flex items-center gap-space-1 bg-accent-muted border border-accent/30 text-accent text-xs font-bold px-space-2 py-0.5 rounded-full">
                🔥 {unbeatenRun}-game unbeaten run
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      {currentForm && (
        <Card className="p-space-5">
          <h2 className="section-header">
            <span className="text-accent">📈</span> Recent Form
          </h2>
          <div className="flex items-center gap-space-4">
            <span className="text-sm text-text-muted">Last 6</span>
            <FormStrip form={currentForm} />
          </div>
        </Card>
      )}

      {/* ── Trophy Cabinet ───────────────────────────────────────────────── */}
      <Card className="p-space-5">
        <h2 className="section-header">
          <span className="text-accent">🏆</span> Trophy Cabinet
        </h2>
        {(trophies ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">No trophies yet. Glory awaits.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-3">
            {(trophies ?? []).map((trophy: any) => (
              <div
                key={trophy.id}
                className="flex items-center gap-space-3 p-space-3 rounded-lg border border-accent/20 bg-accent-muted/10"
              >
                <span className="text-3xl">{TROPHY_ICON[trophy.trophy_type] ?? '🏆'}</span>
                <div>
                  <p className="text-sm font-bold text-accent">
                    {TROPHY_LABEL[trophy.trophy_type] ?? trophy.trophy_type}
                  </p>
                  <p className="text-xs text-text-muted">
                    {trophy.season?.name ?? 'Unknown Season'} · {trophy.tournament?.name ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Season History (one card per tournament) ─────────────────────── */}
      {(standings ?? []).length > 0 && (
        <Card className="p-space-5">
          <h2 className="section-header">
            <span className="text-accent">📋</span> Season History
          </h2>
          <div className="space-y-space-3">
            {[...(standings as any[])]
              .sort((a, b) => {
                // Active season first
                if (a.tournament?.status === 'active' && b.tournament?.status !== 'active') return -1
                if (b.tournament?.status === 'active' && a.tournament?.status !== 'active') return 1
                return 0
              })
              .map((s: any) => (
                <div key={s.id} className="p-space-3 rounded-lg bg-border-subtle/30">
                  <div className="flex items-center justify-between mb-space-2">
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">
                      {s.tournament?.name ?? 'Tournament'}
                    </p>
                    <span className={`text-[10px] font-bold px-space-2 py-0.5 rounded-full ${
                      s.tournament?.status === 'active'
                        ? 'bg-feedback-success/20 text-feedback-success'
                        : 'bg-text-muted/20 text-text-muted'
                    }`}>
                      {s.tournament?.status === 'active' ? 'Current' : 'Completed'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-space-2 text-center text-xs">
                    {[
                      { label: 'P', val: s.played },
                      { label: 'W', val: s.wins },
                      { label: 'D', val: s.draws },
                      { label: 'L', val: s.losses },
                      { label: 'GF', val: s.goals_for },
                      { label: 'GA', val: s.goals_against },
                      { label: 'PTS', val: s.points },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="font-bold text-text-primary">{val}</p>
                        <p className="text-text-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ── Manager History ──────────────────────────────────────────────── */}
      {(tenures ?? []).length > 0 && (
        <Card className="p-space-5">
          <h2 className="section-header">
            <span className="text-accent">👔</span> Manager History
          </h2>
          <div className="space-y-space-3">
            {(tenures as any[]).map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              return (
                <div
                  key={tenure.id}
                  className={`rounded-xl border p-space-4 ${
                    isCurrent
                      ? 'border-accent/30 bg-accent-muted/20'
                      : 'border-border bg-bg-base/20'
                  }`}
                >
                  <div className="flex items-center gap-space-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      isCurrent ? 'bg-accent-muted text-accent' : 'bg-border text-text-muted'
                    }`}>
                      {(tenure.manager_username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-space-2 flex-wrap">
                        <p className="font-bold text-text-primary">@{tenure.manager_username}</p>
                        {isCurrent && (
                          <span className="text-xs bg-accent-muted text-accent border border-accent/30 px-1.5 py-0.5 rounded-full font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(tenure.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {tenure.ended_at
                          ? ` → ${new Date(tenure.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ' → Present'}
                      </p>
                    </div>
                    <div className="flex gap-space-4 shrink-0 text-center">
                      <div>
                        <p className="text-base font-black text-feedback-success">{tenure.wins}</p>
                        <p className="text-[10px] text-text-muted font-medium">W</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-feedback-warning">{tenure.draws}</p>
                        <p className="text-[10px] text-text-muted font-medium">D</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-feedback-error">{tenure.losses}</p>
                        <p className="text-[10px] text-text-muted font-medium">L</p>
                      </div>
                      {played > 0 && (
                        <div>
                          <p className="text-base font-black text-text-secondary">{played}</p>
                          <p className="text-[10px] text-text-muted font-medium">P</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── H2H vs All ───────────────────────────────────────────────────── */}
      <details className="card p-space-5 group border rounded-lg bg-bg-surface border-border">
        <summary className="section-header cursor-pointer list-none flex items-center justify-between">
          <span className="flex items-center gap-space-2">
            <span className="text-accent">⚔️</span> Head-to-Head Record
          </span>
          <span className="text-text-muted text-xs group-open:hidden">
            {h2hEntries.length} opponent{h2hEntries.length !== 1 ? 's' : ''} · Tap to expand
          </span>
          <span className="text-text-muted text-xs hidden group-open:inline">Collapse</span>
        </summary>

        {h2hEntries.length === 0 ? (
          <p className="mt-space-4 text-text-muted text-sm">No completed matches on record.</p>
        ) : (
          <div className="mt-space-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-space-2 pr-space-3">Opponent</th>
                  <th className="pb-space-2 text-center pr-space-2">P</th>
                  <th className="pb-space-2 text-center pr-space-2">W</th>
                  <th className="pb-space-2 text-center pr-space-2">D</th>
                  <th className="pb-space-2 text-center pr-space-2">L</th>
                  <th className="pb-space-2 text-center">GF–GA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {h2hEntries.map(([oppId, rec]) => (
                  <tr key={oppId} className="text-text-secondary hover:bg-bg-base transition-colors">
                    <td className="py-space-2 pr-space-3 font-medium">
                      <Link
                        href={`/teams/${oppId}`}
                        className="hover:text-accent transition-colors"
                      >
                        {rec.name}
                      </Link>
                    </td>
                    <td className="py-space-2 text-center">{rec.played}</td>
                    <td className="py-space-2 text-center text-feedback-success font-semibold">{rec.wins}</td>
                    <td className="py-space-2 text-center text-feedback-warning font-semibold">{rec.draws}</td>
                    <td className="py-space-2 text-center text-feedback-error font-semibold">{rec.losses}</td>
                    <td className="py-space-2 text-center text-text-muted">
                      {rec.gf}–{rec.ga}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  )
}
