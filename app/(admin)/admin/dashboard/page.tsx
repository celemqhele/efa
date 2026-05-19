export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import Link from 'next/link'

export const revalidate = 0

const STATUS_COLOURS: Record<string, string> = {
  scheduled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  awaiting_confirmation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  postponed: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const TYPE_LABELS: Record<string, { label: string; colour: string }> = {
  league: { label: 'League', colour: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  ucl: { label: 'UCL', colour: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  europa: { label: 'Europa', colour: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  super_cup: { label: 'Super Cup', colour: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Fetch all active tournaments with fixture counts
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status, season_id')
    .in('status', ['active', 'upcoming'])
    .order('created_at', { ascending: false })

  // Fixture counts per tournament
  const tournamentIds = (tournaments ?? []).map((t) => t.id)
  const { data: fixtureCounts } = tournamentIds.length
    ? await supabase
        .from('fixtures')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const f of fixtureCounts ?? []) {
    countMap[f.tournament_id] = (countMap[f.tournament_id] ?? 0) + 1
  }

  // Today's fixtures
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  const { data: todaysFixtures } = await supabase
    .from('fixtures')
    .select(`
      id, matchday, status, scheduled_date,
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_league_folder, logo_team_slug),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_league_folder, logo_team_slug)
    `)
    .in('status', ['scheduled', 'awaiting_confirmation', 'confirmed'])
    .gte('scheduled_date', todayStart)
    .lt('scheduled_date', todayEnd)
    .order('scheduled_date', { ascending: true })

  // Fixtures with conflicting result confirmations
  const { data: allConfirmations } = await supabase
    .from('result_confirmations')
    .select('fixture_id, home_score, away_score, submitted_by')

  const conflictMap: Record<string, typeof allConfirmations> = {}
  for (const c of allConfirmations ?? []) {
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

  // Pending confirmations (awaiting_confirmation)
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

  // Pending team change requests
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

  // Teams with abandon_count >= 3
  const { data: flaggedTeams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, abandon_count, manager_id')
    .gte('abandon_count', 3)
    .order('abandon_count', { ascending: false })

  // Manager profiles for flagged teams
  const managerIds = (flaggedTeams ?? []).filter((t) => t.manager_id).map((t) => t.manager_id!)
  const { data: flaggedManagers } = managerIds.length
    ? await supabase.from('profiles').select('id, username').in('id', managerIds)
    : { data: [] }
  const managerMap: Record<string, string> = {}
  for (const m of flaggedManagers ?? []) managerMap[m.id] = m.username

  // Recent audit log
  const { data: auditLog } = await supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details, created_at, admin:profiles!audit_log_admin_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Link href="/admin/seasons" className="btn-outline text-xs px-3 py-1.5">Seasons</Link>
          <Link href="/admin/hall-of-fame" className="btn-outline text-xs px-3 py-1.5 hidden sm:inline-flex">Hall of Fame</Link>
          <Link href="/admin/export" className="btn-outline text-xs px-3 py-1.5 hidden sm:inline-flex">Export</Link>
          <Link href="/admin/results/submit" className="btn-gold text-xs px-3 py-1.5">Submit Result</Link>
          <Link href="/admin/fixtures/manage" className="btn-outline text-xs px-3 py-1.5 hidden sm:inline-flex">Fixtures</Link>
        </div>
      </div>

      {/* Result Conflicts Alert */}
      {(conflictFixtures?.length ?? 0) > 0 && (
        <div className="card p-4 border-red-500/40 bg-red-500/5">
          <h2 className="section-header text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
            Result Conflicts ({conflictFixtures!.length})
          </h2>
          <div className="space-y-3">
            {conflictFixtures!.map((fx: any) => {
              const confs = conflictMap[fx.id] ?? []
              return (
                <div key={fx.id} className="flex items-center justify-between bg-navy-light rounded-lg px-4 py-3 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs">MD{fx.matchday}</span>
                    <span className="text-white font-medium text-sm">
                      {(fx.home_team as any)?.name} vs {(fx.away_team as any)?.name}
                    </span>
                    <div className="flex gap-2 ml-2">
                      {confs.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                          {c.home_score}–{c.away_score}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link href={`/admin/results/submit?fixture=${fx.id}`} className="btn-danger text-xs">
                    Resolve
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tournament Overview */}
        <div className="lg:col-span-1">
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">🏆</span> Tournaments
            </h2>
            <div className="space-y-3">
              {(tournaments ?? []).length === 0 && (
                <p className="text-slate-500 text-sm">No active tournaments.</p>
              )}
              {(tournaments ?? []).map((t) => {
                const typeInfo = TYPE_LABELS[t.type] ?? { label: t.type, colour: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
                const statusCls = t.status === 'active'
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                return (
                  <div key={t.id} className="flex items-center justify-between bg-navy-light rounded-lg px-3 py-2.5 border border-navy-border">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${typeInfo.colour}`}>{typeInfo.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${statusCls}`}>{t.status}</span>
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-gold font-bold text-lg">{countMap[t.id] ?? 0}</p>
                      <p className="text-slate-500 text-xs">fixtures</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/admin/tournaments" className="btn-outline w-full mt-4 text-center block">
              Manage Tournaments
            </Link>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="section-header">
              <span className="text-gold">📅</span> Today&apos;s Fixtures
            </h2>
            {(todaysFixtures?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-4xl mb-2">🎮</p>
                <p className="text-sm">No fixtures scheduled for today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todaysFixtures!.map((fx: any) => {
                  const statusCls = STATUS_COLOURS[fx.status] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                  return (
                    <div key={fx.id} className="flex items-center gap-3 bg-navy-light rounded-lg px-3 py-2.5 border border-navy-border">
                      <span className="text-slate-500 text-xs w-8 shrink-0">MD{fx.matchday}</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {fx.home_team?.logo_league_folder && (
                          <Image src={getTeamLogo(fx.home_team.logo_league_folder, fx.home_team.logo_team_slug, 'standings_row')} alt={fx.home_team.name} width={24} height={24} className="object-contain bg-white shrink-0" />
                        )}
                        <span className="text-white text-sm font-medium truncate">{fx.home_team?.name}</span>
                        <span className="text-slate-500 text-xs mx-1">vs</span>
                        <span className="text-white text-sm font-medium truncate">{fx.away_team?.name}</span>
                        {fx.away_team?.logo_league_folder && (
                          <Image src={getTeamLogo(fx.away_team.logo_league_folder, fx.away_team.logo_team_slug, 'standings_row')} alt={fx.away_team.name} width={24} height={24} className="object-contain bg-white shrink-0" />
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${statusCls}`}>
                        {fx.status.replace('_', ' ')}
                      </span>
                      {fx.status === 'awaiting_confirmation' && (
                        <Link href={`/admin/results/submit?fixture=${fx.id}`} className="btn-gold text-xs py-1 px-2 shrink-0">
                          Finalise
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Confirmations */}
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-yellow-400">⏳</span> Pending Confirmations
            {(pendingConfirmations?.length ?? 0) > 0 && (
              <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
                {pendingConfirmations!.length}
              </span>
            )}
          </h2>
          {(pendingConfirmations?.length ?? 0) === 0 ? (
            <p className="text-slate-500 text-sm">No pending confirmations.</p>
          ) : (
            <div className="space-y-2">
              {pendingConfirmations!.map((fx: any) => (
                <div key={fx.id} className="flex items-center justify-between bg-navy-light rounded-lg px-3 py-2.5 border border-navy-border">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {fx.home_team?.name} vs {fx.away_team?.name}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      MD{fx.matchday}
                      {fx.scheduled_date && ` · ${new Date(fx.scheduled_date).toLocaleDateString('en-GB')}`}
                    </p>
                  </div>
                  <Link href={`/admin/results/submit?fixture=${fx.id}`} className="btn-gold text-xs py-1.5 px-3">
                    Finalise
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Change Requests */}
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-blue-400">🔄</span> Team Change Requests
            {(changeRequests?.length ?? 0) > 0 && (
              <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5">
                {changeRequests!.length}
              </span>
            )}
          </h2>
          {(changeRequests?.length ?? 0) === 0 ? (
            <p className="text-slate-500 text-sm">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {changeRequests!.map((req: any) => (
                <div key={req.id} className="bg-navy-light rounded-lg px-3 py-3 border border-navy-border">
                  <div className="flex items-center gap-2 mb-2">
                    {req.requesting_user?.avatar_url ? (
                      <Image src={req.requesting_user.avatar_url} alt={req.requesting_user.username} width={28} height={28} className="rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-navy-border flex items-center justify-center text-xs text-slate-400">
                        {req.requesting_user?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-white text-sm font-medium">{req.requesting_user?.username}</span>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <span>{req.current_team?.name ?? 'No team'}</span>
                        <span>→</span>
                        <span className="text-gold">{req.requested_team?.name}</span>
                      </div>
                    </div>
                    {req.requested_team?.logo_league_folder && (
                      <Image src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')} alt={req.requested_team.name} width={32} height={32} className="object-contain bg-white ml-auto shrink-0" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action="/api/admin/team-request" method="POST" className="flex-1">
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button type="submit" className="btn-gold w-full text-xs py-1.5">Approve</button>
                    </form>
                    <form action="/api/admin/team-request" method="POST" className="flex-1">
                      <input type="hidden" name="requestId" value={req.id} />
                      <input type="hidden" name="action" value="deny" />
                      <button type="submit" className="btn-danger w-full text-xs py-1.5">Deny</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flagged Abandonments */}
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-red-400">🚩</span> Flagged Teams
          </h2>
          {(flaggedTeams?.length ?? 0) === 0 ? (
            <p className="text-slate-500 text-sm">No flagged teams.</p>
          ) : (
            <div className="space-y-2">
              {flaggedTeams!.map((team) => (
                <div key={team.id} className="flex items-center gap-3 bg-navy-light rounded-lg px-3 py-2.5 border border-red-500/20">
                  {team.logo_league_folder && (
                    <Image src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')} alt={team.name} width={32} height={32} className="object-contain bg-white shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{team.name}</p>
                    <p className="text-slate-500 text-xs">
                      Manager: {team.manager_id ? (managerMap[team.manager_id] ?? 'Unknown') : 'None'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-red-400 font-bold text-lg">{team.abandon_count}</span>
                    <p className="text-slate-500 text-xs">abandons</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Audit Log */}
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-slate-400">📋</span> Recent Audit Log
          </h2>
          {(auditLog?.length ?? 0) === 0 ? (
            <p className="text-slate-500 text-sm">No audit entries.</p>
          ) : (
            <div className="space-y-1.5">
              {auditLog!.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-xs py-2 border-b border-navy-border last:border-0">
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-gold mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-white font-medium">{entry.action}</span>
                    {entry.target_type && (
                      <span className="text-slate-500 ml-1">on {entry.target_type}</span>
                    )}
                    <div className="text-slate-500 mt-0.5">
                      {entry.admin?.username ?? 'System'} · {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
