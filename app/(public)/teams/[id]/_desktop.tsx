'use client'
import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import TeamStateBadges from '@/components/ui/TeamStateBadge'
import TeamManagerAdmin from './TeamManagerAdmin'
import ApplyManagerButton from '@/components/ui/ApplyManagerButton'
import MessageManagerButton from '@/components/ui/MessageManagerButton'
import { Card } from '@/components/ui/Card'
import { Trophy, Star, Globe, Medal, Crown, Drama, Zap, Brain, Sword, Shield, Dumbbell, ArrowLeftRight, Triangle, Crosshair, Scale, ClipboardList, UserPlus, Calendar, Flag, BarChart3, TrendingUp, User, Swords, History, ChevronRight } from 'lucide-react'

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

const LEVEL_LABELS: Record<string, { short: string; detail: string }> = {}

export default function Desktop({ data }: { data: any }) {
  const {
    team,
    manager,
    currentUser,
    isAdmin,
    isCurrentManager,
    hasPendingApplication,
    allProfiles,
    managedTeamByUser,
    trophies,
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
  } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card>
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-32 relative rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
        </div>
        <div className="px-6 pb-6 -mt-14 relative">
          <div className="flex items-end gap-6">
            <div className="bg-bg-base rounded-2xl overflow-hidden ring-1 ring-border-subtle shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
              <Image
                src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'match_detail_hero')}
                alt={team.name}
                width={112}
                height={112}
                className="object-contain w-28 h-28"
              />
            </div>
            <div className="pb-2 flex-1 min-w-0">
              <h1 className="text-3xl font-black text-text-primary truncate">{team.name}</h1>
              <div className="flex items-center gap-3 flex-wrap mt-1">
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
                {manager && currentUser && currentUser.id !== manager.id && (
                  <MessageManagerButton
                    managerId={manager.id}
                    managerUsername={manager.username}
                  />
                )}
              </div>
            </div>
          </div>

          {dnaProfiles.length > 0 && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Playstyle</h2>
              </div>

              <div className="flex items-center gap-4">
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
                {dnaProfiles.length > 0 && (() => {
                  const lvlInfo = LEVEL_LABELS[dnaProfiles[0].level]
                  return lvlInfo ? (
                    <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-2">
                      <span className={`font-mono font-bold text-lg ${levelColor(dnaProfiles[0].level)}`}>{dnaProfiles[0].level}</span>
                      <div>
                        <p className="text-text-primary text-sm font-semibold">{lvlInfo.short}</p>
                        <p className="text-text-muted text-xs mt-0.5">{lvlInfo.detail}</p>
                      </div>
                    </div>
                  ) : null
                })()}
              </div>

              {dnaDescription?.about && (
                <Card className="p-5">
                  <p className="text-text-secondary text-sm leading-relaxed">{dnaDescription.about}</p>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                {dnaDescription?.tendencies && dnaDescription.tendencies.length > 0 && (
                  <Card className="p-5 space-y-3">
                    <h3 className="font-semibold text-text-primary text-sm">
                      {isCurrentManager ? 'Your Tendencies' : 'What to Expect'}
                    </h3>
                    <ul className="space-y-1.5">
                      {dnaDescription.tendencies.map((t: string, i: number) => (
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
                {dnaDescription?.weaknesses && dnaDescription.weaknesses.length > 0 && (
                  <Card className="p-5 space-y-3">
                    <h3 className={`font-semibold text-sm text-red-400`}>
                      {isCurrentManager ? 'Vulnerabilities to Watch' : 'How to Exploit Their Weaknesses'}
                    </h3>
                    <ul className="space-y-1.5">
                      {dnaDescription.weaknesses.map((w: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="text-red-400 shrink-0 mt-0.5">{isCurrentManager ? '⚠' : '⚡'}</span>
                          {isCurrentManager ? w : perspectivize(w)}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>

              {teamStates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-text-primary font-semibold text-sm">Form Indicators</h3>
                  <TeamStateBadges states={teamStates} />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {managerNotes.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Manager Observations</h2>
          </div>
          <div className="space-y-2">
            {managerNotes.map((note: any, i: number) => {
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

      {isAdmin && (
        <TeamManagerAdmin
          teamId={team.id}
          currentManagerId={team.manager_id ?? null}
          currentManagerUsername={manager?.username ?? null}
          currentManagerAvatar={manager?.avatar_url ?? null}
          allProfiles={allProfiles}
          managedTeamByUser={managedTeamByUser}
        />
      )}

      {currentUser && !isAdmin && !isCurrentManager && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Management Application</h2>
          </div>
          <p className="text-sm text-text-secondary">
            {(team as any).manager_id
              ? 'This club currently has a manager. You can still apply — if approved, the current manager will be replaced.'
              : 'This club has no manager. Apply to take charge.'}
          </p>
          <ApplyManagerButton
            teamId={team.id}
            teamName={team.name}
            hasPending={hasPendingApplication}
          />
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Upcoming Fixtures</h2>
          </div>
          <Link href={`/teams/${team.id}/fixtures`} className="flex items-center gap-1 text-xs text-accent font-medium">
            All fixtures <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!upcomingFixtures?.length ? (
          <p className="text-text-muted text-sm text-center py-4">No upcoming fixtures scheduled.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Opponent</th>
                  <th className="pb-3 pr-4">Competition</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(upcomingFixtures as any[]).map((f: any) => {
                  const isHome = allTeamIds.includes(f.home_team?.id)
                  const opponent = isHome ? f.away_team : f.home_team
                  const dateStr = f.scheduled_date
                    ? new Date(f.scheduled_date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })
                    : 'TBD'
                  return (
                    <tr key={f.id} className="hover:bg-accent/5 transition-colors">
                      <td className="py-3 pr-4 min-w-0">
                        <Link href={`/fixtures/${f.id}`} className="flex items-center gap-3">
                          {opponent?.logo_league_folder ? (
                            <TeamLogo
                              leagueFolder={opponent.logo_league_folder}
                              teamSlug={opponent.logo_team_slug}
                              context="standings_row"
                              alt={opponent.name}
                              className="w-7 h-7 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-xl bg-bg-base flex items-center justify-center text-xs text-text-muted shrink-0">?</div>
                          )}
                          <span className="font-medium text-text-primary truncate">
                            <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span> {opponent?.name ?? 'TBD'}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">{f.tournament?.name}</td>
                      <td className="py-3 pr-4 text-text-primary font-medium">{dateStr}</td>
                      <td className="py-3">
                        {f.status === 'awaiting_confirmation' ? (
                          <span className="text-xs text-feedback-warning font-semibold">Pending</span>
                        ) : (
                          <span className="text-xs text-text-muted">Scheduled</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Recent Results</h2>
          </div>
          <Link href={`/teams/${team.id}/fixtures`} className="flex items-center gap-1 text-xs text-accent font-medium">
            All results <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {!sortedRecentResults?.length ? (
          <p className="text-text-muted text-sm text-center py-4">No results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Outcome</th>
                  <th className="pb-3 pr-4">Opponent</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3">Competition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
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
                    ? new Date(f.scheduled_date).toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })
                    : '—'
                  return (
                    <tr key={f.id} className="hover:bg-accent/5 transition-colors">
                      <td className="py-3 pr-4">
                        <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center text-xs font-black ${
                          won ? 'bg-feedback-success/15 text-feedback-success' : drew ? 'bg-feedback-warning/15 text-feedback-warning' : 'bg-feedback-error/15 text-feedback-error'
                        }`}>
                          {outcomeLetter}
                        </span>
                      </td>
                      <td className="py-3 pr-4 min-w-0">
                        <Link href={`/fixtures/${f.id}`} className="flex items-center gap-3">
                          {opponent?.logo_league_folder ? (
                            <TeamLogo
                              leagueFolder={opponent.logo_league_folder}
                              teamSlug={opponent.logo_team_slug}
                              context="standings_row"
                              alt={opponent.name}
                              className="w-7 h-7 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-xl bg-bg-base flex items-center justify-center text-xs text-text-muted shrink-0">?</div>
                          )}
                          <span className="font-medium text-text-primary truncate">
                            <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span> {opponent?.name ?? 'Unknown'}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-bold tabular-nums ${outcomeColor}`}>
                          {myScore}–{theirScore}
                        </span>
                      </td>
                      <td className="py-3 text-text-secondary">
                        <div>{f.tournament?.name}</div>
                        <div className="text-xs text-text-muted">{dateStr}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">
            Season Statistics
          </h2>
          {currentStanding?.tournament?.name && (
            <span className="text-xs text-text-muted font-normal ml-1">· {currentStanding.tournament.name}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3">
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
            <div key={label} className="text-center p-3.5 rounded-xl bg-bg-elevated/50 border border-border/50 hover:border-accent/20 transition-colors shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]">
              <p className="text-xl font-black text-text-primary tabular-nums">{value}</p>
              <p className="text-xs text-text-muted font-semibold mt-0.5 tracking-wide uppercase">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Clean Sheets:</span>
            <span className="font-bold text-text-primary">{totalCleanSheets}</span>
          </div>
          {biggestWin?.biggest_win_score && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted">Biggest Win:</span>
              <span className="font-bold text-feedback-success">{biggestWin.biggest_win_score}</span>
            </div>
          )}
          {unbeatenRun > 0 && (
            <span className="inline-flex items-center gap-1 bg-feedback-success/10 border border-feedback-success/20 text-feedback-success text-xs font-bold px-2.5 py-0.5 rounded-full">
              {unbeatenRun}-game unbeaten run
            </span>
          )}
        </div>
      </Card>

      {currentForm && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Recent Form</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">Last 6</span>
            <FormStrip form={currentForm} />
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Trophy Cabinet</h2>
        </div>
        {(trophies ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">No trophies yet. Glory awaits.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(trophies ?? []).map((trophy: any) => (
              <div
                key={trophy.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors"
              >
                {(() => {
                  const iconName = TROPHY_ICON[trophy.trophy_type] ?? 'trophy'
                  const Icon = iconName === 'trophy' ? Trophy : iconName === 'star' ? Star : iconName === 'globe' ? Globe : Medal
                  return <Icon className="w-10 h-10 text-accent shrink-0" />
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

      {data.standings?.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Season History</h2>
          </div>
          <div className="space-y-3">
            {[...(data.standings as any[])]
              .sort((a: any, b: any) => {
                if (a.tournament?.status === 'active' && b.tournament?.status !== 'active') return -1
                if (b.tournament?.status === 'active' && a.tournament?.status !== 'active') return 1
                return 0
              })
              .map((s: any) => (
                <div key={s.id} className="p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">
                      {s.tournament?.name ?? 'Tournament'}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.tournament?.status === 'active'
                        ? 'bg-feedback-success/15 text-feedback-success'
                        : 'bg-text-muted/15 text-text-muted'
                    }`}>
                      {s.tournament?.status === 'active' ? 'Current' : 'Completed'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-3 text-center text-xs">
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
                        <p className="font-bold text-text-primary tabular-nums">{val ?? 0}</p>
                        <p className="text-text-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {(tenures ?? []).length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Manager History</h2>
          </div>
          <div className="space-y-3">
            {(tenures as any[]).map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              return (
                <div
                  key={tenure.id}
                  className={`rounded-xl border p-4 ${
                    isCurrent
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border bg-bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${
                      isCurrent ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'bg-bg-elevated text-text-muted ring-1 ring-border-subtle'
                    }`}>
                      {(tenure.manager_username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-text-primary">@{tenure.manager_username}</p>
                        {isCurrent && (
                          <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded-full font-semibold">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-muted mt-0.5">
                        {new Date(tenure.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {tenure.ended_at
                          ? ` → ${new Date(tenure.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ' → Present'}
                      </p>
                    </div>
                    <div className="flex gap-5 shrink-0 text-center">
                      <div>
                        <p className="text-lg font-black text-feedback-success tabular-nums">{tenure.wins}</p>
                        <p className="text-xs text-text-muted font-medium">Wins</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-feedback-warning tabular-nums">{tenure.draws}</p>
                        <p className="text-xs text-text-muted font-medium">Draws</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-feedback-error tabular-nums">{tenure.losses}</p>
                        <p className="text-xs text-text-muted font-medium">Losses</p>
                      </div>
                      {played > 0 && (
                        <div>
                          <p className="text-lg font-black text-text-secondary tabular-nums">{played}</p>
                          <p className="text-xs text-text-muted font-medium">Played</p>
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

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Head-to-Head Record</h2>
        </div>
        {h2hEntries.length === 0 ? (
          <p className="mt-2 text-text-muted text-sm">No completed matches on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Opponent</th>
                  <th className="pb-3 text-center pr-3">P</th>
                  <th className="pb-3 text-center pr-3">W</th>
                  <th className="pb-3 text-center pr-3">D</th>
                  <th className="pb-3 text-center pr-3">L</th>
                  <th className="pb-3 text-center">GF–GA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {h2hEntries.map(([oppId, rec]: [string, any]) => (
                  <tr key={oppId} className="hover:bg-accent/5 transition-colors">
                    <td className="py-3 pr-4 font-medium min-w-0">
                      <Link
                        href={`/teams/${oppId}`}
                        className="hover:text-accent transition-colors truncate block"
                      >
                        {rec.name}
                      </Link>
                    </td>
                    <td className="py-3 text-center tabular-nums">{rec.played}</td>
                    <td className="py-3 text-center text-feedback-success font-semibold tabular-nums">{rec.wins}</td>
                    <td className="py-3 text-center text-feedback-warning font-semibold tabular-nums">{rec.draws}</td>
                    <td className="py-3 text-center text-feedback-error font-semibold tabular-nums">{rec.losses}</td>
                    <td className="py-3 text-center text-text-muted tabular-nums">
                      {rec.gf}–{rec.ga}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
