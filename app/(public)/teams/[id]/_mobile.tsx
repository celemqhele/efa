'use client'
import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamLogo from '@/components/ui/TeamLogo'
import { FormStrip } from '@/components/ui/FormBadge'
import type { DNAProfile, PersonalizedDescription } from '@/lib/dna-engine'
import type { TeamState } from '@/lib/team-states'
import TeamStateBadges from '@/components/ui/TeamStateBadge'
import type { ManagerNote } from '@/lib/manager-notes'
import TeamManagerAdmin from './TeamManagerAdmin'
import MessageManagerButton from '@/components/ui/MessageManagerButton'
import { Card } from '@/components/ui/Card'
import { Trophy, Star, Globe, Medal, Crown, Drama, Zap, Brain, Shield, Dumbbell, ArrowLeftRight, Triangle, Crosshair, Scale, ClipboardList, Calendar, Flag, BarChart3, TrendingUp, User, Swords, History } from 'lucide-react'

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
  dagger: <Swords className="w-4 h-4" />,
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

export default function Mobile({ data }: { data: any }) {
  const {
    team,
    manager,
    currentUser,
    isAdmin,
    isCurrentManager,
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
    <div className="px-4 pb-8 space-y-5">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-20 relative rounded-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
      </div>
      <div className="-mt-12 relative flex flex-col items-center text-center px-4">
        <div className="bg-bg-base rounded-lg overflow-hidden -mt-4 mb-3">
          <Image
            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'match_detail_hero')}
            alt={team.name}
            width={80}
            height={80}
            className="object-contain w-20 h-20"
          />
        </div>
        <h1 className="text-lg font-black text-text-primary">{team.name}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
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
              managerPhone={manager.phone ?? null}
            />
          )}
        </div>
      </div>

      {/* ── DNA Playstyle ── */}
      {dnaProfiles.length > 0 && (
        <div className="space-y-4">
          <h2 className="section-header">
            <Crown className="w-4 h-4 text-accent" /> Playstyle
          </h2>

          {/* Profile badge card */}
          <Card className="p-4">
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
          </Card>

          {/* Level info card */}
          {dnaProfiles.length > 0 && (() => {
            const lvlInfo = LEVEL_LABELS[dnaProfiles[0].level]
            return lvlInfo ? (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <span className={`font-mono font-bold text-lg ${levelColor(dnaProfiles[0].level)}`}>{dnaProfiles[0].level}</span>
                  <div>
                    <p className="text-text-primary text-sm font-semibold">{lvlInfo.short}</p>
                    <p className="text-text-muted text-xs mt-0.5">{lvlInfo.detail}</p>
                  </div>
                </div>
              </Card>
            ) : null
          })()}

          {/* About card */}
          {dnaDescription?.about && (
            <Card className="p-4">
              <p className="text-text-secondary text-sm leading-relaxed">{dnaDescription.about}</p>
            </Card>
          )}

          {/* Tendencies card */}
          {dnaDescription?.tendencies && dnaDescription.tendencies.length > 0 && (
            <Card className="p-4 space-y-3">
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

          {/* Weaknesses card */}
          {dnaDescription?.weaknesses && dnaDescription.weaknesses.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className={`font-semibold text-sm ${isCurrentManager ? 'text-red-400' : 'text-red-400'}`}>
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

          {/* Form States */}
          {teamStates.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-text-primary font-semibold text-sm">Form Indicators</h3>
              <TeamStateBadges states={teamStates} />
            </div>
          )}
        </div>
      )}

      {/* ── Manager Observations ── */}
      {managerNotes.length > 0 && (
        <Card className="p-4">
          <h2 className="section-header mb-3">
            <ClipboardList className="w-4 h-4 text-accent" /> Manager Observations
          </h2>
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

      {/* ── Admin Manager Controls ── */}
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

      {/* ── Upcoming Fixtures ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header mb-0">
            <Calendar className="w-4 h-4 text-accent" /> Upcoming Fixtures
          </h2>
          <Link href={`/teams/${team.id}/fixtures`} className="text-xs text-accent hover:text-accent-hover transition-colors">
            All fixtures →
          </Link>
        </div>
        {!upcomingFixtures?.length ? (
          <p className="text-text-muted text-sm text-center py-4">No upcoming fixtures scheduled.</p>
        ) : (
          <div className="divide-y divide-border">
            {(upcomingFixtures as any[]).map((f: any) => {
              const isHome = allTeamIds.includes(f.home_team?.id)
              const opponent = isHome ? f.away_team : f.home_team
              const dateStr = f.scheduled_date
                ? new Date(f.scheduled_date).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })
                : 'TBD'
              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="flex items-center gap-3 py-3 min-h-[48px] hover:bg-bg-base/50 transition-colors"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'TBD'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted truncate">{f.tournament?.name}</span>
                      {f.status === 'awaiting_confirmation' && (
                        <span className="text-[10px] text-feedback-warning font-semibold px-1.5 py-0.5 rounded-full bg-feedback-warning/10">Pending</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-text-primary">{dateStr}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Recent Results ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header mb-0">
            <Flag className="w-4 h-4 text-accent" /> Recent Results
          </h2>
          <Link href={`/teams/${team.id}/fixtures`} className="text-xs text-accent hover:text-accent-hover transition-colors">
            All results →
          </Link>
        </div>
        {!sortedRecentResults?.length ? (
          <p className="text-text-muted text-sm text-center py-4">No results yet.</p>
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
                ? new Date(f.scheduled_date).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })
                : '—'
              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="flex items-center gap-3 py-3 min-h-[48px] hover:bg-bg-base/50 transition-colors"
                >
                  <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-black shrink-0 ${
                    won ? 'bg-feedback-success/20 text-feedback-success' : drew ? 'bg-feedback-warning/20 text-feedback-warning' : 'bg-feedback-error/20 text-feedback-error'
                  }`}>
                    {outcomeLetter}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      <span className="text-text-muted font-normal">{isHome ? 'vs' : '@'}</span>{' '}
                      {opponent?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-text-muted truncate">{f.tournament?.name} · {dateStr}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-black tabular-nums ${outcomeColor}`}>
                      {myScore}–{theirScore}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Season Stats ── */}
      <Card className="p-4">
        <h2 className="section-header">
          <BarChart3 className="w-4 h-4 text-accent" /> Season Statistics
          {currentStanding?.tournament?.name && (
            <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">
              {currentStanding.tournament.name}
            </span>
          )}
        </h2>
        <div className="-mx-4 overflow-x-auto snap-x snap-mandatory scrollbar-none">
          <div className="flex gap-3 px-4 w-max">
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
              <div key={label} className="snap-start shrink-0 w-[90px] text-center p-3 rounded-lg bg-border-subtle/30">
                <p className="text-xl font-black text-text-primary">{value}</p>
                <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs">Clean Sheets:</span>
            <span className="font-bold text-text-primary">{totalCleanSheets}</span>
          </div>
          {biggestWin?.biggest_win_score && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-xs">Biggest Win:</span>
              <span className="font-bold text-feedback-success">{biggestWin.biggest_win_score}</span>
            </div>
          )}
          {unbeatenRun > 0 && (
            <span className="inline-flex items-center gap-1 bg-accent-muted border border-accent/30 text-accent text-xs font-bold px-2 py-0.5 rounded-full">
              {unbeatenRun}-game unbeaten run
            </span>
          )}
        </div>
      </Card>

      {/* ── Recent Form ── */}
      {currentForm && (
        <Card className="p-4">
          <h2 className="section-header">
            <TrendingUp className="w-4 h-4 text-accent" /> Recent Form
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-muted">Last 6</span>
            <FormStrip form={currentForm} />
          </div>
        </Card>
      )}

      {/* ── Trophy Cabinet ── */}
      <Card className="p-4">
        <h2 className="section-header">
          <Trophy className="w-4 h-4 text-accent" /> Trophy Cabinet
        </h2>
        {(trophies ?? []).length === 0 ? (
          <p className="text-text-muted text-sm">No trophies yet. Glory awaits.</p>
        ) : (
          <div className="space-y-2">
            {(trophies ?? []).map((trophy: any) => (
              <div
                key={trophy.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-accent/20 bg-accent-muted/10"
              >
                {(() => {
                  const iconName = TROPHY_ICON[trophy.trophy_type] ?? 'trophy'
                  const Icon = iconName === 'trophy' ? Trophy : iconName === 'star' ? Star : iconName === 'globe' ? Globe : Medal
                  return <Icon className="w-6 h-6 text-accent shrink-0" />
                })()}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-accent truncate">
                    {TROPHY_LABEL[trophy.trophy_type] ?? trophy.trophy_type}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {trophy.season?.name ?? 'Unknown Season'} · {trophy.tournament?.name ?? ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Season History ── */}
      {data.standings?.length > 0 && (
        <Card className="p-4">
          <h2 className="section-header">
            <History className="w-4 h-4 text-accent" /> Season History
          </h2>
          <div className="space-y-3">
            {[...(data.standings as any[])]
              .sort((a: any, b: any) => {
                if (a.tournament?.status === 'active' && b.tournament?.status !== 'active') return -1
                if (b.tournament?.status === 'active' && a.tournament?.status !== 'active') return 1
                return 0
              })
              .map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg bg-border-subtle/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">
                      {s.tournament?.name ?? 'Tournament'}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.tournament?.status === 'active'
                        ? 'bg-feedback-success/20 text-feedback-success'
                        : 'bg-text-muted/20 text-text-muted'
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

      {/* ── Manager History ── */}
      {(tenures ?? []).length > 0 && (
        <Card className="p-4">
          <h2 className="section-header">
            <User className="w-4 h-4 text-accent" /> Manager History
          </h2>
          <div className="space-y-3">
            {(tenures as any[]).map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              return (
                <div
                  key={tenure.id}
                  className={`rounded-xl border p-3 ${
                    isCurrent
                      ? 'border-accent/30 bg-accent-muted/20'
                      : 'border-border bg-bg-base/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                      isCurrent ? 'bg-accent-muted text-accent' : 'bg-border text-text-muted'
                    }`}>
                      {(tenure.manager_username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-text-primary text-sm">@{tenure.manager_username}</p>
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
                    <div className="flex gap-3 shrink-0 text-center">
                      <div>
                        <p className="text-sm font-black text-feedback-success">{tenure.wins}</p>
                        <p className="text-[10px] text-text-muted font-medium">W</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-feedback-warning">{tenure.draws}</p>
                        <p className="text-[10px] text-text-muted font-medium">D</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-feedback-error">{tenure.losses}</p>
                        <p className="text-[10px] text-text-muted font-medium">L</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── H2H ── */}
      <Card className="p-4 group">
        <details>
        <summary className="section-header cursor-pointer list-none flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-accent" /> Head-to-Head Record
          </span>
          <span className="text-text-muted text-xs group-open:hidden">
            {h2hEntries.length} opponent{h2hEntries.length !== 1 ? 's' : ''} · Tap to expand
          </span>
          <span className="text-text-muted text-xs hidden group-open:inline">Collapse</span>
        </summary>
        {h2hEntries.length === 0 ? (
          <p className="mt-4 text-text-muted text-sm">No completed matches on record.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-2 pr-3">Opponent</th>
                  <th className="pb-2 text-center pr-2">P</th>
                  <th className="pb-2 text-center pr-2">W</th>
                  <th className="pb-2 text-center pr-2">D</th>
                  <th className="pb-2 text-center pr-2">L</th>
                  <th className="pb-2 text-center">GF–GA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {h2hEntries.map(([oppId, rec]: [string, any]) => (
                  <tr key={oppId} className="text-text-secondary hover:bg-bg-base transition-colors">
                    <td className="py-2 pr-3 font-medium">
                      <Link
                        href={`/teams/${oppId}`}
                        className="hover:text-accent transition-colors"
                      >
                        {rec.name}
                      </Link>
                    </td>
                    <td className="py-2 text-center">{rec.played}</td>
                    <td className="py-2 text-center text-feedback-success font-semibold">{rec.wins}</td>
                    <td className="py-2 text-center text-feedback-warning font-semibold">{rec.draws}</td>
                    <td className="py-2 text-center text-feedback-error font-semibold">{rec.losses}</td>
                    <td className="py-2 text-center text-text-muted">
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
