'use client'
import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import { FormStrip } from '@/components/ui/FormBadge'
import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'
import MatchroomCode from '@/components/ui/MatchroomCode'
import ReactionsPanel from '@/components/ui/ReactionsPanel'
import ForfeitBadge from '@/components/ui/ForfeitBadge'
import {
  Gamepad2, Home, Plane, BarChart3, Swords, Sword, Dna, TrendingUp,
  MessageSquare, CheckCircle, Hourglass, Zap, Check, X, ChevronDown,
  Crown, Drama, Brain, Shield, Dumbbell,
  ArrowLeftRight, Triangle, Crosshair, Scale,
} from 'lucide-react'

const DNA_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="w-3.5 h-3.5" />,
  theater: <Drama className="w-3.5 h-3.5" />,
  zap: <Zap className="w-3.5 h-3.5" />,
  brain: <Brain className="w-3.5 h-3.5" />,
  dagger: <Sword className="w-3.5 h-3.5" />,
  shield: <Shield className="w-3.5 h-3.5" />,
  muscle: <Dumbbell className="w-3.5 h-3.5" />,
  arrows_horizontal: <ArrowLeftRight className="w-3.5 h-3.5" />,
  triangle: <Triangle className="w-3.5 h-3.5" />,
  target: <Crosshair className="w-3.5 h-3.5" />,
  scale: <Scale className="w-3.5 h-3.5" />,
}

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
      <div className="flex justify-between text-xs text-text-muted">
        <span className="font-semibold text-foreground-primary">{h}</span>
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-semibold text-foreground-primary">{a}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-navy-border">
        <div
          className="bg-gold transition-all duration-500"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-bg-surface0 transition-all duration-500"
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
        <span className="text-feedback-success">{home}%</span>
        <span className="text-text-muted">{draw}% Draw</span>
        <span className="text-accent">{away}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-feedback-success rounded-l-full transition-all duration-700"
          style={{ width: `${home}%` }}
          title={`${homeName} win ${home}%`}
        />
        <div
          className="bg-text-muted transition-all duration-700"
          style={{ width: `${draw}%` }}
          title={`Draw ${draw}%`}
        />
        <div
          className="bg-accent rounded-r-full transition-all duration-700"
          style={{ width: `${away}%` }}
          title={`${awayName} win ${away}%`}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{homeName}</span>
        <span>{awayName}</span>
      </div>
    </div>
  )
}

