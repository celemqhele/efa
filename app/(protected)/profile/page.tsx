export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO, differenceInDays } from 'date-fns'
import TeamChangeModal from './TeamChangeModal'
import ProfileActions from './ProfileActions'

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

  // Fetch all team rows for the user — same club can appear across multiple phases
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

  // Upcoming fixtures (next 5 for user's team — covers all phase rows)
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
    <div className="space-y-8 max-w-3xl mx-auto">

      {/* -- Profile Card --------------------------------------------------- */}
      <div className="card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
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
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-accent/40 overflow-hidden p-2">
              <Image
                src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'profile_avatar')}
                alt={team.name}
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-accent/40">
              <span className="text-3xl font-black text-accent">{initials}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900">
              @{profile?.username ?? user.email}
            </h1>
            {profile?.role === 'admin' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-accent text-xs font-bold uppercase tracking-wider">
                ? Admin
              </span>
            )}
          </div>

          {team ? (
            <Link
              href={`/teams/${team.id}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-accent transition-colors group"
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
              <span className="text-slate-500 text-xs">?</span>
            </Link>
          ) : (
            <Link
              href="/select-team"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent transition-colors"
            >
              <span className="text-accent">+</span>
              No team selected — select one
            </Link>
          )}

          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        
        {/* Quick Career Stats */}
        <div className="flex gap-4 sm:flex-col justify-center sm:justify-start pt-4 sm:pt-0">
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-slate-900">{stats.played}</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Matches</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-accent">{winRate}%</p>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Win Rate</p>
          </div>
        </div>
      </div>

      {/* -- Career History Section ------------------------------------------ */}
      <div className="card p-5 space-y-4">
        <h2 className="section-header">
          <span>??</span> Management History
        </h2>
        
        {(tenures ?? []).length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No management history found.</p>
        ) : (
          <div className="space-y-3">
            {tenures.map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0
              
              return (
                <div key={tenure.id} className={`p-4 rounded-xl border flex items-center gap-4 ${
                  isCurrent 
                    ? 'bg-accent/5 border-accent/20' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="w-10 h-10 bg-white rounded-lg p-1 border border-slate-200 flex items-center justify-center shrink-0">
                    {tenure.team?.logo_team_slug ? (
                      <Image 
                        src={getTeamLogo(tenure.team.logo_league_folder, tenure.team.logo_team_slug, 'standings_row')} 
                        alt={tenure.team.name} width={28} height={28} className="object-contain" 
                      />
                    ) : <span className="text-xl">???</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/teams/${tenure.team_id}`} className="font-bold text-slate-900 hover:text-accent transition-colors truncate block text-sm">
                      {tenure.team?.name || 'Unknown Club'}
                    </Link>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {format(new Date(tenure.started_at), 'MMM yyyy')} — {tenure.ended_at ? format(new Date(tenure.ended_at), 'MMM yyyy') : 'Present'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{played} <span className="text-[9px] text-slate-400 font-bold">P</span></p>
                    <p className="text-xs font-black text-accent">{tWinRate}% <span className="text-[9px] text-slate-400 font-bold">WR</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* -- Team Change Request --------------------------------------------- */}
      <div className="card p-5 space-y-3">
        <h2 className="section-header">
          <span>??</span> Team Management
        </h2>
        <TeamChangeModal
          currentTeamId={team?.id ?? null}
          hasPendingRequest={!!pendingRequest}
          pendingRequestedTeamName={(pendingRequest as any)?.requested_team?.name ?? null}
        />

        {/* Past requests */}
        {changeRequests && changeRequests.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {changeRequests.slice(0, 3).map((req: any) => {
              const statusStyle =
                req.status === 'approved'
                  ? 'text-green-600 bg-green-50 border-green-200'
                  : req.status === 'denied'
                  ? 'text-red-600 bg-red-50 border-red-200'
                  : 'text-yellow-600 bg-yellow-50 border-yellow-200'
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border bg-slate-50"
                >
                  <span className="text-slate-600">
                    {req.requested_team?.name ?? 'Unknown team'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border font-semibold capitalize ${statusStyle}`}>
                    {req.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* -- Upcoming Fixtures ----------------------------------------------- */}
      {team && (
        <div className="card p-5 space-y-4">
          <h2 className="section-header">
            <span>??</span> Upcoming Fixtures
          </h2>

          {next3.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No upcoming fixtures scheduled.</p>
          ) : (
            <div className="space-y-3">
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
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-accent/40 hover:bg-black/[0.03] transition-all group"
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
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {isHome ? 'vs' : '@'}{' '}
                        <span>{opponent?.name ?? 'TBD'}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {f.tournament?.name} · {dateStr}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {days != null && days >= 0 ? (
                        days === 0 ? (
                          <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-lg">
                            Today
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            in <span className="font-bold text-slate-900">{days}d</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-600">Past</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* -- Account Security ----------------------------------------------- */}
      <ProfileActions userEmail={user.email ?? ''} />

    </div>
  )
}

