export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import Link from 'next/link'
import TeamRequestButtons from '@/components/ui/TeamRequestButtons'
import RecalculateStandingsButton from '@/components/ui/RecalculateStandingsButton'
import RecalculateManagerStatsButton from '@/components/ui/RecalculateManagerStatsButton'
import DashboardFixtureActions from '@/components/ui/DashboardFixtureActions'
import DueFixturesExportButton from './DueFixturesExportButton'
import NewsTopicExportButton from './NewsTopicExportButton'
import { getAppTodayKey, getAppDayUtcRange, APP_TIME_ZONE } from '@/lib/app-time'
import { Trophy, CheckCircle2, CalendarDays, RefreshCw, Flag, ClipboardList, Hourglass, AlertTriangle, ChevronRight } from 'lucide-react'

export const revalidate = 0

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
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 snap-x snap-mandatory">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`snap-start shrink-0 whitespace-nowrap text-xs font-semibold px-4 py-2.5 rounded-lg min-h-[44px] flex items-center justify-center transition-all active:scale-95 ${
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
    <div className={`card flex items-center gap-3 py-3 px-3 ${accent}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-black text-foreground-primary leading-none">{count}</p>
        <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mt-0.5">{label}</p>
      </div>
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
    <div className="bg-navy-light rounded-lg border border-navy-border overflow-hidden">
      {/* Top: matchday + status + time */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-slate-400 text-xs font-semibold">MD{fx.matchday}</span>
        <div className="flex items-center gap-2">
          {timeLabel && <span className="text-slate-400 text-xs font-mono">{timeLabel}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>
            {fx.status.replaceAll('_', ' ')}
          </span>
        </div>
      </div>
      {/* Teams */}
      <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {fx.home_team?.logo_league_folder && (
            <Image
              src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')}
              alt=""
              width={24} height={24}
              className="object-contain shrink-0"
            />
          )}
          <span className="text-xs font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">
            {fx.home_team?.name}
          </span>
        </div>
        <div className="shrink-0 px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400/70">vs</span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          {fx.away_team?.logo_league_folder && (
            <Image
              src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')}
              alt=""
              width={24} height={24}
              className="object-contain shrink-0"
            />
          )}
          <span className="text-xs font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">
            {fx.away_team?.name}
          </span>
        </div>
      </div>
      {/* Actions */}
      <div className="border-t border-navy-border px-3 py-2 flex justify-end">
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
      </div>
    </div>
  )
}

function ConflictCard({ fx, confs }: { fx: any; confs: any[] }) {
  return (
    <div className="bg-navy-light rounded-lg border border-red-500/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-xs text-slate-400 font-semibold shrink-0">MD{fx.matchday}</span>
          <span className="text-xs text-foreground-primary font-medium truncate">
            {(fx.home_team as any)?.name} vs {(fx.away_team as any)?.name}
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
      <Link href={`/admin/results/submit?fixture=${fx.id}`} className="btn-danger text-xs w-full text-center">
        Resolve
      </Link>
    </div>
  )
}

function SectionCard({ title, icon, count, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode; defaultOpen?: boolean
}) {
  return (
    <details className="card p-0 overflow-hidden group" open={defaultOpen}>
      <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none active:bg-black/[0.02] transition-colors">
        <div className="shrink-0">{icon}</div>
        <span className="text-sm font-bold text-foreground-primary flex-1">{title}</span>
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

async function AdminDashboardContent() {
  const supabase = await createAdminClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, season_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const tournamentIds = ((tournaments ?? []) as any[]).map((t) => t.id)
  const { data: fixtureCounts } = tournamentIds.length
    ? await supabase
        .from('fixtures')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const f of (fixtureCounts ?? []) as any[]) {
    countMap[f.tournament_id] = (countMap[f.tournament_id] ?? 0) + 1
  }

  const todayKey = await getAppTodayKey(supabase)
  const { endIso: todayEnd } = getAppDayUtcRange(todayKey)

  const { data: dueFixtures } = await (supabase as any)
    .from('fixtures')
    .select(`
      id, matchday, status, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, whatsapp_number)),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug, manager:profiles!teams_manager_id_fkey(id, username, whatsapp_number))
    `)
    .in('status', ['scheduled', 'awaiting_confirmation'])
    .lte('scheduled_date', todayEnd)
    .order('scheduled_date', { ascending: true })

  const { data: allConfirmations } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score, submitted_by')

  const conflictMap: Record<string, any[]> = {}
  for (const c of (allConfirmations ?? []) as any[]) {
    if (!conflictMap[c.fixture_id]) conflictMap[c.fixture_id] = []
    conflictMap[c.fixture_id]!.push(c)
  }

  const conflictFixtureIds = Object.entries(conflictMap)
    .filter(([, confs]) => {
      if ((confs?.length ?? 0) < 2) return false
      const first = confs![0]
      return confs!.some((c) => c.home_score !== first!.home_score || c.away_score !== first!.away_score)
    })
    .map(([id]) => id)

  const { data: conflictFixtures } = conflictFixtureIds.length
    ? await supabase
        .from('fixtures')
        .select(`
          id, matchday, status,
          home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
        `)
        .in('id', conflictFixtureIds)
    : { data: [] }

  const { data: pendingConfirmations } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('status', 'awaiting_confirmation')
    .order('scheduled_date', { ascending: true })
    .limit(10)

  const { data: changeRequests } = await supabase
    .from('team_change_requests')
    .select(`
      id, status, created_at,
      requesting_user:profiles!team_change_requests_requesting_user_id_fkey(id, username, avatar_url),
      requested_team:teams!team_change_requests_requested_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      current_team:teams!team_change_requests_current_team_id_fkey(id, name)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const { data: flaggedTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, abandon_count, manager_id')
    .gte('abandon_count', 3)
    .order('abandon_count', { ascending: false })

  const managerIds = ((flaggedTeams ?? []) as any[]).filter((t: any) => t.manager_id).map((t: any) => t.manager_id!)
  const { data: flaggedManagers } = managerIds.length
    ? await supabase.from('profiles').select('id, username').in('id', managerIds)
    : { data: [] }
  const managerMap: Record<string, string> = {}
  for (const m of (flaggedManagers ?? []) as any[]) managerMap[m.id] = m.username

  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details, created_at, admin:profiles!audit_log_admin_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(10)

  const dueCount = dueFixtures?.length ?? 0
  const conflictCount = conflictFixtures?.length ?? 0
  const pendingCount = pendingConfirmations?.length ?? 0
  const requestCount = changeRequests?.length ?? 0
  const flaggedCount = flaggedTeams?.length ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground-primary">Admin Dashboard</h1>
        <p className="text-xs text-text-muted mt-0.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: APP_TIME_ZONE })}
        </p>
      </div>

      {/* Quick actions */}
      <QuickActions />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatCard icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="Conflicts" count={conflictCount} accent={conflictCount > 0 ? 'border-l-4 border-l-red-500/40' : ''} />
        <StatCard icon={<CalendarDays className="w-4 h-4 text-gold" />} label="Fixtures Due" count={dueCount} accent="" />
        <StatCard icon={<Hourglass className="w-4 h-4 text-yellow-400" />} label="Pending" count={pendingCount} accent="" />
        <StatCard icon={<RefreshCw className="w-4 h-4 text-blue-400" />} label="Requests" count={requestCount} accent="" />
        <StatCard icon={<Flag className="w-4 h-4 text-red-400" />} label="Flagged" count={flaggedCount} accent="" />
      </div>

      {/* Result Conflicts — always visible when present */}
      {conflictCount > 0 && (
        <div className="card border-l-4 border-l-red-500/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-bold text-foreground-primary flex-1">Result Conflicts</h2>
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

      {/* Sections */}
      <div className="space-y-3">
        {/* Tournaments */}
        <SectionCard title="Tournaments" icon={<Trophy className="w-4 h-4 text-gold" />} count={tournaments?.length} defaultOpen>
          {(tournaments ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No active tournaments.</p>
          ) : (
            <div className="space-y-2">
              {((tournaments ?? []) as any[]).map((t: any) => {
                const typeInfo = TYPE_STYLES[t.type] ?? { label: t.type, colour: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
                const statusCls = t.status === 'active'
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                return (
                  <div key={t.id} className="bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground-primary truncate">{t.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>{t.status}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-gold font-black text-lg">{countMap[t.id] ?? 0}</p>
                        <p className="text-[10px] text-text-muted">fixtures</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <RecalculateStandingsButton tournamentId={t.id} tournamentName={t.name} />
                      <RecalculateManagerStatsButton tournamentId={t.id} tournamentName={t.name} />
                    </div>
                  </div>
                )
              })}
              <Link href="/admin/tournaments" className="btn-outline w-full text-center text-xs">
                Manage Tournaments
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Fixtures Due */}
        <SectionCard title="Fixtures Due" icon={<CalendarDays className="w-4 h-4 text-gold" />} count={dueCount} defaultOpen>
          {dueCount === 0 ? (
            <div className="text-center py-4 text-text-muted">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-1.5" />
              <p className="text-sm">All caught up — no fixtures due.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
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
              {dueFixtures!.map((fx: any) => (
                <FixtureDueCard key={fx.id} fx={fx} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Pending Confirmations */}
        <SectionCard title="Pending Confirmations" icon={<Hourglass className="w-4 h-4 text-yellow-400" />} count={pendingCount}>
          {pendingCount === 0 ? (
            <p className="text-sm text-text-muted">No pending confirmations.</p>
          ) : (
            <div className="space-y-2">
              {((pendingConfirmations ?? []) as any[]).map((fx: any) => (
                <div key={fx.id} className="flex items-center justify-between gap-2 bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {fx.home_team?.logo_league_folder && (
                        <Image src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')} alt="" width={16} height={16} className="object-contain shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground-primary truncate">{fx.home_team?.name}</span>
                      <span className="text-[10px] text-text-muted">vs</span>
                      <span className="text-sm font-medium text-foreground-primary truncate">{fx.away_team?.name}</span>
                      {fx.away_team?.logo_league_folder && (
                        <Image src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')} alt="" width={16} height={16} className="object-contain shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      MD{fx.matchday}
                      {fx.scheduled_date && ` · ${new Date(fx.scheduled_date).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <Link href={`/admin/results/submit?fixture=${fx.id}`} className="btn-gold text-xs py-1.5 px-3 shrink-0">
                    Finalise
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Team Change Requests */}
        <SectionCard title="Team Change Requests" icon={<RefreshCw className="w-4 h-4 text-blue-400" />} count={requestCount}>
          {requestCount === 0 ? (
            <p className="text-sm text-text-muted">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {((changeRequests ?? []) as any[]).map((req: any) => (
                <div key={req.id} className="bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    {req.requesting_user?.avatar_url ? (
                      <Image src={req.requesting_user.avatar_url} alt={req.requesting_user.username} width={24} height={24} className="rounded-full shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-navy-border flex items-center justify-center text-[10px] text-text-muted shrink-0">
                        {req.requesting_user?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground-primary">{req.requesting_user?.username}</span>
                      <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                        <span>{req.current_team?.name ?? 'No team'}</span>
                        <span>→</span>
                        <span className="text-accent font-semibold">{req.requested_team?.name}</span>
                      </div>
                    </div>
                    {req.requested_team?.logo_league_folder && (
                      <Image src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')} alt={req.requested_team.name} width={28} height={28} className="object-contain shrink-0" />
                    )}
                  </div>
                  <TeamRequestButtons requestId={req.id} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Flagged Teams */}
        <SectionCard title="Flagged Teams" icon={<Flag className="w-4 h-4 text-red-400" />} count={flaggedCount}>
          {flaggedCount === 0 ? (
            <p className="text-sm text-text-muted">No flagged teams.</p>
          ) : (
            <div className="space-y-2">
              {((flaggedTeams ?? []) as any[]).map((team: any) => (
                <div key={team.id} className="flex items-center gap-3 bg-navy-light rounded-lg border border-red-500/20 px-3 py-2.5">
                  {team.logo_league_folder && (
                    <Image src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')} alt={team.name} width={28} height={28} className="object-contain shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground-primary truncate">{team.name}</p>
                    <p className="text-[10px] text-text-muted">
                      Manager: {team.manager_id ? (managerMap[team.manager_id] ?? 'Unknown') : 'None'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-red-400 font-black text-lg">{team.abandon_count}</span>
                    <p className="text-[10px] text-text-muted">abandons</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent Audit Log */}
        <SectionCard title="Recent Audit Log" icon={<ClipboardList className="w-4 h-4 text-text-muted" />}>
          {(auditLog?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">No audit entries.</p>
          ) : (
            <div className="space-y-1">
              {((auditLog ?? []) as any[]).map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-xs py-2 border-b border-border last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground-primary font-medium">{entry.action}</span>
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

export default async function AdminDashboardPage() {
  return <AdminDashboardContent />
}
