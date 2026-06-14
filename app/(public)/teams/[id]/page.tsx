import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TeamProfileSkeleton } from '@/components/ui/Skeleton'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import { getTeamDNAFromDB, buildTeamStatsMixed, LEVEL_LABELS } from '@/lib/dna-engine'
import type { DNAProfile, PersonalizedDescription } from '@/lib/dna-engine'
import { detectTeamStates } from '@/lib/team-states'
import type { TeamState } from '@/lib/team-states'
import TeamStateBadges from '@/components/ui/TeamStateBadge'
import { generateManagerNotes } from '@/lib/manager-notes'
import type { ManagerNote } from '@/lib/manager-notes'
import TeamManagerAdmin from './TeamManagerAdmin'
import ApplyManagerButton from '@/components/ui/ApplyManagerButton'
import MessageManagerButton from '@/components/ui/MessageManagerButton'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Trophy, Star, Globe, Medal, Crown, Drama, Zap, Brain, Sword, Shield, Dumbbell, ArrowLeftRight, Triangle, Crosshair, Scale } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const TROPHY_ICON: Record<string, string> = {
  league: 'trophy',
  ucl: 'star',
  europa: 'globe',
  super_cup: 'medal',
}

const TROPHY_LABEL: Record<string, string> = {
  league: 'League Champion',
  ucl: 'UCL Winner',
  europa: 'Europa Winner',
  super_cup: 'Super Cup',
}

const DNA_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="w-4 h-4" />,
  theater: <Drama className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  brain: <Brain className="w-4 h-4" />,
  dagger: <Sword className="w-4 h-4" />,
  shield: <Shield className="w-4 h-4" />,
  muscle: <Dumbbell className="w-4 h-4" />,
  arrows_horizontal: <ArrowLeftRight className="w-4 h-4" />,
  triangle: <Triangle className="w-4 h-4" />,
  target: <Crosshair className="w-4 h-4" />,
  scale: <Scale className="w-4 h-4" />,
}

function levelColor(level: string): string {
  if (level.startsWith('+++')) return 'text-green-500'
  if (level.startsWith('++'))  return 'text-accent'
  if (level === '+')           return 'text-accent'
  return 'text-text-muted'
}

