'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import DashboardFixtureActions from '@/components/ui/DashboardFixtureActions'
import DueFixturesExportButton from './DueFixturesExportButton'
import NewsTopicExportButton from './NewsTopicExportButton'
import { APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, CheckCircle2, CalendarDays, ClipboardList, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react'
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
  { href: '/admin/push-shooter', label: 'Send Push', variant: 'outline' as const },
]

function QuickActions() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 snap-x snap-mandatory">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="snap-start shrink-0 whitespace-nowrap text-sm font-semibold px-5 py-3 rounded-2xl min-h-[48px] flex items-center justify-center transition-colors bg-bg-surface/80 backdrop-saturate-150 backdrop-blur-2xl border border-border/50 text-text-primary hover:bg-bg-surface"
        >
          {a.label}
        </Link>
      ))}
      <NewsTopicExportButton />
    </div>
  )
}

function FixtureDueCard({ fx }: { fx: any }) {
  const statusCls = STATUS_CLASSES[fx.status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  const timeLabel = fx.scheduled_date
    ? new Date(fx.scheduled_date).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE,
      })
    : null

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-xs font-semibold">MD{fx.matchday}</span>
        <div className="flex items-center gap-2">
          {timeLabel && <span className="text-text-muted text-xs font-mono">{timeLabel}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>
            {fx.status.replaceAll('_', ' ')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {fx.home_team?.logo_league_folder && (
            <Image
              src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')}
              alt=""
              width={24} height={24}
              className="object-contain shrink-0"
            />
          )}
          <span className="text-xs font-semibold text-text-primary text-center leading-tight truncate max-w-full">
            {cleanTeamName(fx.home_team?.name)}
          </span>
        </div>
        <div className="shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted/70">vs</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {fx.away_team?.logo_league_folder && (
            <Image
              src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')}
              alt=""
              width={24} height={24}
              className="object-contain shrink-0"
            />
          )}
          <span className="text-xs font-semibold text-text-primary text-center leading-tight truncate max-w-full">
            {cleanTeamName(fx.away_team?.name)}
          </span>
        </div>
      </div>
      <div className="flex justify-end border-t border-border pt-2.5 -mx-3.5 -mb-3.5 px-3.5 pb-3.5">
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
      </div>
    </div>
  )
}

