import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import { FormStrip } from '@/components/ui/FormBadge'
import { calculateProbability } from '@/lib/probability-engine'
import { getTeamDNA, buildTeamStats } from '@/lib/dna-engine'
import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'

export const revalidate = 30

interface PageProps {
  params: { id: string }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBar({
  label,
  home,
  away,
}: {
  label: string
  home: number | null
  away: number | null
}) {
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a || 1
  const homePct = Math.round((h / total) * 100)
  const awayPct = 100 - homePct

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span className="font-semibold text-white">{h}</span>
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-semibold text-white">{a}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-navy-border">
        <div
          className="bg-gold transition-all duration-500"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-slate-500 transition-all duration-500"
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  )
}

function ProbabilityBar({
  home,
  draw,
  away,
  homeName,
  awayName,
}: {
  home: number
  draw: number
  away: number
  homeName: string
  awayName: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-gold">{home}%</span>
        <span className="text-slate-400">{draw}% Draw</span>
        <span className="text-slate-300">{away}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-gold rounded-l-full transition-all duration-700"
          style={{ width: `${home}%` }}
          title={`${homeName} win ${home}%`}
        />
        <div
          className="bg-slate-600 transition-all duration-700"
          style={{ width: `${draw}%` }}
          title={`Draw ${draw}%`}
        />
        <div
          className="bg-slate-400 rounded-r-full transition-all duration-700"
          style={{ width: `${away}%` }}
          title={`${awayName} win ${away}%`}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{homeName}</span>
        <span>{awayName}</span>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function FixtureDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = params

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fixture with teams + tournament
  const { data: fixture } = await supabase
    .from('fixtures')
    .select(
      `*,
      tournament:tournaments(*),
      home_team:teams!fixtures_home_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*)),
      away_team:teams!fixtures_away_team_id_fkey(*, manager:profiles!teams_manager_id_fkey(*))`
    )
    .eq('id', id)
    .single()

  if (!fixture) notFound()

  // Result + match stats
  const { data: result } = await supabase
    .from('results')
    .select('*, match_stats(*)')
    .eq('fixture_id', id)
    .maybeSingle()

  const matchStats = (result as any)?.match_stats ?? null

  // Standings for both teams in this tournament
  const [{ data: homeStanding }, { data: awayStanding }] = await Promise.all([
    supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', fixture.tournament_id)
      .eq('team_id', fixture.home_team_id)
      .maybeSingle(),
    supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', fixture.tournament_id)
      .eq('team_id', fixture.away_team_id)
      .maybeSingle(),
  ])

  // H2H last 5
  const { data: h2hFixtures } = await supabase
    .from('fixtures')
    .select('*, result:results(*)')
    .or(
      `and(home_team_id.eq.${fixture.home_team_id},away_team_id.eq.${fixture.away_team_id}),and(home_team_id.eq.${fixture.away_team_id},away_team_id.eq.${fixture.home_team_id})`
    )
    .not('status', 'eq', 'scheduled')
    .order('created_at', { ascending: false })
    .limit(5)

  const h2hList = (h2hFixtures ?? []).filter((f: any) => f.result)

  // H2H record for probability
  const h2hRecord = {
    homeWins: h2hList.filter(
      (f: any) =>
        f.home_team_id === fixture.home_team_id &&
        f.result.home_score > f.result.away_score
    ).length,
    awayWins: h2hList.filter(
      (f: any) =>
        f.home_team_id === fixture.away_team_id &&
        f.result.home_score > f.result.away_score
    ).length,
    draws: h2hList.filter(
      (f: any) => f.result.home_score === f.result.away_score
    ).length,
  }

  const probability = calculateProbability(homeStanding as any, awayStanding as any, h2hRecord)

  // Result confirmations
  const { data: confirmations } = await supabase
    .from('result_confirmations')
    .select('*')
    .eq('fixture_id', id)

  // Comments + profiles
  const { data: commentsRaw } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_user_id_fkey(*)')
    .eq('fixture_id', id)
    .order('created_at', { ascending: true })

  const comments = commentsRaw ?? []
  const topLevel = comments.filter((c: any) => !c.parent_id)
  const replies = comments.filter((c: any) => c.parent_id)

  // Waiting reports
  const { data: waitingReports } = await supabase
    .from('waiting_reports')
    .select('*')
    .eq('fixture_id', id)

  // Reactions
  const { data: reactionsRaw } = await supabase
    .from('reactions')
    .select('emoji')
    .eq('fixture_id', id)

  const reactionCounts: Record<string, number> = {}
  for (const r of reactionsRaw ?? []) {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1
  }

  // DNA for both teams (only if match stats available from previous games)
  const { data: homeMatchStatsList } = await supabase
    .from('match_stats')
    .select('*')
    .in(
      'result_id',
      (
        await supabase
          .from('results')
          .select('id')
          .in(
            'fixture_id',
            (
              await supabase
                .from('fixtures')
                .select('id')
                .eq('home_team_id', fixture.home_team_id)
            ).data?.map((f) => f.id) ?? []
          )
      ).data?.map((r) => r.id) ?? []
    )
    .limit(10)

  const { data: awayMatchStatsList } = await supabase
    .from('match_stats')
    .select('*')
    .in(
      'result_id',
      (
        await supabase
          .from('results')
          .select('id')
          .in(
            'fixture_id',
            (
              await supabase
                .from('fixtures')
                .select('id')
                .eq('away_team_id', fixture.away_team_id)
            ).data?.map((f) => f.id) ?? []
          )
      ).data?.map((r) => r.id) ?? []
    )
    .limit(10)

  const homeDNA =
    homeMatchStatsList && homeMatchStatsList.length > 0
      ? getTeamDNA(buildTeamStats(homeMatchStatsList as any, true, []))
      : []
  const awayDNA =
    awayMatchStatsList && awayMatchStatsList.length > 0
      ? getTeamDNA(buildTeamStats(awayMatchStatsList as any, false, []))
      : []

  // Derived state
  const homeTeam = (fixture as any).home_team
  const awayTeam = (fixture as any).away_team
  const tournament = (fixture as any).tournament
  const homeManager = homeTeam?.manager
  const awayManager = awayTeam?.manager
  const hasResult = !!result

  const isHomeManager = user?.id && homeManager?.id === user.id
  const isAwayManager = user?.id && awayManager?.id === user.id
  const isManager = isHomeManager || isAwayManager

  const conf1 = confirmations?.find((c) => c.submitted_by === homeManager?.id)
  const conf2 = confirmations?.find((c) => c.submitted_by === awayManager?.id)
  const bothSubmitted = conf1 && conf2
  const scoresMatch =
    bothSubmitted &&
    conf1.home_score === conf2.home_score &&
    conf1.away_score === conf2.away_score
  const confirmationStatus = hasResult
    ? 'finalised'
    : bothSubmitted
    ? scoresMatch
      ? 'awaiting_confirmation'
      : 'scores_mismatch'
    : 'pending'

  const EMOJI_REACTIONS = ['🔥', '😬', '😭', '🐐']

  return (
    <div className="space-y-6">
      {/* ── Match Header ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="text-center mb-4">
          <span className="text-xs font-medium text-gold uppercase tracking-widest">
            {tournament?.name ?? 'Match'} · Matchday {fixture.matchday}
          </span>
          {fixture.scheduled_date && (
            <p className="text-slate-400 text-xs mt-1">
              {new Date(fixture.scheduled_date).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {hasResult ? (
          /* ── POST-MATCH SCORE ─────────────────────────────────────────── */
          <div className="flex items-center justify-between gap-4">
            {/* Home */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <Image
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'match_detail_hero')}
                alt={homeTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-white text-sm">{homeTeam.name}</p>
                <p className="text-xs text-slate-500">{homeManager?.username ?? '—'}</p>
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black text-white tabular-nums">
                {result.home_score}
              </span>
              <span className="text-2xl font-bold text-slate-500">–</span>
              <span className="text-5xl font-black text-white tabular-nums">
                {result.away_score}
              </span>
            </div>

            {/* Away */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <Image
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'match_detail_hero')}
                alt={awayTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-white text-sm">{awayTeam.name}</p>
                <p className="text-xs text-slate-500">{awayManager?.username ?? '—'}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── PRE-MATCH TEAMS ──────────────────────────────────────────── */
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col items-center gap-3">
              <Image
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'match_detail_hero')}
                alt={homeTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-white text-sm">{homeTeam.name}</p>
                <p className="text-xs text-slate-500">{homeManager?.username ?? '—'}</p>
              </div>
            </div>

            <div className="text-center">
              <span className="text-3xl font-black text-slate-600">VS</span>
            </div>

            <div className="flex-1 flex flex-col items-center gap-3">
              <Image
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'match_detail_hero')}
                alt={awayTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-white text-sm">{awayTeam.name}</p>
                <p className="text-xs text-slate-500">{awayManager?.username ?? '—'}</p>
              </div>
            </div>
          </div>
        )}

        {result?.is_abandoned && (
          <div className="mt-4 text-center">
            <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Abandoned —{' '}
              {result.abandoned_type === 'home'
                ? homeTeam.name
                : result.abandoned_type === 'away'
                ? awayTeam.name
                : 'Both teams'}{' '}
              left
            </span>
          </div>
        )}
      </div>

      {/* ── PRE-MATCH SECTIONS ───────────────────────────────────────────── */}
      {!hasResult && (
        <>
          {/* Matchroom Instructions */}
          <div className="card p-5 border-gold/30 bg-gradient-to-br from-[#111c3d] to-[#0f1a3d]">
            <h2 className="section-header">
              <span className="text-gold">🎮</span> Matchroom Instructions
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-gold/10 border border-gold/20">
                <span className="text-2xl">🏠</span>
                <div>
                  <p className="text-gold font-bold text-sm uppercase tracking-wider">
                    HOME — {homeTeam.name}
                  </p>
                  {homeManager && (
                    <p className="text-white font-semibold">@{homeManager.username}</p>
                  )}
                  <p className="text-slate-300 text-sm mt-1">
                    YOU CREATE THE MATCHROOM in eFootball
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-navy-border/50 border border-navy-border">
                <span className="text-2xl">✈️</span>
                <div>
                  <p className="text-slate-300 font-bold text-sm uppercase tracking-wider">
                    AWAY — {awayTeam.name}
                  </p>
                  {awayManager && (
                    <p className="text-white font-semibold">@{awayManager.username}</p>
                  )}
                  <p className="text-slate-400 text-sm mt-1">
                    You join the matchroom
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Win Probability */}
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">📊</span> Win Probability
            </h2>
            <ProbabilityBar
              home={probability.home}
              draw={probability.draw}
              away={probability.away}
              homeName={homeTeam.name}
              awayName={awayTeam.name}
            />
          </div>

          {/* H2H Last 5 */}
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">⚔️</span> Head to Head (Last 5)
            </h2>
            {h2hList.length === 0 ? (
              <p className="text-slate-500 text-sm">No previous meetings.</p>
            ) : (
              <div className="space-y-2">
                {h2hList.map((f: any) => {
                  const isHome = f.home_team_id === fixture.home_team_id
                  const hScore = f.result.home_score
                  const aScore = f.result.away_score
                  const ourScore = isHome ? hScore : aScore
                  const theirScore = isHome ? aScore : hScore
                  const outcome =
                    ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D'
                  const outcomeColor =
                    outcome === 'W'
                      ? 'text-green-400'
                      : outcome === 'L'
                      ? 'text-red-400'
                      : 'text-yellow-400'

                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-navy-border/30"
                    >
                      <span className="text-slate-400 text-xs">
                        {f.home_team_id === fixture.home_team_id
                          ? homeTeam.name
                          : awayTeam.name}{' '}
                        (H)
                      </span>
                      <span className="font-bold text-white tabular-nums">
                        {hScore} – {aScore}
                      </span>
                      <span className={`text-xs font-bold ${outcomeColor}`}>
                        {outcome}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Team DNA */}
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">🧬</span> Team DNA
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {homeTeam.name}
                </p>
                {homeDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {homeDNA.map((dna) => (
                      <span
                        key={dna.label}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${dna.color}`}
                      >
                        {dna.emoji} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 text-xs">Not enough data</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {awayTeam.name}
                </p>
                {awayDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {awayDNA.map((dna) => (
                      <span
                        key={dna.label}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${dna.color}`}
                      >
                        {dna.emoji} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 text-xs">Not enough data</p>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">📈</span> Recent Form (Last 6)
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{homeTeam.name}</span>
                <FormStrip form={(homeStanding?.form ?? '').slice(-6)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{awayTeam.name}</span>
                <FormStrip form={(awayStanding?.form ?? '').slice(-6)} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── POST-MATCH SECTIONS ───────────────────────────────────────────── */}
      {hasResult && (
        <>
          {/* Match Stats */}
          {matchStats && (
            <div className="card p-5">
              <h2 className="section-header">
                <span className="text-gold">📊</span> Match Statistics
              </h2>
              <div className="space-y-3">
                <StatBar label="Possession %" home={matchStats.home_possession} away={matchStats.away_possession} />
                <StatBar label="Shots" home={matchStats.home_shots} away={matchStats.away_shots} />
                <StatBar label="Shots on Target" home={matchStats.home_shots_on_target} away={matchStats.away_shots_on_target} />
                <StatBar label="Passes" home={matchStats.home_passes} away={matchStats.away_passes} />
                <StatBar label="Successful Passes" home={matchStats.home_successful_passes} away={matchStats.away_successful_passes} />
                <StatBar label="Crosses" home={matchStats.home_crosses} away={matchStats.away_crosses} />
                <StatBar label="Corners" home={matchStats.home_corners} away={matchStats.away_corners} />
                <StatBar label="Fouls" home={matchStats.home_fouls} away={matchStats.away_fouls} />
                <StatBar label="Saves" home={matchStats.home_saves} away={matchStats.away_saves} />
                <StatBar label="Interceptions" home={matchStats.home_interceptions} away={matchStats.away_interceptions} />
                <StatBar label="Tackles" home={matchStats.home_tackles} away={matchStats.away_tackles} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-navy-border">
                <span className="font-semibold text-slate-300">{homeTeam.name}</span>
                <span className="font-semibold text-slate-300">{awayTeam.name}</span>
              </div>
            </div>
          )}

          {/* Emoji Reactions */}
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">💬</span> Reactions
            </h2>
            <div className="flex gap-4">
              {EMOJI_REACTIONS.map((emoji) => (
                <div key={emoji} className="flex flex-col items-center gap-1">
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-semibold text-slate-300">
                    {reactionCounts[emoji] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── RESULT CONFIRMATION STATUS ───────────────────────────────────── */}
      {!hasResult && (
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-gold">✅</span> Score Submission
          </h2>

          {confirmationStatus === 'awaiting_confirmation' && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium">
              Both scores match! Waiting for admin to finalise.
            </div>
          )}

          {confirmationStatus === 'scores_mismatch' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
              Scores don&apos;t match. Please contact an admin to resolve.
            </div>
          )}

          {confirmationStatus === 'pending' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{homeTeam.name}</span>
                {conf1 ? (
                  <span className="text-green-400 font-semibold">
                    Submitted: {conf1.home_score}–{conf1.away_score}
                  </span>
                ) : (
                  <span className="text-slate-600">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{awayTeam.name}</span>
                {conf2 ? (
                  <span className="text-green-400 font-semibold">
                    Submitted: {conf2.home_score}–{conf2.away_score}
                  </span>
                ) : (
                  <span className="text-slate-600">Pending</span>
                )}
              </div>
            </div>
          )}

          {isManager && !hasResult && (
            <div className="mt-4">
              <Link
                href={`/fixtures/${id}/submit`}
                className="btn-gold inline-block"
              >
                Submit Score
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── WAITING REPORTS ─────────────────────────────────────────────── */}
      {waitingReports && waitingReports.length > 0 && (
        <div className="card p-5 border-yellow-500/30">
          <h2 className="section-header">
            <span>⏳</span> Waiting Reports
          </h2>
          <p className="text-sm text-yellow-400">
            {waitingReports.length} team(s) have reported waiting for their opponent to be ready.
          </p>
        </div>
      )}

      {/* ── DISCONNECT RULES ─────────────────────────────────────────────── */}
      <details className="card p-5 group">
        <summary className="section-header cursor-pointer list-none flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-gold">⚡</span> Disconnect Rules
          </span>
          <span className="text-slate-500 text-xs group-open:hidden">Tap to expand</span>
          <span className="text-slate-500 text-xs hidden group-open:inline">Collapse</span>
        </summary>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gold mb-2 uppercase tracking-wider">
              Official Rules
            </h3>
            <ul className="space-y-1">
              {OFFICIAL_RULES.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span>{r.icon}</span>
                  <span>{r.rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gold mb-2 uppercase tracking-wider">
              Disconnect Restart Table
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-navy-border">
                    <th className="pb-2 pr-4">Minute of DC</th>
                    <th className="pb-2 pr-4">Restart</th>
                    <th className="pb-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-border/50">
                  {DISCONNECT_RULES.map((rule, i) => (
                    <tr key={i} className="text-slate-300">
                      <td className="py-2 pr-4 font-semibold text-gold">{rule.minute}</td>
                      <td className="py-2 pr-4">{rule.restart}</td>
                      <td className="py-2 text-slate-500">{rule.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </details>

      {/* ── BANTER BOARD ─────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-header">
          <span className="text-gold">💬</span> Banter Board
          <span className="text-slate-500 text-sm font-normal ml-auto">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {topLevel.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No comments yet. Be the first to drop some banter.
          </p>
        ) : (
          <div className="space-y-4">
            {topLevel.map((comment: any) => {
              const commentReplies = replies.filter(
                (r: any) => r.parent_id === comment.id
              )
              return (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-navy-border flex items-center justify-center text-xs font-bold text-gold shrink-0">
                      {comment.author?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 p-3 rounded-lg bg-navy-border/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gold">
                          @{comment.author?.username ?? 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(comment.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{comment.content}</p>
                    </div>
                  </div>

                  {/* Replies */}
                  {commentReplies.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {commentReplies.map((reply: any) => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-navy-border flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                            {reply.author?.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 p-2.5 rounded-lg bg-navy-border/20 border border-navy-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-300">
                                @{reply.author?.username ?? 'Unknown'}
                              </span>
                              <span className="text-xs text-slate-600">
                                {new Date(reply.created_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {user && (
          <div className="mt-4 pt-4 border-t border-navy-border">
            <form action={`/api/comments`} method="post">
              <input type="hidden" name="fixture_id" value={id} />
              <div className="flex gap-3">
                <input
                  type="text"
                  name="content"
                  placeholder="Drop your banter here..."
                  className="input-field flex-1"
                />
                <button type="submit" className="btn-gold shrink-0">
                  Post
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