function perspectivize(text: string): string {
  return text
    .replace(/\bYour\b/g, 'Their')
    .replace(/\byour\b/g, 'their')
    .replace(/\bYou're\b/g, "They're")
    .replace(/\byou're\b/g, "they're")
    .replace(/\bYou've\b/g, "They've")
    .replace(/\byou've\b/g, "they've")
    .replace(/\bYou'll\b/g, "They'll")
    .replace(/\byou'll\b/g, "they'll")
    .replace(/\bYou\b/g, 'They')
    .replace(/\byou\b/g, 'they')
}

async function TeamProfileContent({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // Team with manager
  const { data: _team } = await supabase
    .from('teams')
    .select('*, manager:profiles!teams_manager_id_fkey(*)')
    .eq('id', id)
    .single() as any
  const team = _team as any

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
    const { data: _currentProfile } = await supabase
      .from('profiles').select('role').eq('id', currentUser.id).single() as any
    const currentProfile = _currentProfile as any
    isAdmin = currentProfile?.role === 'admin'
    isCurrentManager = (team as any).manager_id === currentUser.id

    if (isAdmin) {
      const [{ data: _profiles }, { data: _allTeams }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').order('username'),
        supabase.from('teams').select('name, manager_id').not('manager_id', 'is', null) as any,
      ])
      allProfiles = (_profiles ?? []) as any[]
      for (const t of (_allTeams ?? []) as any[]) {
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
  const { data: _standings } = await supabase
    .from('standings')
    .select('*, tournament:tournaments(*)')
    .in('team_id', siblingIds)
  const standings = (_standings ?? []) as any[]

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
  const { data: _allFixtures } = await supabase
    .from('fixtures')
    .select(
      `id, home_team_id, away_team_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name),
      away_team:teams!fixtures_away_team_id_fkey(id, name),
      result:results(*)`
    )
    .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
    .not('status', 'eq', 'scheduled')
  const allFixtures = (_allFixtures ?? []) as any[]

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

  // ── Manager-scoped DNA + Team States + Manager Notes ──────────────────────
  const managerId = (manager as any)?.id

  let dnaProfiles: DNAProfile[] = []
  let dnaDescription: PersonalizedDescription | null = null
  let teamStates: TeamState[] = []
  let managerNotes: ManagerNote[] = []

  // DNA playstyle data lives in team_dna table — fetch for every team regardless of manager
  {
    const { profiles, descriptionMap } = await getTeamDNAFromDB(supabase as any, team.id)
    dnaProfiles = profiles
    dnaDescription = profiles.length > 0 ? descriptionMap[profiles[0].label] ?? null : null
  }

  if (managerId) {
    const { data: tenures } = await supabase
      .from('manager_tenures')
      .select('team_id, started_at, ended_at')
      .eq('manager_id', managerId)

    const managedTeamIds = [...new Set((tenures ?? []).map((t: any) => t.team_id))]

    if (managedTeamIds.length > 0) {
      // Fetch fixtures per tenure with date-range filtering
      const mgrFixtures: any[] = []
      const VALID_STATUSES = ['confirmed', 'abandoned_home', 'abandoned_away', 'abandoned_both']

      for (const tenure of (tenures ?? [])) {
        let query = supabase
          .from('fixtures')
          .select('id, home_team_id, scheduled_date')
          .or(`home_team_id.eq.${tenure.team_id},away_team_id.eq.${tenure.team_id}`)
          .in('status', VALID_STATUSES)
          .gte('scheduled_date', tenure.started_at)
          .order('scheduled_date', { ascending: false })
          .limit(10)

        if (tenure.ended_at) {
          query = query.lte('scheduled_date', tenure.ended_at)
        }

        const { data } = await query
        if (data) mgrFixtures.push(...data)
      }

      // Deduplicate by id and sort, take top 10
      const seen = new Set<string>()
      const uniqueFixtures = mgrFixtures.filter((f: any) => {
        if (seen.has(f.id)) return false
        seen.add(f.id)
        return true
      }).sort(
        (a: any, b: any) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
      ).slice(0, 10)

      const mgrFixtureIds = uniqueFixtures.map((f: any) => f.id)

      if (mgrFixtureIds.length > 0) {
        const { data: _mgrResults } = await supabase
          .from('results')
          .select('id, fixture_id, home_score, away_score, is_abandoned, abandoned_type')
          .in('fixture_id', mgrFixtureIds)
        const mgrResults = (_mgrResults ?? []) as any[]
        const mgrResultIds = mgrResults.map((r: any) => r.id)

        const { data: _mgrStats } = await supabase
          .from('match_stats')
          .select('*')
          .in('result_id', mgrResultIds)
        const mgrStats = (_mgrStats ?? []) as any[]

        const statsByResultId: Record<string, any> = {}
        for (const ms of mgrStats) statsByResultId[ms.result_id] = ms

        const resultByFixtureId: Record<string, any> = {}
        for (const r of mgrResults) resultByFixtureId[r.fixture_id] = r

        const managerGames: Array<{ stats: any; isHome: boolean; goalsAgainst: number; myScore: number; theirScore: number }> = []
        let totalGF = 0, totalGA = 0, cleanSheets = 0

        for (const fixture of uniqueFixtures) {
          const result = resultByFixtureId[fixture.id]
          if (!result) continue
          const isHomeTeam = managedTeamIds.includes(fixture.home_team_id)
          const myScore = isHomeTeam ? result.home_score : result.away_score
          const theirScore = isHomeTeam ? result.away_score : result.home_score

          totalGF += myScore
          totalGA += theirScore
          if (theirScore === 0) cleanSheets++

          const ms = statsByResultId[result.id]

          managerGames.push({
            stats: ms ?? {},
            isHome: isHomeTeam,
            goalsAgainst: theirScore,
            myScore,
            theirScore,
          })
        }

        if (managerGames.length >= 1) {
          const teamStats = buildTeamStatsMixed(managerGames)

          // Actual consecutive streak (most-recent-first, stop when outcome changes)
          let streakType: 'W' | 'D' | 'L' | null = null
          let streakWins = 0, streakDraws = 0, streakLosses = 0
          for (const game of managerGames) {
            const gResult = game.myScore > game.theirScore ? 'W' : game.myScore === game.theirScore ? 'D' : 'L'
            if (streakType === null) {
              streakType = gResult
            } else if (gResult !== streakType) {
              break
            }
            if (gResult === 'W') streakWins++
            else if (gResult === 'D') streakDraws++
            else streakLosses++
          }

          const n = managerGames.length
          teamStates = detectTeamStates({
            avgGoalsScored: totalGF / n,
            avgGoalsConceded: totalGA / n,
            avgPossession: teamStats.avg_possession,
            avgShots: teamStats.avg_shots,
            avgShotsOnTarget: teamStats.avg_shots_on_target,
            avgFouls: teamStats.avg_fouls,
            avgTackles: teamStats.avg_tackles,
            avgInterceptions: teamStats.avg_interceptions,
            avgPasses: teamStats.avg_passes,
            avgSaves: teamStats.avg_saves,
            avgCrosses: teamStats.avg_crosses,
            avgCorners: teamStats.avg_corners,
            avgFreeKicks: teamStats.avg_free_kicks,
            recentStreak: { wins: streakWins, draws: streakDraws, losses: streakLosses },
            cleanSheets,
            totalGames: n,
          })

          managerNotes = generateManagerNotes({
            avgGoalsScored: totalGF / n,
            avgGoalsConceded: totalGA / n,
            avgPossession: teamStats.avg_possession,
            avgShots: teamStats.avg_shots,
            avgShotsOnTarget: teamStats.avg_shots_on_target,
            avgFouls: teamStats.avg_fouls,
            avgTackles: teamStats.avg_tackles,
            avgInterceptions: teamStats.avg_interceptions,
            avgPasses: teamStats.avg_passes,
            avgSuccessfulPasses: teamStats.avg_successful_passes,
            avgCrosses: teamStats.avg_crosses,
            avgSaves: teamStats.avg_saves,
            avgCorners: teamStats.avg_corners,
            avgFreeKicks: teamStats.avg_free_kicks,
            avgOffsides: teamStats.avg_offsides,
            recentStreak: { wins: streakWins, draws: streakDraws, losses: streakLosses },
            totalGames: n,
          })
        }
      }
    }
  }

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
    <div className="space-y-space-6 pt-space-4">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Card>
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-20 sm:h-28 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
        </div>
        <div className="px-space-4 sm:px-space-6 pb-space-6 -mt-8 sm:-mt-10 relative">
            <div className="flex items-end gap-space-3 sm:gap-space-5">
              <div className="bg-bg-base rounded-lg overflow-hidden">
                <Image
                  src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'match_detail_hero')}
                  alt={team.name}
                  width={96}
                  height={96}
                  className="object-contain w-20 h-20 sm:w-24 sm:h-24"
                />
              </div>
              <div className="pb-1 flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-text-primary truncate">{team.name}</h1>
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

          {/* DNA Playstyle */}
          {dnaProfiles.length > 0 && (
            <div className="mt-space-6 space-y-space-6">
              <h2 className="section-header">Playstyle</h2>

              {/* Single combined profile badge */}
              {(() => {
                const dna = dnaProfiles[0]
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border ${dna.color}`}
                  >
                    {DNA_ICONS[dna.iconName] ?? null}
                    <span>{dna.label}</span>
                    <span className={`font-mono font-bold ml-1 ${levelColor(dna.level)}`}>{dna.level}</span>
                  </span>
                )
              })()}

              {/* Level info */}
              {dnaProfiles.length > 0 && (() => {
                const lvlInfo = LEVEL_LABELS[dnaProfiles[0].level]
                return lvlInfo ? (
                  <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-3">
                    <span className={`font-mono font-bold text-lg ${levelColor(dnaProfiles[0].level)}`}>{dnaProfiles[0].level}</span>
                    <div>
                      <p className="text-text-primary text-sm font-semibold">{lvlInfo.short}</p>
                      <p className="text-text-muted text-xs mt-0.5">{lvlInfo.detail}</p>
                    </div>
                  </div>
                ) : null
              })()}

              {/* About */}
              {dnaDescription?.about && (
                <Card className="p-space-5">
                  <p className="text-text-secondary text-sm leading-relaxed">{dnaDescription.about}</p>
                </Card>
              )}

              {/* What to Expect */}
              {dnaDescription?.tendencies && dnaDescription.tendencies.length > 0 && (
                <Card className="p-space-5 space-y-space-3">
                  <h3 className="font-semibold text-text-primary text-sm">
                    {isCurrentManager ? 'Your Tendencies' : 'What to Expect'}
                  </h3>
                  <ul className="space-y-1.5">
                    {dnaDescription.tendencies.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className={`${isCurrentManager ? 'text-green-500' : 'text-blue-400'} shrink-0 mt-0.5`}>
                          {isCurrentManager ? '✓' : '›'}
                        </span>
                        {isCurrentManager ? t : perspectivize(t)}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Weaknesses */}
              {dnaDescription?.weaknesses && dnaDescription.weaknesses.length > 0 && (
                <Card className="p-space-5 space-y-space-3">
                  <h3 className={`font-semibold text-sm ${isCurrentManager ? 'text-red-400' : 'text-red-400'}`}>
                    {isCurrentManager ? 'Vulnerabilities to Watch' : 'How to Exploit Their Weaknesses'}
                  </h3>
                  <ul className="space-y-1.5">
                    {dnaDescription.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-red-400 shrink-0 mt-0.5">{isCurrentManager ? '⚠' : '⚡'}</span>
                        {isCurrentManager ? w : perspectivize(w)}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Form States */}
              {teamStates.length > 0 && (
                <div className="space-y-space-3">
                  <h3 className="text-text-primary font-semibold text-sm">Form Indicators</h3>
                  <TeamStateBadges states={teamStates} />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Manager Observations Card */}
      {managerNotes.length > 0 && (
        <Card className="p-space-5">
          <h2 className="section-header mb-space-3">
            <span className="text-accent">📋</span> Manager Observations
          </h2>
          <div className="space-y-space-2">
            {managerNotes.map((note, i) => {
              const dotColor = note.type === 'positive' ? 'bg-feedback-success'
                : note.type === 'negative' ? 'bg-feedback-error'
                : 'bg-text-muted'
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                  <p className="text-text-secondary">{note.text}</p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

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
                  className="flex items-center gap-space-3 py-space-3 sm:py-space-3 min-h-[52px] sm:min-h-0 hover:bg-bg-base/50 -mx-space-5 px-space-5 transition-colors"
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
              const isHome = siblingIds.includes(f.home_team_id)
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
                  className="flex items-center gap-space-3 py-space-3 sm:py-space-3 min-h-[52px] sm:min-h-0 hover:bg-bg-base/50 -mx-space-5 px-space-5 transition-colors"
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
                    <p className={`text-base sm:text-sm font-black tabular-nums ${outcomeColor}`}>
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

        {/* Mobile: horizontal snap scroll */}
        <div className="sm:hidden -mx-space-5 overflow-x-auto snap-x snap-mandatory scrollbar-none">
          <div className="flex gap-space-3 px-space-5 w-max">
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
              <div key={label} className="snap-start shrink-0 w-[90px] text-center p-space-3 rounded-lg bg-border-subtle/30">
                <p className="text-xl font-black text-text-primary">{value}</p>
                <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: static grid */}
        <div className="hidden sm:grid grid-cols-8 gap-space-3">
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
                {(() => {
                  const iconName = TROPHY_ICON[trophy.trophy_type] ?? 'trophy'
                  const Icon = iconName === 'trophy' ? Trophy : iconName === 'star' ? Star : iconName === 'globe' ? Globe : Medal
                  return <Icon className="w-8 h-8 text-accent" />
                })()}
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
      <Card className="p-space-5 group">
        <details>
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
      </Card>
    </div>
  )
}

export default async function TeamProfilePage({ params }: PageProps) {
  return (
    <Suspense fallback={<TeamProfileSkeleton />}>
      <TeamProfileContent params={params} />
    </Suspense>
  )
}
