import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import UserActionButtons from './UserActionButtons'
import TeamRequestButtons from '@/components/ui/TeamRequestButtons'
import ManagerApplicationButtons from '@/components/ui/ManagerApplicationButtons'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Star, RefreshCw } from 'lucide-react'

export default function Desktop({ data }: { data: any }) {
  const { profiles, teamByManager, changeRequests, managerApplications, profileMap } = data

  return (
    <div className="max-w-6xl mx-auto space-y-space-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
          <p className="text-text-muted text-sm mt-space-1">{(profiles?.length ?? 0)} registered users</p>
        </div>
      </div>

      {/* Pending Manager Applications */}
      {(managerApplications?.length ?? 0) > 0 && (
        <Card className="p-space-5">
          <h2 className="section-header">
            <Star className="w-5 h-5 text-accent" />
            Manager Applications
            <span className="ml-auto text-xs bg-accent/20 text-accent border border-accent/30 rounded-full px-space-2 py-0.5">
              {managerApplications!.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Applicant</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Wants to Manage</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Current Manager</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Date</th>
                  <th className="text-left text-xs text-text-muted pb-space-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {managerApplications!.map((app: any) => {
                  const applicant = Array.isArray(app.applicant) ? app.applicant[0] : app.applicant
                  const team = Array.isArray(app.team) ? app.team[0] : app.team
                  const currentManagerName = team?.manager_id ? (profileMap[team.manager_id] ?? 'Unknown') : null
                  return (
                    <tr key={app.id}>
                      <td className="py-space-3 pr-space-4">
                        <div className="flex items-center gap-space-2">
                          {applicant?.avatar_url ? (
                            <Image src={applicant.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center text-xs text-text-muted">
                              {applicant?.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-text-primary font-medium">{applicant?.username}</span>
                        </div>
                      </td>
                      <td className="py-space-3 pr-space-4">
                        <div className="flex items-center gap-space-2">
                          {team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                              alt="" width={24} height={24} className="object-contain"
                            />
                          )}
                          <span className="text-text-primary">{team?.name}</span>
                        </div>
                      </td>
                      <td className="py-space-3 pr-space-4">
                        {currentManagerName ? (
                          <span className="text-text-secondary text-xs">@{currentManagerName}</span>
                        ) : (
                          <span className="text-text-muted text-xs italic">Vacant</span>
                        )}
                      </td>
                      <td className="py-space-3 pr-space-4 text-text-muted text-xs">
                        {new Date(app.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3">
                        <ManagerApplicationButtons applicationId={app.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pending Team Change Requests */}
      {(changeRequests?.length ?? 0) > 0 && (
        <Card className="p-space-5">
          <h2 className="section-header">
            <RefreshCw className="w-5 h-5 text-feedback-warning" />
            Pending Team Change Requests
            <span className="ml-auto text-xs bg-feedback-warning/20 text-feedback-warning border border-feedback-warning/30 rounded-full px-space-2 py-0.5">
              {changeRequests!.length}
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">User</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">From</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Requested Team</th>
                  <th className="text-left text-xs text-text-muted pb-space-2 pr-space-4">Date</th>
                  <th className="text-left text-xs text-text-muted pb-space-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {changeRequests!.map((req: any) => (
                  <tr key={req.id}>
                    <td className="py-space-3 pr-space-4">
                      <div className="flex items-center gap-space-2">
                        {req.requesting_user?.avatar_url ? (
                          <Image src={req.requesting_user.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center text-xs text-text-muted">
                            {req.requesting_user?.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-text-primary font-medium">{req.requesting_user?.username}</span>
                      </div>
                    </td>
                    <td className="py-space-3 pr-space-4 text-text-secondary">{req.current_team?.name ?? 'No team'}</td>
                    <td className="py-space-3 pr-space-4">
                      <div className="flex items-center gap-space-2">
                        {req.requested_team?.logo_league_folder && (
                          <Image
                            src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')}
                            alt="" width={24} height={24} className="object-contain"
                          />
                        )}
                        <span className="text-text-primary">{req.requested_team?.name}</span>
                      </div>
                    </td>
                    <td className="py-space-3 pr-space-4 text-text-muted text-xs">
                      {new Date(req.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-space-3">
                      <TeamRequestButtons requestId={req.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Users Table */}
      <Card className="p-space-5">
        <h2 className="section-header">All Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-muted pb-space-3 pr-space-4">User</th>
                <th className="text-left text-xs text-text-muted pb-space-3 pr-space-4">Role</th>
                <th className="text-left text-xs text-text-muted pb-space-3 pr-space-4">Team</th>
                <th className="text-left text-xs text-text-muted pb-space-3 pr-space-4">Abandons</th>
                <th className="text-left text-xs text-text-muted pb-space-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(profiles ?? []).map((profile: any) => {
                const team = teamByManager[profile.id]
                return (
                  <tr key={profile.id} className="hover:bg-bg-base transition-colors">
                    <td className="py-space-3 pr-space-4">
                      <div className="flex items-center gap-space-3">
                        {profile.avatar_url ? (
                          <Image src={profile.avatar_url} alt="" width={36} height={36} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-border-subtle flex items-center justify-center text-sm font-bold text-text-muted">
                            {profile.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-text-primary font-medium">{profile.username}</p>
                          <p className="text-text-muted text-xs">
                            Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-space-3 pr-space-4">
                      <span className={`text-xs px-space-2 py-0.5 rounded border font-medium ${
                        profile.role === 'admin'
                          ? 'text-accent bg-accent/10 border-accent/30'
                          : 'text-text-secondary bg-border-subtle border-border'
                      }`}>
                        {profile.role}
                      </span>
                    </td>
                    <td className="py-space-3 pr-space-4">
                      {team ? (
                        <div className="flex items-center gap-space-2">
                          {team.logo_league_folder && (
                            <Image
                              src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                              alt={team.name}
                              width={28} height={28}
                              className="object-contain"
                            />
                          )}
                          <span className="text-text-primary text-sm">{team.name}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs italic">No team</span>
                      )}
                    </td>
                    <td className="py-space-3 pr-space-4">
                      {team ? (
                        <span className={`inline-flex items-center gap-space-1 text-sm font-bold ${
                          team.abandon_count >= 3 ? 'text-feedback-error' : 'text-text-muted'
                        }`}>
                          {team.abandon_count >= 3 && <AlertTriangle className="w-3 h-3 inline" />}
                          {team.abandon_count}
                        </span>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-space-3">
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
      </Card>
    </div>
  )
}
