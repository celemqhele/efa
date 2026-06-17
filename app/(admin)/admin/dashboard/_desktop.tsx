'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import DashboardFixtureActions from '@/components/ui/DashboardFixtureActions'
import DueFixturesExportButton from './DueFixturesExportButton'
import NewsTopicExportButton from './NewsTopicExportButton'
import DeleteTournamentButton from '@/app/(admin)/admin/tournaments/DeleteTournamentButton'
import RunTournamentDrawButton from '@/app/(admin)/admin/tournaments/RunTournamentDrawButton'
import GenerateKnockoutsButton from '@/app/(admin)/admin/tournaments/GenerateKnockoutsButton'
import GenerateFriendliesButton from '@/app/(admin)/admin/tournaments/GenerateFriendliesButton'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, CheckCircle2, CalendarDays, ClipboardList, AlertTriangle } from 'lucide-react'
import { cleanTeamName } from '@/lib/clean-team-name'

const STATUS_CLASSES: Record<string, string> = {
  scheduled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  awaiting_confirmation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  postponed: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  league: { label: 'PL', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  ucl: { label: 'UCL', colour: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  europa: { label: 'EL', colour: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  super_cup: { label: 'SC', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  tournament_club: { label: 'Club', colour: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  tournament_international: { label: 'Intl', colour: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  friendlies: { label: 'Friendly', colour: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
}

const ACTIONS = [
  { href: '/admin/results/submit', label: 'Submit Result', variant: 'gold' as const },
  { href: '/admin/fixtures/manage', label: 'Fixtures', variant: 'outline' as const },
  { href: '/admin/seasons', label: 'Seasons', variant: 'outline' as const },
  { href: '/admin/managers', label: 'Managers', variant: 'outline' as const },
  { href: '/admin/polls', label: 'Polls', variant: 'outline' as const },
  { href: '/admin/hall-of-fame', label: 'Hall of Fame', variant: 'outline' as const },
  { href: '/admin/export', label: 'Export', variant: 'outline' as const },
]

function ConflictCard({ fx, confs }: { fx: any; confs: any[] }) {
  return (
    <div className="border border-red-500/20 rounded-xl px-5 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-text-primary">MD{fx.matchday}</span>
          <span className="text-sm text-text-muted">{(fx.home_team as any)?.name} vs {(fx.away_team as any)?.name}</span>
        </div>
        <Link href={`/admin/results/submit?fixture=${fx.id}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
          Resolve
        </Link>
      </div>
      <div className="flex items-center gap-2">
        {confs.map((c, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
            {c.home_score}–{c.away_score}
          </span>
        ))}
      </div>
    </div>
  )
}

function TournamentCard({
  tournament,
  participantCount,
  fixtureCount,
  completedCount,
}: {
  tournament: any
  participantCount: number
  fixtureCount: number
  completedCount: number
}) {
  const typeInfo = TYPE_STYLES[tournament.type] ?? { label: tournament.type, colour: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
  const statusCls = tournament.status === 'active'
    ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
  const progress = fixtureCount > 0 ? Math.round((completedCount / fixtureCount) * 100) : 0

  return (
    <div className="bg-bg-base border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-text-primary font-bold text-base truncate">{tournament.name}</h3>
          {tournament.season && (
            <p className="text-text-muted text-xs mt-0.5">{tournament.season.name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded border ${statusCls}`}>{tournament.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-bg-surface border border-border rounded-lg py-2">
          <p className="text-accent font-bold text-lg">{participantCount}</p>
          <p className="text-text-muted text-xs">Teams</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg py-2">
          <p className="text-text-primary font-bold text-lg">{fixtureCount}</p>
          <p className="text-text-muted text-xs">Fixtures</p>
        </div>
        <div className="bg-bg-surface border border-border rounded-lg py-2">
          <p className="text-green-400 font-bold text-lg">{completedCount}</p>
          <p className="text-text-muted text-xs">Played</p>
        </div>
      </div>

      {fixtureCount > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex divide-x divide-border border border-border rounded-xl overflow-hidden">
        <Link
          href={`/admin/fixtures/manage?tournament=${tournament.id}`}
          className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors"
        >
          Fixtures
        </Link>
        {['tournament_club', 'tournament_international'].includes(tournament.type) && (
          <RunTournamentDrawButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors" />
        )}
        {['tournament_club', 'tournament_international'].includes(tournament.type) && (
          <GenerateKnockoutsButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors" />
        )}
        {tournament.type === 'friendlies' && (
          <GenerateFriendliesButton tournamentId={tournament.id} tournamentName={tournament.name} type={tournament.type} className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors" />
        )}
        <Link
          href={`/standings?t=${tournament.id}`}
          className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors"
        >
          View
        </Link>
        <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} className="flex-1 text-center text-xs font-semibold py-2.5 px-1 hover:bg-bg-base transition-colors hover:text-feedback-error" />
      </div>
    </div>
  )
}

export default function Desktop({ data }: { data: any }) {
  const { tournaments, participantCounts, fixtureCounts, completedCounts, dueFixtures, dueCount, conflictFixtures, conflictMap, conflictCount, auditLog } = data

  return (
    <div className="max-w-7xl mx-auto">
      <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors ${
                a.variant === 'gold'
                  ? 'bg-accent text-bg-surface hover:bg-accent-hover'
                  : 'border border-border text-text-secondary hover:border-accent hover:text-accent'
              }`}
            >
              {a.label}
            </Link>
          ))}
          <NewsTopicExportButton />
        </div>
      </div>

      <div className="space-y-6 pb-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
            <p className="text-sm text-text-muted mt-1">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: APP_TIME_ZONE })}
            </p>
          </div>
        </div>

        {conflictCount > 0 && (
          <div className="bg-bg-surface border border-red-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-base font-bold text-text-primary">Result Conflicts</h2>
              <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 font-semibold">{conflictCount}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {conflictFixtures!.map((fx: any) => (
                <ConflictCard key={fx.id} fx={fx} confs={conflictMap[fx.id] ?? []} />
              ))}
            </div>
          </div>
        )}

        <div className="bg-bg-surface border border-border rounded-xl">
          <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold text-text-primary">Tournaments</h2>
              {tournaments?.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">{tournaments.length}</span>
              )}
            </div>
          </div>
          <div className="p-5">
            {(tournaments ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">No active tournaments.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {((tournaments ?? []) as any[]).map((t: any) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    participantCount={participantCounts[t.id] ?? 0}
                    fixtureCount={fixtureCounts[t.id] ?? 0}
                    completedCount={completedCounts[t.id] ?? 0}
                  />
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link href="/admin/tournaments" className="block text-center text-sm font-semibold px-4 py-2.5 rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors">
                Manage Tournaments
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-bg-surface border border-border rounded-xl">
          <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold text-text-primary">Fixtures Due</h2>
              {dueCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">{dueCount}</span>
              )}
            </div>
          </div>
          {dueCount === 0 ? (
            <div className="p-5">
              <div className="text-center py-8 text-text-muted">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-sm">All caught up — no fixtures due.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-base border-b-2 border-accent/20">
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Matchday</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Home</th>
                    <th className="text-center px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Score</th>
                    <th className="text-right px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Away</th>
                    <th className="text-center px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Status</th>
                    <th className="text-right px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Time</th>
                    <th className="text-right px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueFixtures!.map((fx: any) => {
                    const statusCls = STATUS_CLASSES[fx.status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                    const timeLabel = fx.scheduled_date
                      ? new Date(fx.scheduled_date).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE,
                        })
                      : null
                    const dateLabel = fx.scheduled_date
                      ? new Date(fx.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : null
                    return (
                      <tr key={fx.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                        <td className="px-5 py-4 text-text-muted font-semibold text-xs">MD{fx.matchday}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {fx.home_team?.logo_league_folder && (
                              <Image src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')} alt="" width={22} height={22} className="object-contain shrink-0" />
                            )}
                            <span className="font-semibold text-text-primary whitespace-nowrap">{cleanTeamName(fx.home_team?.name)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted/70">vs</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="font-semibold text-text-primary whitespace-nowrap">{cleanTeamName(fx.away_team?.name)}</span>
                            {fx.away_team?.logo_league_folder && (
                              <Image src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')} alt="" width={22} height={22} className="object-contain shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>
                            {fx.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-xs text-text-muted font-mono whitespace-nowrap">
                          {dateLabel && <span>{dateLabel}</span>}
                          {timeLabel && <span> · {timeLabel}</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <DashboardFixtureActions
                            fixtureId={fx.id}
                            status={fx.status}
                            homeTeamName={cleanTeamName(fx.home_team?.name) ?? ''}
                            awayTeamName={cleanTeamName(fx.away_team?.name) ?? ''}
                            homeManagerName={fx.home_team?.manager?.username}
                            homeManagerPhone={fx.home_team?.manager?.whatsapp_number}
                            awayManagerName={fx.away_team?.manager?.username}
                            awayManagerPhone={fx.away_team?.manager?.whatsapp_number}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-border">
                <DueFixturesExportButton
                  fixtures={(dueFixtures ?? []).map((fx: any) => ({
                    id: fx.id, matchday: fx.matchday ?? null,
                    scheduled_date: fx.scheduled_date ?? null, status: fx.status,
                    home_team_name: cleanTeamName(fx.home_team?.name) ?? null,
                    home_team_folder: fx.home_team?.logo_league_folder ?? null,
                    home_team_slug: fx.home_team?.logo_team_slug ?? null,
                    away_team_name: cleanTeamName(fx.away_team?.name) ?? null,
                    away_team_folder: fx.away_team?.logo_league_folder ?? null,
                    away_team_slug: fx.away_team?.logo_team_slug ?? null,
                  }))}
                />
              </div>
            </div>
          )}
        </div>

        <details className="bg-bg-surface border border-border rounded-xl overflow-hidden group">
          <summary className="flex items-center gap-2 px-5 py-4 bg-bg-base cursor-pointer list-none select-none transition-colors hover:bg-bg-base/80">
            <ClipboardList className="w-5 h-5 text-text-muted shrink-0" />
            <h2 className="text-base font-bold text-text-primary flex-1">Recent Audit Log</h2>
            <svg className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="p-5 space-y-2 max-h-[400px] overflow-y-auto">
            {(auditLog?.length ?? 0) === 0 ? (
              <p className="text-sm text-text-muted">No audit entries.</p>
            ) : (
              (auditLog ?? []).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm py-2 border-b border-border last:border-0">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-text-primary font-medium">{entry.action}</span>
                    {entry.target_type && <span className="text-text-muted ml-1">on {entry.target_type}</span>}
                    <div className="text-text-muted text-xs mt-0.5">{entry.admin?.username ?? 'System'} · {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE })}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
