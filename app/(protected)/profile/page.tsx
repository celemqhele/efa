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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = differenceInDays(parseISO(dateStr), new Date())
  return d
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

      {/* ── Profile Card ─────────────────────────────────────────────────── */}
      <div className="card p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Avatar */}
        <div className="shrink-0">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.username}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover ring-2 ring-[#c9a84c]/60"
            />
          ) : team?.logo_league_folder ? (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-[#c9a84c]/40 overflow-hidden p-2">
              <Image
                src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'profile_avatar')}
                alt={team.name}
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center ring-2 ring-[#c9a84c]/40">
              <span className="text-3xl font-black text-[#c9a84c]">{initials}</span>
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
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 text-[#c9a84c] text-xs font-bold uppercase tracking-wider">
                ⭐ Admin
              </span>
            )}
          </div>

          {team ? (
            <Link
              href={`/teams/${team.id}`}
              className="inline-flex items-center gap-2 text-slate-700 hover:text-[#c9a84c] transition-colors group"
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
              <span className="text-slate-500 text-xs">→</span>
            </Link>
          ) : (
            <Link
              href="/select-team"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#c9a84c] transition-colors"
            >
              <span className="text-[#c9a84c]">+</span>
              No team selected — select one
            </Link>
          )}

          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </div>

      {/* ── Team Change Request ───────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
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
          <div className="mt-3 space-y-1.5">
            {changeRequests.slice(0, 3).map((req: any) => {
              const statusStyle =
                req.status === 'approved'
                  ? 'text-green-400 bg-green-500/10 border-green-500/20'
                  : req.status === 'denied'
                  ? 'text-red-400 bg-red-500/10 border-red-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <span className="text-slate-400">
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

      {/* ── Upcoming Fixtures ─────────────────────────────────────────────── */}
      {team && (
        <div className="card p-5 space-y-4">
          <h2 className="section-header">
            <span>📅</span> Upcoming Fixtures
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
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-[#c9a84c]/40 hover:bg-black/[0.03] transition-all group"
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
                          <span className="text-xs font-bold text-[#c9a84c] bg-[#c9a84c]/10 px-2 py-1 rounded-lg">
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

      {/* ── Account Security ─────────────────────────────────────────────── */}
      <ProfileActions userEmail={user.email ?? ''} />

    </div>
  )
}
