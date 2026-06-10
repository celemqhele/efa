export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO, differenceInDays } from 'date-fns'
import TeamChangeModal from './TeamChangeModal'
import ProfileActions from './ProfileActions'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export const revalidate = 0

// --- Helpers -----------------------------------------------------------------

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = differenceInDays(parseISO(dateStr), new Date())
  return d
}

// --- Page ---------------------------------------------------------------------

export default async function ProfilePage() {
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Profile
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('id, username, role, avatar_url')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as any

  // Fetch all team rows for the user - same club can appear across multiple phases
  const { data: allTeamRows } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug')
    .eq('manager_id', user.id)
  const team = (allTeamRows?.[0] as any) ?? null
  const teamIds: string[] = (allTeamRows ?? []).map((t: any) => t.id)
  const teamOrFilter = teamIds.length > 0
    ? teamIds.flatMap(id => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`]).join(',')
    : null

  // Team change requests for this user (most recent pending or last reviewed)
  const { data: changeRequestsRaw } = await supabase
    .from('team_change_requests')
    .select(`
      id, status, created_at,
      requested_team:teams!team_change_requests_requested_team_id_fkey(id, name)
    `)
    .eq('requesting_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)
  const changeRequests = (changeRequestsRaw ?? []) as any[]

  const pendingRequest = changeRequests.find((r: any) => r.status === 'pending') ?? null

  // Fetch Tenures (Career History)
  const { data: tenures } = await supabase
    .from('manager_tenures' as any)
    .select(`
      *,
      team:teams(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('manager_id', user.id)
    .order('started_at', { ascending: false }) as any

  // Calculate Aggregated Stats
  const stats = (tenures ?? []).reduce((acc: any, t: any) => {
    acc.played += (t.wins + t.draws + t.losses)
    acc.wins += t.wins
    acc.draws += t.draws
    acc.losses += t.losses
    acc.gf += t.goals_for
    acc.ga += t.goals_against
    return acc
  }, { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 })

  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0

  // Upcoming fixtures (next 5 for user's team - covers all phase rows)
  const { data: upcomingFixtures } = teamOrFilter
    ? await supabase
        .from('fixtures')
        .select(`
          id, scheduled_date, matchday, round_type,
          home_team:teams!home_team_id(id, name, logo_league_folder, logo_team_slug),
          away_team:teams!away_team_id(id, name, logo_league_folder, logo_team_slug),
          tournament:tournaments(name, type)
        `)
        .or(teamOrFilter)
        .eq('status', 'scheduled')
        .order('scheduled_date', { ascending: true })
        .limit(5)
    : { data: null }

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() ?? '??'

  const next3 = (upcomingFixtures ?? []).slice(0, 3) as any[]

  return (
    <div className="space-y-space-8 max-w-3xl mx-auto">

      {/* -- Profile Card --------------------------------------------------- */}
      <Card className="p-space-6 flex flex-col sm:flex-row items-center sm:items-start gap-space-6">
        {/* Avatar */}
        <div className="shrink-0">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.username}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover ring-2 ring-accent/60"
            />
          ) : team?.logo_league_folder ? (
            <div className="w-24 h-24 rounded-full bg-bg-elevated flex items-center justify-center ring-2 ring-accent/40 overflow-hidden p-2">
              <Image
                src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'profile_avatar')}
                alt={team.name}
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-bg-elevated flex items-center justify-center ring-2 ring-accent/40">
              <span className="text-3xl font-black text-accent">{initials}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-space-2 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-space-2 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary">
              @{profile?.username ?? user.email}
            </h1>
            {profile?.role === 'admin' && (
              <span className="inline-flex items-center gap-space-1 px-space-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-bold uppercase tracking-wider">
                ⭐ Admin
              </span>
            )}
          </div>

          {team ? (
            <Link
              href={`/teams/${team.id}`}
              className="inline-flex items-center gap-space-2 text-text-secondary hover:text-accent transition-colors group"
            >
              {team.logo_league_folder && (
                <Image
                  src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                  alt={team.name}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              )}
              <span className="text-sm font-semibold group-hover:underline">{team.name}</span>
              <span className="text-text-muted text-xs">→</span>
            </Link>
          ) : (
            <Link
              href="/select-team"
              className="inline-flex items-center gap-space-1.5 text-sm text-text-muted hover:text-accent transition-colors"
            >
              <span className="text-accent">+</span>
              No team selected — select one
            </Link>
          )}

          <p className="text-xs text-text-muted">{user.email}</p>
        </div>
        
        {/* Quick Career Stats */}
        <div className="flex gap-space-4 sm:flex-col justify-center sm:justify-start pt-space-4 sm:pt-0">
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-text-primary">{stats.played}</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Matches</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-accent">{winRate}%</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
          </div>
        </div>
      </Card>

      {/* -- Career History Section ------------------------------------------ */}
      <Card className="p-space-5 space-y-space-4">
        <h2 className="section-header">
          <span>👔</span> Management History
        </h2>
        
        {(tenures ?? []).length === 0 ? (
          <p className="text-text-muted text-sm text-center py-space-4">No management history found.</p>
        ) : (
          <div className="space-y-space-3">
            {tenures.map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0
              
              return (
                <div key={tenure.id} className={`p-space-4 rounded-xl border flex items-center gap-space-4 ${
                  isCurrent 
                    ? 'bg-accent/5 border-accent/20' 
                    : 'bg-bg-elevated border-border'
                }`}>
                  <div className="w-10 h-10 bg-bg-surface rounded-lg p-space-1 border border-border flex items-center justify-center shrink-0">
                    {tenure.team?.logo_team_slug ? (
                      <Image 
                        src={getTeamLogo(tenure.team.logo_league_folder, tenure.team.logo_team_slug, 'standings_row')} 
                        alt={tenure.team.name} width={28} height={28} className="object-contain" 
                      />
                    ) : <span className="text-xl">🛡️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/teams/${tenure.team_id}`} className="font-bold text-text-primary hover:text-accent transition-colors truncate block text-sm">
                      {tenure.team?.name || 'Unknown Club'}
                    </Link>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                      {format(new Date(tenure.started_at), 'MMM yyyy')} — {tenure.ended_at ? format(new Date(tenure.ended_at), 'MMM yyyy') : 'Present'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-text-primary">{played} <span className="text-[9px] text-text-muted font-bold">P</span></p>
                    <p className="text-xs font-black text-accent">{tWinRate}% <span className="text-[9px] text-text-muted font-bold">WR</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* -- Team Change Request --------------------------------------------- */}
      <Card className="p-space-5 space-y-space-3">
        <h2 className="section-header">
          <span>🔄</span> Team Management
        </h2>
        <TeamChangeModal
          currentTeamId={team?.id ?? null}
          hasPendingRequest={!!pendingRequest}
          pendingRequestedTeamName={(pendingRequest as any)?.requested_team?.name ?? null}
        />

        {/* Past requests */}
        {changeRequests && changeRequests.length > 0 && (
          <div className="mt-space-3 space-y-space-1.5">
            {changeRequests.slice(0, 3).map((req: any) => {
              const statusStyle =
                req.status === 'approved'
                  ? 'text-feedback-success bg-feedback-success/10 border-feedback-success/20'
                  : req.status === 'denied'
                  ? 'text-feedback-error bg-feedback-error/10 border-feedback-error/20'
                  : 'text-feedback-warning bg-feedback-warning/10 border-feedback-warning/20'
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between text-xs px-space-3 py-space-2 rounded-lg border border-border bg-bg-base"
                >
                  <span className="text-text-secondary">
                    {req.requested_team?.name ?? 'Unknown team'}
                  </span>
                  <span className={`px-space-2 py-0.5 rounded border font-semibold capitalize ${statusStyle}`}>
                    {req.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* -- Upcoming Fixtures ----------------------------------------------- */}
      {team && (
        <Card className="p-space-5 space-y-space-4">
          <h2 className="section-header">
            <span>📅</span> Upcoming Fixtures
          </h2>

          {next3.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-space-4">No upcoming fixtures scheduled.</p>
          ) : (
            <div className="space-y-space-3">
              {next3.map((f: any) => {
                const isHome = teamIds.includes(f.home_team?.id)
                const opponent = isHome ? f.away_team : f.home_team
                const days = daysUntil(f.scheduled_date)
                const dateStr = f.scheduled_date
                  ? format(parseISO(f.scheduled_date), 'EEE d MMM')
                  : 'TBD'

                return (
                  <Link
                    key={f.id}
                    href={`/fixtures/${f.id}`}
                    className="flex items-center gap-space-4 p-space-4 rounded-xl border border-border hover:border-accent/40 hover:bg-bg-base transition-all group"
                  >
                    {opponent?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(opponent.logo_league_folder, opponent.logo_team_slug, 'standings_row')}
                        alt={opponent.name}
                        width={40}
                        height={40}
                        className="object-contain shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {isHome ? 'vs' : '@'}{' '}
                        <span>{opponent?.name ?? 'TBD'}</span>
                      </p>
                      <p className="text-xs text-text-muted mt-space-0.5">
                        {f.tournament?.name} · {dateStr}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {days != null && days >= 0 ? (
                        days === 0 ? (
                          <span className="text-xs font-bold text-accent bg-accent/10 px-space-2 py-space-1 rounded-lg">
                            Today
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">
                            in <span className="font-bold text-text-primary">{days}d</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-text-secondary">Past</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* -- Account Security ----------------------------------------------- */}
      <ProfileActions userEmail={user.email ?? ''} />

    </div>
  )
}
