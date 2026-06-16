'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamRequestButtons from '@/components/ui/TeamRequestButtons'
import RecalculateStandingsButton from '@/components/ui/RecalculateStandingsButton'
import RecalculateManagerStatsButton from '@/components/ui/RecalculateManagerStatsButton'
import DashboardFixtureActions from '@/components/ui/DashboardFixtureActions'
import DueFixturesExportButton from './DueFixturesExportButton'
import NewsTopicExportButton from './NewsTopicExportButton'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, CheckCircle2, CalendarDays, RefreshCw, Flag, ClipboardList, Hourglass, AlertTriangle } from 'lucide-react'

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

function QuickActions() {
  return (
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
  )
}

function StatCard({ icon, label, count, accent }: { icon: React.ReactNode; label: string; count: number; accent: string }) {
  return (
    <div className={`flex items-center gap-4 p-5 bg-bg-surface border border-border rounded-xl ${accent}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-black text-text-primary leading-none">{count}</p>
        <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mt-1">{label}</p>
      </div>
    </div>
  )
}

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

export default function Desktop({ data }: { data: any }) {
  const { tournaments, countMap, dueFixtures, dueCount, conflictFixtures, conflictMap, conflictCount, pendingConfirmations, pendingCount, changeRequests, requestCount, flaggedTeams, flaggedCount, managerMap, auditLog } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: APP_TIME_ZONE })}
          </p>
        </div>
      </div>

      <QuickActions />

      <div className="grid grid-cols-5 gap-4">
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-400" />} label="Conflicts" count={conflictCount} accent={conflictCount > 0 ? 'border-l-4 border-l-red-500' : ''} />
        <StatCard icon={<CalendarDays className="w-5 h-5 text-accent" />} label="Fixtures Due" count={dueCount} accent="" />
        <StatCard icon={<Hourglass className="w-5 h-5 text-yellow-400" />} label="Pending" count={pendingCount} accent="" />
        <StatCard icon={<RefreshCw className="w-5 h-5 text-blue-400" />} label="Requests" count={requestCount} accent="" />
        <StatCard icon={<Flag className="w-5 h-5 text-red-400" />} label="Flagged" count={flaggedCount} accent="" />
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

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
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
            <div className="p-5 space-y-3">
              {(tournaments ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No active tournaments.</p>
              ) : (
                <>
                  {((tournaments ?? []) as any[]).map((t: any) => {
                    const typeInfo = TYPE_STYLES[t.type] ?? { label: t.type, colour: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
                    const statusCls = t.status === 'active'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-4 p-3 bg-bg-base border border-border rounded-xl">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>{t.status}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-accent font-black text-xl">{countMap[t.id] ?? 0}</p>
                          <p className="text-[10px] text-text-muted">fixtures</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <RecalculateStandingsButton tournamentId={t.id} tournamentName={t.name} />
                          <RecalculateManagerStatsButton tournamentId={t.id} tournamentName={t.name} />
                        </div>
                      </div>
                    )
                  })}
                  <Link href="/admin/tournaments" className="block text-center text-sm font-semibold px-4 py-2.5 rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors">
                    Manage Tournaments
                  </Link>
                </>
              )}
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
                              <span className="font-semibold text-text-primary">{fx.home_team?.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted/70">vs</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="font-semibold text-text-primary">{fx.away_team?.name}</span>
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
                              homeTeamName={fx.home_team?.name}
                              awayTeamName={fx.away_team?.name}
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
                      home_team_name: fx.home_team?.name ?? null,
                      home_team_folder: fx.home_team?.logo_league_folder ?? null,
                      home_team_slug: fx.home_team?.logo_team_slug ?? null,
                      away_team_name: fx.away_team?.name ?? null,
                      away_team_folder: fx.away_team?.logo_league_folder ?? null,
                      away_team_slug: fx.away_team?.logo_team_slug ?? null,
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-bg-surface border border-border rounded-xl">
            <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
              <div className="flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-bold text-text-primary">Pending Confirmations</h2>
                {pendingCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">{pendingCount}</span>
                )}
              </div>
            </div>
            {pendingCount === 0 ? (
              <div className="p-5">
                <p className="text-sm text-text-muted">No pending confirmations.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-base border-b-2 border-accent/20">
                      <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Fixture</th>
                      <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Matchday</th>
                      <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Date</th>
                      <th className="text-right px-5 py-3 text-[10px] uppercase tracking-widest text-text-muted font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingConfirmations ?? []).map((fx: any) => (
                      <tr key={fx.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {fx.home_team?.logo_league_folder && (
                              <Image src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')} alt="" width={20} height={20} className="object-contain shrink-0" />
                            )}
                            <span className="font-medium text-text-primary">{fx.home_team?.name}</span>
                            <span className="text-xs text-text-muted">vs</span>
                            <span className="font-medium text-text-primary">{fx.away_team?.name}</span>
                            {fx.away_team?.logo_league_folder && (
                              <Image src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')} alt="" width={20} height={20} className="object-contain shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-text-muted">MD{fx.matchday}</td>
                        <td className="px-5 py-4 text-xs text-text-muted">{fx.scheduled_date && new Date(fx.scheduled_date).toLocaleDateString('en-GB')}</td>
                        <td className="px-5 py-4 text-right">
                          <Link href={`/admin/results/submit?fixture=${fx.id}`} className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-accent text-bg-surface hover:bg-accent-hover transition-colors">
                            Finalise
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-bg-surface border border-border rounded-xl">
            <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-text-primary">Team Change Requests</h2>
                {requestCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">{requestCount}</span>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {requestCount === 0 ? (
                <p className="text-sm text-text-muted">No pending requests.</p>
              ) : (
                (changeRequests ?? []).map((req: any) => (
                  <div key={req.id} className="p-3 bg-bg-base border border-border rounded-xl">
                    <div className="flex items-center gap-3 mb-2">
                      {req.requesting_user?.avatar_url ? (
                        <Image src={req.requesting_user.avatar_url} alt={req.requesting_user.username} width={28} height={28} className="rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-xs text-text-muted shrink-0">{req.requesting_user?.username?.[0]?.toUpperCase()}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-text-primary">{req.requesting_user?.username}</span>
                        <div className="flex items-center gap-1 text-xs text-text-muted">
                          <span>{req.current_team?.name ?? 'No team'}</span>
                          <span>→</span>
                          <span className="text-accent font-semibold">{req.requested_team?.name}</span>
                        </div>
                      </div>
                      {req.requested_team?.logo_league_folder && (
                        <Image src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')} alt={req.requested_team.name} width={32} height={32} className="object-contain shrink-0" />
                      )}
                    </div>
                    <TeamRequestButtons requestId={req.id} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-bg-surface border border-border rounded-xl">
            <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-400" />
                <h2 className="text-base font-bold text-text-primary">Flagged Teams</h2>
                {flaggedCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">{flaggedCount}</span>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {flaggedCount === 0 ? (
                <p className="text-sm text-text-muted">No flagged teams.</p>
              ) : (
                (flaggedTeams ?? []).map((team: any) => (
                  <div key={team.id} className="flex items-center gap-3 p-3 bg-bg-base border border-red-500/20 rounded-xl">
                    {team.logo_league_folder && (
                      <Image src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')} alt={team.name} width={32} height={32} className="object-contain shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{team.name}</p>
                      <p className="text-xs text-text-muted">Manager: {team.manager_id ? (managerMap[team.manager_id] ?? 'Unknown') : 'None'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-red-400 font-black text-xl">{team.abandon_count}</span>
                      <p className="text-[10px] text-text-muted">abandons</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-bg-surface border border-border rounded-xl">
            <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-text-muted" />
                <h2 className="text-base font-bold text-text-primary">Recent Audit Log</h2>
              </div>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