export default function Desktop({ data }: { data: any }) {
  const {
    id,
    fixture,
    result,
    matchStats,
    homeTeam,
    awayTeam,
    tournament,
    homeManager,
    awayManager,
    user,
    isHomeManager,
    isAwayManager,
    isManager,
    probability,
    h2hList,
    homeDNA,
    awayDNA,
    homeStanding,
    awayStanding,
    confirmationStatus,
    conf1,
    conf2,
    hasResult,
    waitingReports,
    reactionCounts,
    userReactionEmojis,
    comments,
    topLevel,
    replies,
    homeCoachNote,
    awayCoachNote,
  } = data

  return (
    <div className="space-y-6">
      {/* ── Match Header ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="text-center mb-4">
          <span className="text-xs font-medium text-gold uppercase tracking-widest">
            {tournament?.name ?? 'Match'} · Matchday {fixture.matchday}
          </span>
          {fixture.scheduled_date && (
            <p className="text-text-muted text-xs mt-1">
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
            <Link href={`/teams/${homeTeam.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'match_detail_hero')}
                alt={homeTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">{homeTeam.name}</p>
                <p className="text-xs text-text-muted">{homeManager?.username ?? '—'}</p>
              </div>
            </Link>

            {/* Score */}
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black text-foreground-primary tabular-nums">
                {result.home_score}
              </span>
              <span className="text-2xl font-bold text-text-muted">–</span>
              <span className="text-5xl font-black text-foreground-primary tabular-nums">
                {result.away_score}
              </span>
            </div>

            {/* Away */}
            <Link href={`/teams/${awayTeam.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'match_detail_hero')}
                alt={awayTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">{awayTeam.name}</p>
                <p className="text-xs text-text-muted">{awayManager?.username ?? '—'}</p>
              </div>
            </Link>
          </div>
        ) : (
          /* ── PRE-MATCH TEAMS ──────────────────────────────────────────── */
          <div className="flex items-center justify-between gap-4">
            <Link href={`/teams/${homeTeam.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'match_detail_hero')}
                alt={homeTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">{homeTeam.name}</p>
                <p className="text-xs text-text-muted">{homeManager?.username ?? '—'}</p>
              </div>
            </Link>

            <div className="text-center">
              <span className="text-3xl font-black text-foreground-muted">VS</span>
            </div>

            <Link href={`/teams/${awayTeam.id}`} className="flex-1 flex flex-col items-center gap-3 hover:opacity-80 transition-opacity">
              <Image
                src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'match_detail_hero')}
                alt={awayTeam.name}
                width={80}
                height={80}
                className="object-contain"
              />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">{awayTeam.name}</p>
                <p className="text-xs text-text-muted">{awayManager?.username ?? '—'}</p>
              </div>
            </Link>
          </div>
        )}

        {result?.is_abandoned && (
          <div className="mt-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                Abandoned —{' '}
                {result.abandoned_type === 'home'
                  ? homeTeam.name
                  : result.abandoned_type === 'away'
                  ? awayTeam.name
                  : 'Both teams'}{' '}
                left
              </span>
              <ForfeitBadge note={`Forfeit: ${result.abandoned_type === 'home' || result.abandoned_type === 'both' ? homeTeam.name : ''}${result.abandoned_type === 'both' ? ' & ' : ''}${result.abandoned_type === 'away' || result.abandoned_type === 'both' ? awayTeam.name : ''} forfeited. Score at time: ${result.home_score}-${result.away_score}. This penalty was applied to the aggregate.`} />
            </div>
          </div>
        )}
      </div>

      {/* ── PRE-MATCH SECTIONS ───────────────────────────────────────────── */}
      {!hasResult && (
        <>
          {/* Coach's Analysis — only visible to the relevant managers */}
          {isManager && (homeCoachNote || awayCoachNote) && (
            <div className="card p-5 border-gold/20">
              <details open className="group">
                <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                  <h2 className="section-header">
                    <Brain className="w-5 h-5 text-gold" /> Coach's Analysis
                  </h2>
                  <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
                </summary>
                <div className="mt-4 lg:mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Home team analysis — only visible to home manager */}
                {isHomeManager && homeCoachNote && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {homeTeam.name} — vs {awayTeam.name}
                    </p>
                    {/* Confidence */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Confidence:</span>
                      <span className={`font-mono font-bold text-sm ${
                        homeCoachNote.confidence.startsWith('+') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {homeCoachNote.confidence}
                      </span>
                    </div>
                    {/* Opponent will exploit */}
                    {homeCoachNote.opponent_will_exploit?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">
                          {awayTeam.name} will exploit
                        </h4>
                        <ul className="space-y-1">
                          {homeCoachNote.opponent_will_exploit.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Recommendations */}
                    {homeCoachNote.recommendations?.length > 0 && (
                      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">
                          Recommendation
                        </h4>
                        <ul className="space-y-1">
                          {homeCoachNote.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <span className="text-accent shrink-0 mt-0.5">›</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {/* Away team analysis — only visible to away manager */}
                {isAwayManager && awayCoachNote && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {awayTeam.name} — vs {homeTeam.name}
                    </p>
                    {/* Confidence */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Confidence:</span>
                      <span className={`font-mono font-bold text-sm ${
                        awayCoachNote.confidence.startsWith('+') ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {awayCoachNote.confidence}
                      </span>
                    </div>
                    {/* Opponent will exploit */}
                    {awayCoachNote.opponent_will_exploit?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">
                          {homeTeam.name} will exploit
                        </h4>
                        <ul className="space-y-1">
                          {awayCoachNote.opponent_will_exploit.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Recommendations */}
                    {awayCoachNote.recommendations?.length > 0 && (
                      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">
                          Recommendation
                        </h4>
                        <ul className="space-y-1">
                          {awayCoachNote.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <span className="text-accent shrink-0 mt-0.5">›</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
          </div>
          )}

          {/* Matchroom Instructions */}
          <div className="card p-5 border-accent/20 bg-bg-elevated">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <Gamepad2 className="w-5 h-5 text-gold" /> Matchroom Instructions
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0 space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-gold/10 border border-gold/20">
                <Home className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-gold font-bold text-sm uppercase tracking-wider">
                    HOME — {homeTeam.name}
                  </p>
                  {homeManager && (
                    <p className="text-foreground-primary font-semibold">@{homeManager.username}</p>
                  )}
                  <p className="text-foreground-secondary text-sm mt-1">
                    YOU CREATE THE MATCHROOM in eFootball
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-surface border border-border">
                <Plane className="w-5 h-5 text-foreground-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground-secondary font-bold text-sm uppercase tracking-wider">
                    AWAY — {awayTeam.name}
                  </p>
                  {awayManager && (
                    <p className="text-foreground-primary font-semibold">@{awayManager.username}</p>
                  )}
                  <p className="text-text-muted text-sm mt-1">
                    You join the matchroom
                  </p>
                </div>
              </div>
            </div>
          </details>
          </div>

          {/* Matchroom Code — editable by home manager, visible to all */}
          <MatchroomCode
            fixtureId={id}
            initialCode={(fixture as any).matchroom_code ?? null}
            isHomeManager={!!isHomeManager}
          />

          {/* Win Probability */}
          <div className="card p-5">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <BarChart3 className="w-5 h-5 text-gold" /> Win Probability
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0">
            <ProbabilityBar
              home={probability.home}
              draw={probability.draw}
              away={probability.away}
              homeName={homeTeam.name}
              awayName={awayTeam.name}
            />
            </div>
          </details>
          </div>

          {/* H2H Last 5 */}
          <div className="card p-5">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <Swords className="w-5 h-5 text-gold" /> Head to Head (Last 5)
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0">
            {h2hList.length === 0 ? (
              <p className="text-text-muted text-sm">No previous meetings.</p>
            ) : (
              <div className="space-y-2">
                {h2hList.map((f: any) => {
                  // Determine which team was home/away in this specific h2h fixture
                  const hTeam = f.home_team_id === fixture.home_team_id ? homeTeam : awayTeam
                  const aTeam = f.home_team_id === fixture.home_team_id ? awayTeam : homeTeam
                  const hScore = f.result.home_score
                  const aScore = f.result.away_score
                  // From current home team's perspective
                  const ourScore = f.home_team_id === fixture.home_team_id ? hScore : aScore
                  const theirScore = f.home_team_id === fixture.home_team_id ? aScore : hScore
                  const outcome = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D'
                  const outcomeColor =
                    outcome === 'W' ? 'text-green-400' : outcome === 'L' ? 'text-red-400' : 'text-yellow-400'

                  return (
                    <div key={f.id} className="flex items-center gap-2 p-3 rounded-lg bg-navy-border/30">
                      {/* Home team — clickable logo */}
                      <Link href={`/teams/${hTeam.id}`} className="flex items-center gap-1.5 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        {hTeam.logo_league_folder && (
                          <Image
                            src={getTeamLogo(hTeam.logo_league_folder, hTeam.logo_team_slug, 'standings_row')}
                            alt={hTeam.name}
                            width={24} height={24}
                            className="object-contain shrink-0"
                          />
                        )}
                        <span className="text-xs text-text-muted">{hTeam.name}</span>
                      </Link>

                      {/* Score — links to that fixture */}
                      <Link href={`/fixtures/${f.id}`} className="font-bold text-foreground-primary tabular-nums text-sm px-2 hover:text-gold transition-colors shrink-0">
                        {hScore} – {aScore}
                      </Link>

                      {/* Away team — clickable logo */}
                      <Link href={`/teams/${aTeam.id}`} className="flex items-center justify-end gap-1.5 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        <span className="text-xs text-text-muted text-right">{aTeam.name}</span>
                        {aTeam.logo_league_folder && (
                          <Image
                            src={getTeamLogo(aTeam.logo_league_folder, aTeam.logo_team_slug, 'standings_row')}
                            alt={aTeam.name}
                            width={24} height={24}
                            className="object-contain shrink-0"
                          />
                        )}
                      </Link>

                      {/* Outcome badge */}
                      <span className={`text-xs font-black w-5 text-center shrink-0 ${outcomeColor}`}>{outcome}</span>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </details>
          </div>

          {/* Team DNA */}
          <div className="card p-5">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <Dna className="w-5 h-5 text-gold" /> Team DNA
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  {homeTeam.name}
                </p>
                {homeDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {homeDNA.map((dna: any) => (
                      <span
                        key={dna.label}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${dna.color}`}
                      >
                        {DNA_ICONS[dna.iconName]} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground-muted text-xs">Not enough data</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  {awayTeam.name}
                </p>
                {awayDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {awayDNA.map((dna: any) => (
                      <span
                        key={dna.label}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${dna.color}`}
                      >
                        {DNA_ICONS[dna.iconName]} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground-muted text-xs">Not enough data</p>
                )}
              </div>
            </div>
            </div>
          </details>
          </div>

          {/* Form */}
          <div className="card p-5">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <TrendingUp className="w-5 h-5 text-gold" /> Recent Form (Last 6)
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-muted truncate min-w-0">{homeTeam.name}</span>
                <FormStrip form={(homeStanding?.form ?? '').slice(-6)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-muted truncate min-w-0">{awayTeam.name}</span>
                <FormStrip form={(awayStanding?.form ?? '').slice(-6)} />
              </div>
            </div>
          </details>
          </div>
        </>
      )}

      {/* ── POST-MATCH SECTIONS ───────────────────────────────────────────── */}
      {hasResult && (
        <>
          {/* Match Stats */}
          {matchStats && (
            <div className="card p-5">
              <details open className="group">
                <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                  <h2 className="section-header">
                    <BarChart3 className="w-5 h-5 text-gold" /> Match Statistics
                  </h2>
                  <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
                </summary>
                <div className="mt-4 lg:mt-0 space-y-3">
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
              <div className="flex justify-between text-xs text-text-muted mt-3 pt-3 border-t border-navy-border">
                <span className="font-semibold text-foreground-secondary">{homeTeam.name}</span>
                <span className="font-semibold text-foreground-secondary">{awayTeam.name}</span>
            </div>
          </details>
          </div>
          )}

          {/* Emoji Reactions */}
          <div className="card p-5">
            <details open className="group">
              <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
                <h2 className="section-header">
                  <MessageSquare className="w-5 h-5 text-gold" /> Reactions
                </h2>
                <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
              </summary>
              <div className="mt-4 lg:mt-0">
            <ReactionsPanel
              fixtureId={id}
              initialCounts={reactionCounts}
              initialUserReactions={userReactionEmojis}
              userId={user?.id ?? null}
            />
            </div>
          </details>
          </div>
        </>
      )}

      {/* ── RESULT CONFIRMATION STATUS ───────────────────────────────────── */}
      {!hasResult && (
        <div className="card p-5">
          <h2 className="section-header">
            <CheckCircle className="w-5 h-5 text-gold" /> Score Submission
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
                <span className="text-text-muted">{homeTeam.name}</span>
                {conf1 ? (
                  <span className="text-green-400 font-semibold">
                    Submitted: {conf1.home_score}–{conf1.away_score}
                  </span>
                ) : (
                  <span className="text-foreground-muted">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{awayTeam.name}</span>
                {conf2 ? (
                  <span className="text-green-400 font-semibold">
                    Submitted: {conf2.home_score}–{conf2.away_score}
                  </span>
                ) : (
                  <span className="text-foreground-muted">Pending</span>
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
            <Hourglass className="w-5 h-5 text-accent" /> Waiting Reports
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
            <Zap className="w-5 h-5 text-gold" /> Disconnect Rules
          </span>
          <span className="text-text-muted text-xs group-open:hidden">Tap to expand</span>
          <span className="text-text-muted text-xs hidden group-open:inline">Collapse</span>
        </summary>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gold mb-2 uppercase tracking-wider">
              Official Rules
            </h3>
            <ul className="space-y-1">
              {OFFICIAL_RULES.map((r: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                  {r.icon === 'check' ? <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : r.icon === 'cross' ? <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> : <Home className="w-4 h-4 text-gold shrink-0 mt-0.5" />}
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
                  <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-navy-border">
                    <th className="pb-2 pr-4">Minute of DC</th>
                    <th className="pb-2 pr-4">Restart</th>
                    <th className="pb-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-border/50">
                  {DISCONNECT_RULES.map((rule: any, i: number) => (
                    <tr key={i} className="text-foreground-secondary">
                      <td className="py-2 pr-4 font-semibold text-gold">{rule.minute}</td>
                      <td className="py-2 pr-4">{rule.restart}</td>
                      <td className="py-2 text-text-muted">{rule.note}</td>
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
          <MessageSquare className="w-5 h-5 text-gold" /> Banter Board
          <span className="text-text-muted text-sm font-normal ml-auto">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {topLevel.length === 0 ? (
          <p className="text-text-muted text-sm">
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
                        <span className="text-xs text-foreground-muted">
                          {new Date(comment.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground-secondary">{comment.content}</p>
                    </div>
                  </div>

                  {/* Replies */}
                  {commentReplies.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {commentReplies.map((reply: any) => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-navy-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                            {reply.author?.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 p-2.5 rounded-lg bg-navy-border/20 border border-navy-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground-secondary">
                                @{reply.author?.username ?? 'Unknown'}
                              </span>
                              <span className="text-xs text-foreground-muted">
                                {new Date(reply.created_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted">{reply.content}</p>
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
