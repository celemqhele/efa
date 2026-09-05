import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeamDNAFromDB, buildTeamStatsMixed } from '@/lib/dna-engine'
import type { DNAProfile, PersonalizedDescription } from '@/lib/dna-engine'
import { detectTeamStates } from '@/lib/team-states'
import type { TeamState } from '@/lib/team-states'
import { generateManagerNotes } from '@/lib/manager-notes'
import type { ManagerNote } from '@/lib/manager-notes'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: team } = await supabase.from('teams').select('name').eq('id', id).single() as any
  const name = team?.name ?? 'Team'
  return {
    title: name,
    description: `${name} — EFA team profile with stats, DNA analysis, and match history.`,
    openGraph: { title: `${name} | EFA`, description: `${name} — EFA team profile with stats, DNA analysis, and match history.` },
  }
}

export default async function TeamProfilePage({ params }: PageProps) {
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

  // Standings across all tournaments
  const { data: _standings } = await supabase
    .from('standings')
    .select('*, tournament:tournaments(*)')
    .in('team_id', siblingIds)
  const standings = (_standings ?? []) as any[]

  // Also fetch group_standings for group-based tournaments (UCL, World Cup, etc.)
  const { data: _groupStandings } = await supabase
    .from('group_standings')
    .select('*, tournament:tournaments(*)')
    .in('team_id', siblingIds)
  const groupStandings = (_groupStandings ?? []) as any[]

  // Merge group_standings into standings: aggregate per tournament per team
  const mergedByTournament = new Map<string, any>()
  for (const s of standings) mergedByTournament.set(`${s.tournament_id}:${s.team_id}`, s)
  for (const gs of groupStandings) {
    const key = `${gs.tournament_id}:${gs.team_id}`
    if (mergedByTournament.has(key)) {
      const existing = mergedByTournament.get(key)!
      existing.played = (existing.played ?? 0) + (gs.played ?? 0)
      existing.wins = (existing.wins ?? 0) + (gs.wins ?? 0)
      existing.draws = (existing.draws ?? 0) + (gs.draws ?? 0)
      existing.losses = (existing.losses ?? 0) + (gs.losses ?? 0)
      existing.goals_for = (existing.goals_for ?? 0) + (gs.goals_for ?? 0)
      existing.goals_against = (existing.goals_against ?? 0) + (gs.goals_against ?? 0)
      existing.points = (existing.points ?? 0) + (gs.points ?? 0)
    } else {
      mergedByTournament.set(key, { ...gs })
    }
  }
  const allStandings = [...standings, ...groupStandings.filter(
    gs => !mergedByTournament.has(`${gs.tournament_id}:${gs.team_id}`) || !standings.find(s => s.tournament_id === gs.tournament_id && s.team_id === gs.team_id)
  )].map(s => mergedByTournament.get(`${s.tournament_id}:${s.team_id}`) ?? s)

  // Is this club currently holding a seat in an active tournament? (seat model:
  // tournament_participants rows point at the seat's current team across the
  // club's sibling rows, so a filled Vacant seat counts too.)
  const { data: _tournSeats } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .in('team_id', siblingIds)
  const tournSeatIds = [...new Set((_tournSeats ?? []).map((s: any) => s.tournament_id))]
  let inTournament = false
  if (tournSeatIds.length > 0) {
    const { data: _activeTourns } = await supabase
      .from('tournaments')
      .select('id')
      .eq('status', 'active')
      .in('id', tournSeatIds)
    inTournament = (_activeTourns ?? []).length > 0
  }

  // Active standings
  const activeStandings = (allStandings ?? []).filter(
    (s: any) => s.tournament?.status === 'active'
  )

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
  const biggestWin = currentStanding?.biggest_win_score ? currentStanding : null

  const primaryStanding =
    activeStandings[0] ?? (allStandings && allStandings.length > 0 ? allStandings[0] : null)
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

  // ── Manager-scoped DNA + Team States + Manager Notes
  const managerId = (manager as any)?.id

  let dnaProfiles: DNAProfile[] = []
  let dnaDescription: PersonalizedDescription | null = null
  let teamStates: TeamState[] = []
  let managerNotes: ManagerNote[] = []

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

  // Upcoming fixtures
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

  // Recent results
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

  const sortedRecentResults = [...(clubRecentResults ?? [])].sort((a: any, b: any) => {
    const dateA = new Date(a.scheduled_date || 0).getTime()
    const dateB = new Date(b.scheduled_date || 0).getTime()
    if (dateB !== dateA) return dateB - dateA
    const resA = new Date(a.result?.created_at || 0).getTime()
    const resB = new Date(b.result?.created_at || 0).getTime()
    return resB - resA
  })

  const data = {
    team,
    manager,
    currentUser,
    isAdmin,
    isCurrentManager,
    hasPendingApplication,
    allProfiles,
    managedTeamByUser,
    isVacantTeam: team.logo_league_folder === 'custom' && team.logo_team_slug === 'vacant',
    inTournament,
    trophies,
    standings: allStandings,
    currentStanding,
    totalPlayed,
    totalWins,
    totalDraws,
    totalLosses,
    totalGF,
    totalGA,
    totalGD,
    totalPoints,
    totalCleanSheets,
    biggestWin,
    currentForm,
    unbeatenRun,
    tenures,
    h2hEntries,
    dnaProfiles,
    dnaDescription,
    teamStates,
    managerNotes,
    upcomingFixtures,
    sortedRecentResults,
    siblingIds,
    allTeamIds,
  }

  return <Shell data={data} />
}
