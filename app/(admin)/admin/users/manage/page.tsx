import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import Link from 'next/link'
import UserActionButtons from './UserActionButtons'

export const revalidate = 0

export default async function UsersManagePage() {
  const supabase = await createClient()

  // All profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, role, avatar_url, created_at')
    .order('created_at', { ascending: false })

  // All teams (to find which team each user manages)
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id, abandon_count')

  // Build user → team map
  const teamByManager: Record<string, any> = {}
  for (const team of teams ?? []) {
    if (team.manager_id) teamByManager[team.manager_id] = team
  }

  // Pending team change requests with user + team info
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 text-sm mt-1">{(profiles?.length ?? 0)} registered users</p>
        </div>
      </div>

      {/* Pending Team Change Requests */}
      {(changeRequests?.length ?? 0) > 0 && (
        <div className="card p-5">
          <h2 className="section-header">
            <span className="text-yellow-400">🔄</span>
            Pending Team Change Requests
            <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full px-2 py-0.5">
              {changeRequests!.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-border">
                  <th className="text-left text-xs text-slate-500 pb-2 pr-4">User</th>
                  <th className="text-left text-xs text-slate-500 pb-2 pr-4">From</th>
                  <th className="text-left text-xs text-slate-500 pb-2 pr-4">Requested Team</th>
                  <th className="text-left text-xs text-slate-500 pb-2 pr-4">Date</th>
                  <th className="text-left text-xs text-slate-500 pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-border">
                {changeRequests!.map((req: any) => (
                  <tr key={req.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {req.requesting_user?.avatar_url ? (
                          <Image src={req.requesting_user.avatar_url} alt="" width={28} height={28} className="rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-navy-border flex items-center justify-center text-xs text-slate-400">
                            {req.requesting_user?.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-white font-medium">{req.requesting_user?.username}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{req.current_team?.name ?? 'No team'}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {req.requested_team?.logo_league_folder && (
                          <Image
                            src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')}
                            alt="" width={24} height={24} className="object-contain"
                          />
                        )}
                        <span className="text-white">{req.requested_team?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">
                      {new Date(req.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <form action="/api/admin/team-request" method="POST">
                          <input type="hidden" name="requestId" value={req.id} />
                          <input type="hidden" name="action" value="approve" />
                          <button type="submit" className="btn-gold text-xs py-1 px-3">Approve</button>
                        </form>
                        <form action="/api/admin/team-request" method="POST">
                          <input type="hidden" name="requestId" value={req.id} />
                          <input type="hidden" name="action" value="deny" />
                          <button type="submit" className="btn-danger text-xs py-1 px-3">Deny</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card p-5">
        <h2 className="section-header">All Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-border">
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">User</th>
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Role</th>
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Team</th>
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Abandons</th>
                <th className="text-left text-xs text-slate-500 pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-border">
              {(profiles ?? []).map((profile) => {
                const team = teamByManager[profile.id]
                return (
                  <tr key={profile.id} className="hover:bg-navy-light/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {profile.avatar_url ? (
                          <Image src={profile.avatar_url} alt="" width={36} height={36} className="rounded-full" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-navy-border flex items-center justify-center text-sm font-bold text-slate-400">
                            {profile.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{profile.username}</p>
                          <p className="text-slate-500 text-xs">
                            Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        profile.role === 'admin'
                          ? 'text-gold bg-gold/10 border-gold/30'
                          : 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                      }`}>
                        {profile.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {team ? (
                        <div className="flex items-center gap-2">
                          {team.logo_league_folder && (
                            <Image
                              src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                              alt={team.name}
                              width={28} height={28}
                              className="object-contain"
                            />
                          )}
                          <span className="text-white text-sm">{team.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">No team</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {team ? (
                        <span className={`inline-flex items-center gap-1 text-sm font-bold ${
                          team.abandon_count >= 3 ? 'text-red-400' : 'text-slate-400'
                        }`}>
                          {team.abandon_count >= 3 && <span>⚠</span>}
                          {team.abandon_count}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <UserActionButtons
                        profileId={profile.id}
                        username={profile.username}
                        currentRole={profile.role}
                        teamId={team?.id ?? null}
                        teamName={team?.name ?? null}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
