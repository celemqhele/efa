import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import { getTeamDNA, buildTeamStatsMixed } from '@/lib/dna-engine'
import TeamManagerAdmin from './TeamManagerAdmin'
import ApplyManagerButton from '@/components/ui/ApplyManagerButton'
import MessageManagerButton from '@/components/ui/MessageManagerButton'
import { format, parseISO } from 'date-fns'

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
      result:results(home_score, away_score, override_reason)
    `)
    .or(teamOrFilter)
    .eq('status', 'confirmed')
    .order('scheduled_date', { ascending: false })
    .limit(6)

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-slate-50 via-[#c9a84c]/10 to-white h-24 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
        </div>
        <div className="px-6 pb-6 -mt-12 relative">
          <div className="flex items-end gap-5">
            <div className={`rounded-2xl overflow-hidden border-4 shadow-xl ${
              team.logo_team_slug === 'tottenham'
                ? 'border-[#132257] bg-[#ffffff] p-1.5'
                : 'border-navy-card bg-navy'
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
              <h1 className="text-2xl font-black text-slate-900">{team.name}</h1>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                <p className="text-slate-400 text-sm">
                  Manager:{' '}
                  <span className="text-gold font-semibold">
                    {manager ? `@${manager.username}` : '(NO MANAGER)'}
                  </span>
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
            <div className="mt-4 flex flex-wrap gap-1.5">
              {dnaProfiles.map((dna) => (
                <span
                  key={dna.label}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${dna.color}`}
                >
                  {dna.emoji} {dna.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

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
        <div className="card p-5 space-y-2">
          <h2 className="section-header mb-1">
            <span className="text-[#c9a84c]">🏟️</span> Management Application
          </h2>
          <p className="text-sm text-slate-500">
            {(team as any).manager_id
              ? 'This club currently has a manager. You can still apply — if approved, the current manager will be replaced.'
              : 'This club has no manager. Apply to take charge.'}
          </p>
          <ApplyManagerButton
            teamId={id}
            teamName={team.name}
            hasPending={hasPendingApplication}
          />
        </div>
      )}

      {/* ── Upcoming Fixtures ────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header mb-0">
            <span className="text-gold">📅</span> Upcoming Fixtures
          </h2>
          <Link href="/fixtures" className="text-xs text-gold hover:text-gold-light transition-colors">
            All fixtures →
          </Link>
        </div>
        {!upcomingFixtures?.length ? (
          <p className="text-slate-500 text-sm text-center py-4">No upcoming fixtures scheduled.</p>
        ) : (
          <div className="divide-y divide-navy-border">
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
                  className="flex items-center gap-3 py-3 hover:bg-navy-light/50 -mx-5 px-5 transition-colors"
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
                    <div className="w-8 h-8 rounded bg-navy-border flex items-center justify-center text-xs text-slate-500 shrink-0">?</div>
                  )}

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      <span className="text-slate-500 font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'TBD'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{f.tournament?.name}</p>
                  </div>

                  {/* Date + status */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-slate-900">{dateStr}</p>
                    {f.status === 'awaiting_confirmation' && (
                      <span className="text-[10px] text-yellow-400 font-semibold">Pending</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Recent Results ────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header mb-0">
            <span className="text-gold">🏁</span> Recent Results
          </h2>
          <Link href="/results" className="text-xs text-gold hover:text-gold-light transition-colors">
            All results →
          </Link>
        </div>
        {!clubRecentResults?.length ? (
          <p className="text-slate-500 text-sm text-center py-4">No results yet.</p>
        ) : (
          <div className="divide-y divide-navy-border">
            {(clubRecentResults as any[]).map((f) => {
              const result = Array.isArray(f.result) ? f.result[0] : f.result
              if (!result) return null
              const isHome = allTeamIds.includes(f.home_team_id)
              const myScore = isHome ? result.home_score : result.away_score
              const theirScore = isHome ? result.away_score : result.home_score
              const opponent = isHome ? f.away_team : f.home_team
              const won = myScore > theirScore
              const drew = myScore === theirScore
              const outcomeColor = won ? 'text-green-400' : drew ? 'text-yellow-400' : 'text-red-400'
              const outcomeLetter = won ? 'W' : drew ? 'D' : 'L'
              const dateStr = f.scheduled_date
                ? format(parseISO(f.scheduled_date), 'EEE d MMM')
                : '—'
              return (
                <Link
                  key={f.id}
                  href={`/results/${f.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-navy-light/50 -mx-5 px-5 transition-colors"
                >
                  {/* Outcome badge */}
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0 ${
                    won ? 'bg-green-500/20 text-green-400' : drew ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
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
                    <div className="w-7 h-7 rounded bg-navy-border flex items-center justify-center text-xs text-slate-500 shrink-0">?</div>
                  )}

                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      <span className="text-slate-500 font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{f.tournament?.name}</p>
                  </div>

                  {/* Score + date */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black tabular-nums ${outcomeColor}`}>
                      {myScore}–{theirScore}
                    </p>
                    <p className="text-[10px] text-slate-500">{dateStr}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Season Stats ─────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-header">
          <span className="text-gold">📊</span> Season Statistics
          {currentStanding?.tournament?.name && (
            <span className="ml-2 text-xs font-normal text-slate-400 normal-case tracking-normal">
              {currentStanding.tournament.name}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
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
            <div key={label} className="text-center p-3 rounded-lg bg-navy-border/30">
              <p className="text-xl font-black text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Clean Sheets:</span>
            <span className="font-bold text-slate-900">{totalCleanSheets}</span>
          </div>
          {biggestWin?.biggest_win_score && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Biggest Win:</span>
              <span className="font-bold text-green-400">{biggestWin.biggest_win_score}</span>
            </div>
          )}
          {unbeatenRun > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-gold/20 border border-gold/30 text-gold text-xs font-bold px-2 py-0.5 rounded-full">
                🔥 {unbeatenRun}-game unbeaten run
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      {currentForm && (
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-gold">📈</span> Recent Form
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Last 6</span>
            <FormStrip form={currentForm} />
          </div>
        </div>
      )}

      {/* ── Trophy Cabinet ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-header">
          <span className="text-gold">🏆</span> Trophy Cabinet
        </h2>
        {(trophies ?? []).length === 0 ? (
          <p className="text-slate-500 text-sm">No trophies yet. Glory awaits.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(trophies ?? []).map((trophy: any) => (
              <div
                key={trophy.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gold/20 bg-gold/5"
              >
                <span className="text-3xl">{TROPHY_ICON[trophy.trophy_type] ?? '🏆'}</span>
                <div>
                  <p className="text-sm font-bold text-gold">
                    {TROPHY_LABEL[trophy.trophy_type] ?? trophy.trophy_type}
                  </p>
                  <p className="text-xs text-slate-400">
                    {trophy.season?.name ?? 'Unknown Season'} · {trophy.tournament?.name ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Season History (one card per tournament) ─────────────────────── */}
      {(standings ?? []).length > 0 && (
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-gold">📋</span> Season History
          </h2>
          <div className="space-y-3">
            {[...(standings as any[])]
              .sort((a, b) => {
                // Active season first
                if (a.tournament?.status === 'active' && b.tournament?.status !== 'active') return -1
                if (b.tournament?.status === 'active' && a.tournament?.status !== 'active') return 1
                return 0
              })
              .map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg bg-navy-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gold uppercase tracking-wider">
                      {s.tournament?.name ?? 'Tournament'}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.tournament?.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {s.tournament?.status === 'active' ? 'Current' : 'Completed'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-xs">
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
                        <p className="font-bold text-slate-900">{val}</p>
                        <p className="text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Manager History ──────────────────────────────────────────────── */}
      {(tenures ?? []).length > 0 && (
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-gold">👔</span> Manager History
          </h2>
          <div className="space-y-3">
            {(tenures as any[]).map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              return (
                <div
                  key={tenure.id}
                  className={`rounded-xl border p-4 ${
                    isCurrent
                      ? 'border-[#c9a84c]/30 bg-[#c9a84c]/5'
                      : 'border-navy-border bg-navy-light/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      isCurrent ? 'bg-[#c9a84c]/20 text-[#c9a84c]' : 'bg-navy-border text-slate-400'
                    }`}>
                      {(tenure.manager_username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900">@{tenure.manager_username}</p>
                        {isCurrent && (
                          <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30 px-1.5 py-0.5 rounded-full font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(tenure.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {tenure.ended_at
                          ? ` → ${new Date(tenure.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ' → Present'}
                      </p>
                    </div>
                    <div className="flex gap-4 shrink-0 text-center">
                      <div>
                        <p className="text-base font-black text-green-400">{tenure.wins}</p>
                        <p className="text-[10px] text-slate-500 font-medium">W</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-yellow-400">{tenure.draws}</p>
                        <p className="text-[10px] text-slate-500 font-medium">D</p>
                      </div>
                      <div>
                        <p className="text-base font-black text-red-400">{tenure.losses}</p>
                        <p className="text-[10px] text-slate-500 font-medium">L</p>
                      </div>
                      {played > 0 && (
                        <div>
                          <p className="text-base font-black text-slate-700">{played}</p>
                          <p className="text-[10px] text-slate-500 font-medium">P</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── H2H vs All ───────────────────────────────────────────────────── */}
      <details className="card p-5 group">
        <summary className="section-header cursor-pointer list-none flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-gold">⚔️</span> Head-to-Head Record
          </span>
          <span className="text-slate-500 text-xs group-open:hidden">
            {h2hEntries.length} opponent{h2hEntries.length !== 1 ? 's' : ''} · Tap to expand
          </span>
          <span className="text-slate-500 text-xs hidden group-open:inline">Collapse</span>
        </summary>

        {h2hEntries.length === 0 ? (
          <p className="mt-4 text-slate-500 text-sm">No completed matches on record.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-navy-border">
                  <th className="pb-2 pr-3">Opponent</th>
                  <th className="pb-2 text-center pr-2">P</th>
                  <th className="pb-2 text-center pr-2">W</th>
                  <th className="pb-2 text-center pr-2">D</th>
                  <th className="pb-2 text-center pr-2">L</th>
                  <th className="pb-2 text-center">GF–GA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border/40">
                {h2hEntries.map(([oppId, rec]) => (
                  <tr key={oppId} className="text-slate-700 hover:bg-navy-border/20 transition-colors">
                    <td className="py-2 pr-3 font-medium">
                      <Link
                        href={`/teams/${oppId}`}
                        className="hover:text-gold transition-colors"
                      >
                        {rec.name}
                      </Link>
                    </td>
                    <td className="py-2 text-center">{rec.played}</td>
                    <td className="py-2 text-center text-green-400 font-semibold">{rec.wins}</td>
                    <td className="py-2 text-center text-yellow-400 font-semibold">{rec.draws}</td>
                    <td className="py-2 text-center text-red-400 font-semibold">{rec.losses}</td>
                    <td className="py-2 text-center text-slate-400">
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