function ConflictCard({ fx, confs }: { fx: any; confs: any[] }) {
  return (
    <div className="bg-bg-base border border-red-500/20 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-text-muted font-semibold shrink-0">MD{fx.matchday}</span>
          <span className="text-sm text-text-primary font-medium truncate">
            {cleanTeamName((fx.home_team as any)?.name)} vs {cleanTeamName((fx.away_team as any)?.name)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {confs.map((c, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
            {c.home_score}–{c.away_score}
          </span>
        ))}
      </div>
      <Link href={`/admin/results/submit?fixture=${fx.id}`} className="block text-center text-sm font-semibold px-4 py-3 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 min-h-[48px] leading-none flex items-center justify-center">
        Resolve
      </Link>
    </div>
  )
}

function SectionCard({ title, icon, count, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean
}) {
  return (
    <details className="bg-bg-surface border border-border rounded-xl overflow-hidden group" open={defaultOpen}>
      <summary className="flex items-center gap-2 px-4 py-4 cursor-pointer list-none select-none min-h-[48px] transition-colors">
        <div className="shrink-0">{icon}</div>
        <span className="text-sm font-bold text-text-primary flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
            {count}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
        {children}
      </div>
    </details>
  )
}

export default function Mobile({ data }: { data: any }) {
  const { tournaments, participantCounts, fixtureCounts, completedCounts, dueFixtures, dueCount, conflictFixtures, conflictMap, conflictCount, auditLog } = data

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Admin Dashboard</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: APP_TIME_ZONE })}
          </p>
        </div>
      </div>

      <QuickActions />

      {conflictCount > 0 && (
        <div className="bg-bg-surface border border-red-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-text-primary flex-1">Result Conflicts</h2>
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 font-semibold">
              {conflictCount}
            </span>
          </div>
          <div className="space-y-2">
            {conflictFixtures!.map((fx: any) => (
              <ConflictCard key={fx.id} fx={fx} confs={conflictMap[fx.id] ?? []} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Trophy className="w-5 h-5 text-accent shrink-0" />
          <h2 className="text-sm font-bold text-text-primary flex-1">Tournaments</h2>
          {tournaments?.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
              {tournaments.length}
            </span>
          )}
          <Link href="/admin/tournaments" className="text-[11px] font-semibold text-accent hover:text-accent-hover shrink-0">
            See All
          </Link>
        </div>
        {(tournaments ?? []).length === 0 ? (
          <p className="text-sm text-text-muted px-1">No active tournaments.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 snap-x snap-mandatory">
            {((tournaments ?? []) as any[]).map((t: any) => {
              const typeInfo = TYPE_STYLES[t.type] ?? { label: t.type, colour: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
              const statusCls = t.status === 'active'
                ? 'text-green-400 bg-green-500/10 border-green-500/20'
                : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
              const progress = (fixtureCounts[t.id] ?? 0) > 0 ? Math.round(((completedCounts[t.id] ?? 0) / (fixtureCounts[t.id] ?? 1)) * 100) : 0
              return (
                <Link
                  key={t.id}
                  href={`/admin/tournaments/${t.id}`}
                  className="snap-start shrink-0 w-[220px] bg-bg-surface border border-border rounded-xl p-4 space-y-3 hover:border-accent/40 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-primary truncate">{t.name}</p>
                      {t.season && <p className="text-text-muted text-[10px] mt-0.5">{t.season.name}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>{t.status}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-bg-base border border-border rounded-lg py-2">
                      <p className="text-accent font-bold text-sm">{participantCounts[t.id] ?? 0}</p>
                      <p className="text-text-muted text-[9px]">Teams</p>
                    </div>
                    <div className="bg-bg-base border border-border rounded-lg py-2">
                      <p className="text-text-primary font-bold text-sm">{fixtureCounts[t.id] ?? 0}</p>
                      <p className="text-text-muted text-[9px]">Fix.</p>
                    </div>
                    <div className="bg-bg-base border border-border rounded-lg py-2">
                      <p className="text-green-400 font-bold text-sm">{completedCounts[t.id] ?? 0}</p>
                      <p className="text-text-muted text-[9px]">Done</p>
                    </div>
                  </div>
                  {(fixtureCounts[t.id] ?? 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-[9px] text-text-muted mb-1">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2 px-1">
          <CalendarDays className="w-5 h-5 text-accent shrink-0" />
          <h2 className="text-sm font-bold text-text-primary flex-1">Fixtures Due</h2>
          {dueCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
              {dueCount}
            </span>
          )}
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
        {dueCount === 0 ? (
          <div className="text-center py-6 text-text-muted bg-bg-surface border border-border rounded-xl">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-1.5" />
            <p className="text-sm">All caught up — no fixtures due.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 snap-x snap-mandatory">
            {dueFixtures!.map((fx: any) => (
              <div key={fx.id} className="snap-start shrink-0 w-[240px] bg-bg-surface border border-border rounded-xl overflow-hidden">
                <FixtureDueCard fx={fx} />
              </div>
            ))}
          </div>
        )}

        <SectionCard title="Recent Audit Log" icon={<ClipboardList className="w-5 h-5 text-text-muted" />}>
          {(auditLog?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No audit entries.</p>
          ) : (
            <div className="space-y-1">
              {((auditLog ?? []) as any[]).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-xs py-2 border-b border-border last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-text-primary font-medium">{entry.action}</span>
                    {entry.target_type && (
                      <span className="text-text-muted ml-1">on {entry.target_type}</span>
                    )}
                    <div className="text-text-muted mt-0.5">
                      {entry.admin?.username ?? 'System'} · {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
