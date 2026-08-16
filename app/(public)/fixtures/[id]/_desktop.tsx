'use client'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import { DISCONNECT_RULES, OFFICIAL_RULES } from '@/lib/disconnect-rules'
import MatchroomCode from '@/components/ui/MatchroomCode'
import ReactionsPanel from '@/components/ui/ReactionsPanel'
import ForfeitBadge from '@/components/ui/ForfeitBadge'
import {
  Gamepad2, Home, Plane, BarChart3, Swords, Dna, TrendingUp,
  MessageSquare, CheckCircle, Hourglass, Zap, Check, X,
  Crown, Drama, Brain, Shield, Dumbbell,
  ArrowLeftRight, Triangle, Crosshair, Scale,
} from 'lucide-react'

const DNA_ICONS: Record<string, React.ReactNode> = {
  crown: <Crown className="w-3.5 h-3.5" />,
  theater: <Drama className="w-3.5 h-3.5" />,
  zap: <Zap className="w-3.5 h-3.5" />,
  brain: <Brain className="w-3.5 h-3.5" />,
  dagger: <Swords className="w-3.5 h-3.5" />,
  shield: <Shield className="w-3.5 h-3.5" />,
  muscle: <Dumbbell className="w-3.5 h-3.5" />,
  arrows_horizontal: <ArrowLeftRight className="w-3.5 h-3.5" />,
  triangle: <Triangle className="w-3.5 h-3.5" />,
  target: <Crosshair className="w-3.5 h-3.5" />,
  scale: <Scale className="w-3.5 h-3.5" />,
}

function StatBar({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const h = home ?? 0
  const a = away ?? 0
  const total = h + a || 1
  const homePct = Math.round((h / total) * 100)
  const awayPct = 100 - homePct

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span className="font-semibold text-text-primary tabular-nums">{h}</span>
        <span className="uppercase tracking-wider">{label}</span>
        <span className="font-semibold text-text-primary tabular-nums">{a}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
        <div className="bg-accent transition-all duration-500" style={{ width: `${homePct}%` }} />
        <div className="bg-bg-elevated transition-all duration-500" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  )
}

