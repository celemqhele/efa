import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import { calculateProbability } from '@/lib/probability-engine'

export const revalidate = 60

export default async function PredictionsPage() {
  const supabase = await createClient()

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // All predictions with user profiles + fixture data
  const { data: predictions } = await supabase
    .from('predictions')
    .select(
      `*,
      user:profiles!predictions_user_id_fkey(*),
      fixture:fixtures(
        id, matchday, tournament_id,
        home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
        away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
        result:results(home_score, away_score),
        tournament:tournaments(name)
      )`
    )
    .order('created_at', { ascending: false })

  // Leaderboard: aggregate points per user
  const pointsMap: Record<string, { username: string; points: number; count: number }> = {}
  for (const p of predictions ?? []) {
    const uid = p.user_id
    const username = (p as any).user?.username ?? 'Unknown'
    if (!pointsMap[uid]) {
      pointsMap[uid] = { username, points: 0, count: 0 }
    }
    pointsMap[uid].points += p.points_earned ?? 0
    pointsMap[uid].count++
  }
  const leaderboard = Object.entries(pointsMap)
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, 20)

  // My predictions
  const myPredictions = user
    ? (predictions ?? []).filter((p) => p.user_id === user.id)
    : []

  // Upcoming fixtures with no result (available to predict)
  const { data: upcomingFixtures } = await supabase
    .from('fixtures')
    .select(
      `id, matchday, scheduled_date, tournament_id,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments(name),
      result:results(id)`
    )
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })
    .limit(20)

  const availableFixtures = (upcomingFixtures ?? []).filter((f: any) => !f.result)

  // Fetch ALL standings for teams in upcoming fixtures — across every season/phase
  // This gives a full career picture so probabilities aren't flat when a new season just started
  const fixtureTeamIds = Array.from(
    new Set(availableFixtures.flatMap((f: any) => [f.home_team?.id, f.away_team?.id].filter(Boolean)))
  ) as string[]

  // Also resolve sibling team IDs (same club, different phase rows) so Phase 1 data is included
  const { data: siblingRows } = fixtureTeamIds.length > 0
    ? await supabase
        .from('teams')
        .select('id, logo_team_slug')
        .in('id', fixtureTeamIds)
    : { data: [] as any[] }

  // Map: slug → all team_ids for that club
  const slugToIds = new Map<string, string[]>()
  for (const t of siblingRows ?? []) {
    if (!t.logo_team_slug) continue
    if (!slugToIds.has(t.logo_team_slug)) slugToIds.set(t.logo_team_slug, [])
    slugToIds.get(t.logo_team_slug)!.push(t.id)
  }

  // Get all sibling IDs so we can query Phase 1 + Phase 2 standings together
  const { data: allSiblings } = slugToIds.size > 0
    ? await supabase
        .from('teams')
        .select('id, logo_team_slug')
        .in('logo_team_slug', Array.from(slugToIds.keys()))
    : { data: [] as any[] }

  const allRelevantTeamIds = Array.from(new Set((allSiblings ?? []).map((t: any) => t.id))) as string[]

  // Fetch every standing row for all relevant team IDs (all seasons combined)
  const { data: fixtureStandings } = allRelevantTeamIds.length > 0
    ? await supabase
        .from('standings')
        .select('team_id, tournament_id, played, wins, draws, losses, goals_for, goals_against, points, form, unbeaten_run')
        .in('team_id', allRelevantTeamIds)
    : { data: [] as any[] }

  // Build per-slug aggregated standing: sum career stats, use most recent form string
  // Maps original fixture team_id → a synthetic aggregated standing
  const aggregatedLookup = new Map<string, any>()

  for (const [slug, ids] of Array.from(slugToIds.entries())) {
    // Find all sibling IDs for this club
    const clubSiblingIds = new Set((allSiblings ?? [])
      .filter((t: any) => t.logo_team_slug === slug)
      .map((t: any) => t.id))

    // Collect all standings rows for this club
    const clubStandings = (fixtureStandings ?? []).filter((s: any) => clubSiblingIds.has(s.team_id))
    if (clubStandings.length === 0) continue

    // Aggregate career totals
    const totalPlayed = clubStandings.reduce((n: number, s: any) => n + (s.played ?? 0), 0)
    const totalGF     = clubStandings.reduce((n: number, s: any) => n + (s.goals_for ?? 0), 0)
    const totalGA     = clubStandings.reduce((n: number, s: any) => n + (s.goals_against ?? 0), 0)
    const totalWins   = clubStandings.reduce((n: number, s: any) => n + (s.wins ?? 0), 0)
    const totalDraws  = clubStandings.reduce((n: number, s: any) => n + (s.draws ?? 0), 0)

    // Use form from the row with the most games played (best proxy for current form)
    const richestRow = clubStandings.sort((a: any, b: any) => (b.played ?? 0) - (a.played ?? 0))[0]

    const aggregated = {
      played: totalPlayed,
      goals_for: totalGF,
      goals_against: totalGA,
      wins: totalWins,
      draws: totalDraws,
      losses: totalPlayed - totalWins - totalDraws,
      // Form: prefer current season's form; fall back to best available
      form: richestRow?.form ?? '',
      unbeaten_run: richestRow?.unbeaten_run ?? 0,
    }

    // Map every original fixture team ID (for this slug) back to the aggregated standing
    for (const id of ids) {
      aggregatedLookup.set(id, aggregated)
    }
  }

  // Rank medal helper
  const rankMedal = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  // Outcome label for a prediction
  const predictionOutcome = (pred: any) => {
    const result = pred.fixture?.result
    if (!result) return 'pending'
    const ph = pred.predicted_home_score
    const pa = pred.predicted_away_score
    const rh = result.home_score
    const ra = result.away_score
    if (ph === rh && pa === ra) return 'exact'
    const predResult = ph > pa ? 'H' : ph < pa ? 'A' : 'D'
    const realResult = rh > ra ? 'H' : rh < ra ? 'A' : 'D'
    if (predResult === realResult) return 'correct_result'
    return 'wrong'
  }

  const outcomeStyle: Record<string, string> = {
    exact: 'bg-green-500/20 text-green-400 border-green-500/30',
    correct_result: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    wrong: 'bg-red-500/20 text-red-400 border-red-500/30',
    pending: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }
  const outcomeLabel: Record<string, string> = {
    exact: '🎯 Exact',
    correct_result: '✅ Correct',
    wrong: '❌ Wrong',
    pending: '⏳ Pending',
  }

  return (
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-black text-slate-900">Predictions</h1>
        <p className="text-slate-400 text-sm mt-1">
          Predict match scores to earn points. Predictions open at any time —
          locked when the result is submitted.
        </p>
      </div>

      {/* ── Available to Predict ──────────────────────────────────────────── */}
      <div>
        <h2 className="section-header">
          <span className="text-gold">🔓</span> Open for Predictions
        </h2>
        {availableFixtures.length === 0 ? (
          <div className="card p-6 text-center text-slate-500 text-sm">
            No upcoming fixtures available for predictions right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableFixtures.map((f: any) => {
              const homeStanding = standingLookup.get(`${f.home_team?.id}_${f.tournament_id}`) ?? null
              const awayStanding = standingLookup.get(`${f.away_team?.id}_${f.tournament_id}`) ?? null
              const prob = calculateProbability(homeStanding, awayStanding, { homeWins: 0, awayWins: 0, draws: 0 })

              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="card p-4 hover:border-gold/40 transition-colors group"
                >
                  {/* Teams row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Image
                        src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                        alt={f.home_team.name}
                        width={28} height={28}
                        className="object-contain shrink-0"
                      />
                      <span className="text-sm font-semibold text-slate-900 truncate">{f.home_team.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 shrink-0">VS</span>
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm font-semibold text-slate-900 truncate text-right">{f.away_team.name}</span>
                      <Image
                        src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                        alt={f.away_team.name}
                        width={28} height={28}
                        className="object-contain shrink-0"
                      />
                    </div>
                  </div>

                  {/* Win probability bar */}
                  <div className="space-y-1">
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      <div className="bg-gold rounded-l-full transition-all" style={{ width: `${prob.home}%` }} title={`${f.home_team.name} ${prob.home}%`} />
                      <div className="bg-slate-500 transition-all" style={{ width: `${prob.draw}%` }} title={`Draw ${prob.draw}%`} />
                      <div className="bg-slate-400 rounded-r-full transition-all" style={{ width: `${prob.away}%` }} title={`${f.away_team.name} ${prob.away}%`} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span className="text-gold font-semibold">{prob.home}%</span>
                      <span>{prob.draw}% Draw</span>
                      <span>{prob.away}%</span>
                    </div>
                  </div>

                  <div className="mt-2 text-right">
                    <span className="text-xs text-gold font-semibold group-hover:underline">Predict →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Leaderboard ───────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <h2 className="section-header">
            <span className="text-gold">🏆</span> Leaderboard
          </h2>
          <div className="card overflow-hidden">
            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No predictions submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-navy-border">
                {leaderboard.map(([uid, data], idx) => (
                  <div
                    key={uid}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-navy-border/20 transition-colors"
                  >
                    <span className="text-sm font-bold w-8 shrink-0 text-center">
                      {rankMedal(idx + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        @{data.username}
                      </p>
                      <p className="text-xs text-slate-500">
                        {data.count} prediction{data.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-gold">{data.points}</p>
                      <p className="text-xs text-slate-500">pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── My Predictions ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="section-header">
            <span className="text-gold">🎯</span>{' '}
            {user ? 'My Predictions' : 'Recent Predictions'}
          </h2>

          {!user && (
            <div className="card p-6 text-center">
              <p className="text-slate-400 text-sm mb-3">
                Sign in to track your predictions and earn points.
              </p>
              <Link href="/login" className="btn-gold">
                Sign In
              </Link>
            </div>
          )}

          {user && myPredictions.length === 0 && (
            <div className="card p-6 text-center text-slate-500 text-sm">
              You haven&apos;t made any predictions yet. Pick a fixture above to start.
            </div>
          )}

          {user && myPredictions.length > 0 && (
            <div className="space-y-3">
              {myPredictions.slice(0, 20).map((pred: any) => {
                const outcome = predictionOutcome(pred)
                const fixture = pred.fixture
                if (!fixture) return null
                return (
                  <Link
                    key={pred.id}
                    href={`/fixtures/${fixture.id}`}
                    className="card p-4 flex items-center gap-4 hover:border-gold/30 transition-colors"
                  >
                    {/* Teams */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Image
                          src={getTeamLogo(
                            fixture.home_team.logo_league_folder,
                            fixture.home_team.logo_team_slug,
                            'standings_row'
                          )}
                          alt={fixture.home_team.name}
                          width={20}
                          height={20}
                          className="object-contain shrink-0"
                        />
                        <span className="text-sm text-slate-900 font-medium truncate">
                          {fixture.home_team.name}
                        </span>
                        <span className="text-slate-500 text-xs">vs</span>
                        <span className="text-sm text-slate-900 font-medium truncate">
                          {fixture.away_team.name}
                        </span>
                        <Image
                          src={getTeamLogo(
                            fixture.away_team.logo_league_folder,
                            fixture.away_team.logo_team_slug,
                            'standings_row'
                          )}
                          alt={fixture.away_team.name}
                          width={20}
                          height={20}
                          className="object-contain shrink-0"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {fixture.tournament?.name} · MD{fixture.matchday}
                      </p>
                    </div>

                    {/* Prediction */}
                    <div className="text-center shrink-0">
                      <p className="text-lg font-black text-slate-900 tabular-nums">
                        {pred.predicted_home_score ?? '?'} – {pred.predicted_away_score ?? '?'}
                      </p>
                      {fixture.result && (
                        <p className="text-xs text-slate-500 tabular-nums">
                          Actual: {fixture.result.home_score}–{fixture.result.away_score}
                        </p>
                      )}
                    </div>

                    {/* Outcome + Points */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-1 ${outcomeStyle[outcome]}`}
                      >
                        {outcomeLabel[outcome]}
                      </span>
                      {pred.points_earned > 0 && (
                        <p className="text-sm font-bold text-gold">
                          +{pred.points_earned} pts
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Scoring Rules ─────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-header">
          <span className="text-gold">📋</span> How Points Work
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-2xl font-black text-green-400">3</p>
            <p className="text-green-300 font-semibold">Exact Score</p>
            <p className="text-slate-500 text-xs mt-1">Predict the exact scoreline</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
            <p className="text-2xl font-black text-blue-400">1</p>
            <p className="text-blue-300 font-semibold">Correct Result</p>
            <p className="text-slate-500 text-xs mt-1">Right winner or draw, wrong score</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-2xl font-black text-red-400">0</p>
            <p className="text-red-300 font-semibold">Wrong</p>
            <p className="text-slate-500 text-xs mt-1">Incorrect result</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Predictions can be made at any time before the result is submitted. Once a result is finalised, predictions are locked and points are awarded automatically.
        </p>
      </div>
    </div>
  )
}