function ProbabilityBar({ home, draw, away, homeName, awayName }: { home: number; draw: number; away: number; homeName: string; awayName: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm font-semibold">
        <span className="text-feedback-success tabular-nums">{home}%</span>
        <span className="text-text-muted">{draw}% Draw</span>
        <span className="text-accent tabular-nums">{away}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div className="bg-feedback-success rounded-l-full transition-all duration-700" style={{ width: `${home}%` }} title={`${homeName} win ${home}%`} />
        <div className="bg-text-muted transition-all duration-700" style={{ width: `${draw}%` }} title={`Draw ${draw}%`} />
        <div className="bg-accent rounded-r-full transition-all duration-700" style={{ width: `${away}%` }} title={`${awayName} win ${away}%`} />
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
    id, fixture, result, matchStats, homeTeam, awayTeam, tournament,
    homeManager, awayManager, user, isHomeManager, isAwayManager, isManager,
    probability, h2hList, homeDNA, awayDNA, homeStanding, awayStanding,
    confirmationStatus, conf1, conf2, hasResult, waitingReports,
    reactionCounts, userReactionEmojis, comments, topLevel, replies,
    homeCoachNote, awayCoachNote,
  } = data

  const matchStatEntries = matchStats ? [
    { label: 'Possession %', home: matchStats.home_possession, away: matchStats.away_possession },
    { label: 'Shots', home: matchStats.home_shots, away: matchStats.away_shots },
    { label: 'Shots on Target', home: matchStats.home_shots_on_target, away: matchStats.away_shots_on_target },
    { label: 'Passes', home: matchStats.home_passes, away: matchStats.away_passes },
    { label: 'Successful Passes', home: matchStats.home_successful_passes, away: matchStats.away_successful_passes },
    { label: 'Crosses', home: matchStats.home_crosses, away: matchStats.away_crosses },
    { label: 'Corners', home: matchStats.home_corners, away: matchStats.away_corners },
    { label: 'Fouls', home: matchStats.home_fouls, away: matchStats.away_fouls },
    { label: 'Saves', home: matchStats.home_saves, away: matchStats.away_saves },
    { label: 'Interceptions', home: matchStats.home_interceptions, away: matchStats.away_interceptions },
    { label: 'Tackles', home: matchStats.home_tackles, away: matchStats.away_tackles },
  ] : []

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-bg-surface border border-border rounded-2xl p-8 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
        <div className="text-center mb-6">
          <span className="text-sm font-medium text-accent uppercase tracking-widest">
            {tournament?.name ?? 'Match'} · Matchday {fixture.matchday}
          </span>
          {fixture.scheduled_date && (
            <p className="text-text-muted text-sm mt-1">
              {new Date(fixture.scheduled_date).toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>

        {hasResult ? (
          <div className="flex items-center justify-center gap-10">
            <Link href={`/teams/${homeTeam.id}`} className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group flex-1 max-w-xs">
              <TeamLogo leagueFolder={homeTeam.logo_league_folder} teamSlug={homeTeam.logo_team_slug} context="match_detail_hero" alt={homeTeam.name} className="w-16 h-16 group-hover:scale-105 transition-transform" />
              <div className="text-center">
                <p className="font-bold text-text-primary text-lg">{homeTeam.name}</p>
                <p className="text-sm text-text-muted">{homeManager?.username ?? '—'}</p>
              </div>
            </Link>
            <div className="flex items-center gap-5">
              <span className="text-6xl font-black text-text-primary tabular-nums">{result.home_score}</span>
              <span className="text-3xl font-bold text-text-muted">–</span>
              <span className="text-6xl font-black text-text-primary tabular-nums">{result.away_score}</span>
            </div>
            {(data.aggregateScore || data.penScore) && (
              <div className="text-center mt-2 space-y-0.5">
                {data.aggregateScore && (
                  <p className="text-sm text-text-muted font-semibold">
                    AGG {data.aggregateScore.home} – {data.aggregateScore.away}
                  </p>
                )}
                {data.penScore && (
                  <p className="text-xs text-text-muted/70 font-medium">
                    pens {data.penScore.home} – {data.penScore.away}
                  </p>
                )}
              </div>
            )}
            <Link href={`/teams/${awayTeam.id}`} className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group flex-1 max-w-xs">
              <TeamLogo leagueFolder={awayTeam.logo_league_folder} teamSlug={awayTeam.logo_team_slug} context="match_detail_hero" alt={awayTeam.name} className="w-16 h-16 group-hover:scale-105 transition-transform" />
              <div className="text-center">
                <p className="font-bold text-text-primary text-lg">{awayTeam.name}</p>
                <p className="text-sm text-text-muted">{awayManager?.username ?? '—'}</p>
              </div>
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-10">
            <Link href={`/teams/${homeTeam.id}`} className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group flex-1 max-w-xs">
              <TeamLogo leagueFolder={homeTeam.logo_league_folder} teamSlug={homeTeam.logo_team_slug} context="match_detail_hero" alt={homeTeam.name} className="w-16 h-16 group-hover:scale-105 transition-transform" />
              <div className="text-center">
                <p className="font-bold text-text-primary text-lg">{homeTeam.name}</p>
                <p className="text-sm text-text-muted">{homeManager?.username ?? '—'}</p>
              </div>
            </Link>
            <div className="text-center">
              <span className="text-5xl font-black text-text-muted tracking-widest">VS</span>
            </div>
            <Link href={`/teams/${awayTeam.id}`} className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity group flex-1 max-w-xs">
              <TeamLogo leagueFolder={awayTeam.logo_league_folder} teamSlug={awayTeam.logo_team_slug} context="match_detail_hero" alt={awayTeam.name} className="w-16 h-16 group-hover:scale-105 transition-transform" />
              <div className="text-center">
                <p className="font-bold text-text-primary text-lg">{awayTeam.name}</p>
                <p className="text-sm text-text-muted">{awayManager?.username ?? '—'}</p>
              </div>
            </Link>
          </div>
        )}

        {result?.is_abandoned && (
          <div className="mt-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block bg-feedback-error/10 text-feedback-error border border-feedback-error/30 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                Abandoned —{' '}
                {result.abandoned_type === 'home' ? homeTeam.name : result.abandoned_type === 'away' ? awayTeam.name : 'Both teams'} left
              </span>
              <ForfeitBadge note={`Forfeit: ${result.abandoned_type === 'home' || result.abandoned_type === 'both' ? homeTeam.name : ''}${result.abandoned_type === 'both' ? ' & ' : ''}${result.abandoned_type === 'away' || result.abandoned_type === 'both' ? awayTeam.name : ''} forfeited. Score at time: ${result.home_score}-${result.away_score}. This penalty was applied to the aggregate.`} />
            </div>
          </div>
        )}
      </div>

      {!hasResult && (
        <>
          {isManager && (homeCoachNote || awayCoachNote) && (
            <div className="bg-bg-surface border border-accent/20 rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Coach&apos;s Analysis</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {isHomeManager && homeCoachNote && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{homeTeam.name} — vs {awayTeam.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Confidence:</span>
                      <span className={`font-mono font-bold text-sm ${homeCoachNote.confidence.startsWith('+') ? 'text-feedback-success' : 'text-feedback-error'}`}>{homeCoachNote.confidence}</span>
                    </div>
                    {homeCoachNote.opponent_will_exploit?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-feedback-error uppercase tracking-wider mb-1.5">{awayTeam.name} will exploit</h4>
                        <ul className="space-y-1">
                          {homeCoachNote.opponent_will_exploit.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary"><span className="text-feedback-error shrink-0 mt-0.5">⚠</span>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {homeCoachNote.recommendations?.length > 0 && (
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">Recommendation</h4>
                        <ul className="space-y-1">
                          {homeCoachNote.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary"><span className="text-accent shrink-0 mt-0.5">›</span>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {isAwayManager && awayCoachNote && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{awayTeam.name} — vs {homeTeam.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Confidence:</span>
                      <span className={`font-mono font-bold text-sm ${awayCoachNote.confidence.startsWith('+') ? 'text-feedback-success' : 'text-feedback-error'}`}>{awayCoachNote.confidence}</span>
                    </div>
                    {awayCoachNote.opponent_will_exploit?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-feedback-error uppercase tracking-wider mb-1.5">{homeTeam.name} will exploit</h4>
                        <ul className="space-y-1">
                          {awayCoachNote.opponent_will_exploit.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary"><span className="text-feedback-error shrink-0 mt-0.5">⚠</span>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {awayCoachNote.recommendations?.length > 0 && (
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">Recommendation</h4>
                        <ul className="space-y-1">
                          {awayCoachNote.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary"><span className="text-accent shrink-0 mt-0.5">›</span>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-bg-surface border border-accent/20 rounded-2xl p-6 bg-bg-elevated shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Matchroom Instructions</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-4 p-5 rounded-xl bg-accent/10 border border-accent/20 hover:bg-accent/15 transition-colors">
                <Home className="w-6 h-6 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-accent font-bold text-sm uppercase tracking-wider">HOME — {homeTeam.name}</p>
                  {homeManager && <p className="text-text-primary font-semibold">@{homeManager.username}</p>}
                  <p className="text-text-secondary text-sm mt-2">YOU CREATE THE MATCHROOM in eFootball</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-bg-elevated/50 border border-border hover:bg-bg-elevated transition-colors">
                <Plane className="w-6 h-6 text-text-secondary shrink-0 mt-0.5" />
                <div>
                  <p className="text-text-secondary font-bold text-sm uppercase tracking-wider">AWAY — {awayTeam.name}</p>
                  {awayManager && <p className="text-text-primary font-semibold">@{awayManager.username}</p>}
                  <p className="text-text-muted text-sm mt-2">You join the matchroom</p>
                </div>
              </div>
            </div>
          </div>

          <MatchroomCode fixtureId={id} initialCode={(fixture as any).matchroom_code ?? null} isHomeManager={!!isHomeManager} />

          <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Win Probability</h2>
            </div>
            <ProbabilityBar home={probability.home} draw={probability.draw} away={probability.away} homeName={homeTeam.name} awayName={awayTeam.name} />
          </div>

          <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <Swords className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Head to Head (Last 5)</h2>
            </div>
            {h2hList.length === 0 ? (
              <p className="text-text-muted text-sm">No previous meetings.</p>
            ) : (
              <div className="space-y-2">
                {h2hList.map((f: any) => {
                  const hTeam = f.home_team_id === fixture.home_team_id ? homeTeam : awayTeam
                  const aTeam = f.home_team_id === fixture.home_team_id ? awayTeam : homeTeam
                  const hScore = f.result.home_score
                  const aScore = f.result.away_score
                  const ourScore = f.home_team_id === fixture.home_team_id ? hScore : aScore
                  const theirScore = f.home_team_id === fixture.home_team_id ? aScore : hScore
                  const outcome = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D'
                  const outcomeColor = outcome === 'W' ? 'text-feedback-success' : outcome === 'L' ? 'text-feedback-error' : 'text-feedback-warning'

                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated/30 hover:bg-bg-elevated/50 transition-colors">
                      <Link href={`/teams/${hTeam.id}`} className="flex items-center gap-1.5 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        {hTeam.logo_league_folder && (
                          <TeamLogo leagueFolder={hTeam.logo_league_folder} teamSlug={hTeam.logo_team_slug} context="standings_row" alt={hTeam.name} className="w-6 h-6 shrink-0" />
                        )}
                        <span className="text-xs text-text-muted truncate">{hTeam.name}</span>
                      </Link>
                      <Link href={`/fixtures/${f.id}`} className="font-bold text-text-primary tabular-nums text-sm px-3 hover:text-accent transition-colors shrink-0">
                        {hScore} – {aScore}
                      </Link>
                      <Link href={`/teams/${aTeam.id}`} className="flex items-center justify-end gap-1.5 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        <span className="text-xs text-text-muted text-right truncate">{aTeam.name}</span>
                        {aTeam.logo_league_folder && (
                          <TeamLogo leagueFolder={aTeam.logo_league_folder} teamSlug={aTeam.logo_team_slug} context="standings_row" alt={aTeam.name} className="w-6 h-6 shrink-0" />
                        )}
                      </Link>
                      <span className={`text-xs font-black w-5 text-center shrink-0 ${outcomeColor}`}>{outcome}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <Dna className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Team DNA</h2>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-bg-elevated/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{homeTeam.name}</p>
                {homeDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {homeDNA.map((dna: any) => (
                      <span key={dna.label} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border hover:scale-105 transition-transform ${dna.color}`}>
                        {DNA_ICONS[dna.iconName]} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-xs">Not enough data</p>
                )}
              </div>
              <div className="bg-bg-elevated/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{awayTeam.name}</p>
                {awayDNA.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {awayDNA.map((dna: any) => (
                      <span key={dna.label} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border hover:scale-105 transition-transform ${dna.color}`}>
                        {DNA_ICONS[dna.iconName]} {dna.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-xs">Not enough data</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Recent Form (Last 6)</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-bg-elevated/30">
                <span className="text-sm text-text-muted truncate min-w-0">{homeTeam.name}</span>
                <FormStrip form={(homeStanding?.form ?? '').slice(-6)} />
              </div>
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-bg-elevated/30">
                <span className="text-sm text-text-muted truncate min-w-0">{awayTeam.name}</span>
                <FormStrip form={(awayStanding?.form ?? '').slice(-6)} />
              </div>
            </div>
          </div>
        </>
      )}

      {hasResult && (
        <>
          {matchStats && (
            <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Match Statistics</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {matchStatEntries.map((stat) => (
                  <StatBar key={stat.label} label={stat.label} home={stat.home} away={stat.away} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-text-muted mt-4 pt-4 border-t border-border">
                <span className="font-semibold text-text-secondary">{homeTeam.name}</span>
                <span className="font-semibold text-text-secondary">{awayTeam.name}</span>
              </div>
            </div>
          )}

          <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Reactions</h2>
            </div>
            <ReactionsPanel fixtureId={id} initialCounts={reactionCounts} initialUserReactions={userReactionEmojis} userId={user?.id ?? null} />
          </div>
        </>
      )}

      {!hasResult && (
        <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Score Submission</h2>
          </div>

          {confirmationStatus === 'awaiting_confirmation' && (
            <div className="p-4 rounded-xl bg-feedback-success/10 border border-feedback-success/30 text-feedback-success text-sm font-medium">
              Both scores match! Waiting for admin to finalise.
            </div>
          )}

          {confirmationStatus === 'scores_mismatch' && (
            <div className="p-4 rounded-xl bg-feedback-error/10 border border-feedback-error/30 text-feedback-error text-sm font-medium">
              Scores don&apos;t match. Please contact an admin to resolve.
            </div>
          )}

          {confirmationStatus === 'pending' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{homeTeam.name}</span>
                {conf1 ? (
                  <span className="text-feedback-success font-semibold">Submitted: {conf1.home_score}–{conf1.away_score}</span>
                ) : (
                  <span className="text-text-muted">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{awayTeam.name}</span>
                {conf2 ? (
                  <span className="text-feedback-success font-semibold">Submitted: {conf2.home_score}–{conf2.away_score}</span>
                ) : (
                  <span className="text-text-muted">Pending</span>
                )}
              </div>
            </div>
          )}

          {isManager && !hasResult && (
            <div className="mt-4">
              <Link
                href={`/fixtures/${id}/submit`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-bg-base rounded-xl px-5 py-2.5 hover:bg-accent/90 transition-colors shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)]"
              >
                Submit Score
              </Link>
            </div>
          )}
        </div>
      )}

      {waitingReports && waitingReports.length > 0 && (
        <div className="bg-bg-surface border border-feedback-warning/30 rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Hourglass className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Waiting Reports</h2>
          </div>
          <p className="text-sm text-feedback-warning">{waitingReports.length} team(s) have reported waiting for their opponent to be ready.</p>
        </div>
      )}

      <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Disconnect Rules</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-accent mb-3 uppercase tracking-wider">Official Rules</h3>
            <ul className="space-y-1.5">
              {OFFICIAL_RULES.map((r: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
                  {r.icon === 'check' ? <Check className="w-4 h-4 text-feedback-success shrink-0 mt-0.5" /> : r.icon === 'cross' ? <X className="w-4 h-4 text-feedback-error shrink-0 mt-0.5" /> : <Home className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
                  <span>{r.rule}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-accent mb-3 uppercase tracking-wider">Disconnect Restart Table</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-2 pr-4">Minute of DC</th>
                  <th className="pb-2 pr-4">Restart</th>
                  <th className="pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {DISCONNECT_RULES.map((rule: any, i: number) => (
                  <tr key={i} className="text-text-secondary hover:bg-accent/5 transition-colors">
                    <td className="py-2 pr-4 font-semibold text-accent">{rule.minute}</td>
                    <td className="py-2 pr-4">{rule.restart}</td>
                    <td className="py-2 text-text-muted">{rule.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-bg-surface border border-border rounded-2xl p-6 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Banter Board</h2>
          </div>
          <span className="text-sm text-text-muted">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
        </div>

        {topLevel.length === 0 ? (
          <p className="text-text-muted text-sm">No comments yet. Be the first to drop some banter.</p>
        ) : (
          <div className="space-y-4">
            {topLevel.map((comment: any) => {
              const commentReplies = replies.filter((r: any) => r.parent_id === comment.id)
              return (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-accent shrink-0">
                      {comment.author?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-bg-elevated/40">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-accent">@{comment.author?.username ?? 'Unknown'}</span>
                        <span className="text-xs text-text-muted">{new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <p className="text-sm text-text-secondary">{comment.content}</p>
                    </div>
                  </div>
                  {commentReplies.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {commentReplies.map((reply: any) => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                            {reply.author?.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 p-2.5 rounded-xl bg-bg-elevated/20 border border-border/50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-text-secondary">@{reply.author?.username ?? 'Unknown'}</span>
                              <span className="text-xs text-text-muted">{new Date(reply.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
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
          <div className="mt-4 pt-4 border-t border-border">
            <form action={`/api/comments`} method="post">
              <input type="hidden" name="fixture_id" value={id} />
              <div className="flex gap-3">
                <input
                  type="text"
                  name="content"
                  placeholder="Drop your banter here..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-bg-elevated/50 border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
                />
                <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-accent text-bg-base rounded-xl px-5 py-2.5 hover:bg-accent/90 transition-colors shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)] shrink-0">
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
