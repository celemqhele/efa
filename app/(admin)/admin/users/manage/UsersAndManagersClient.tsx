'use client'

import { useState } from 'react'
import Image from 'next/image'
import TeamLogo from '@/components/ui/TeamLogo'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Star, RefreshCw, UserCog, Briefcase } from 'lucide-react'
import ManagersClient from './ManagersClient'
import UserActionButtons from './UserActionButtons'
import TeamRequestButtons from '@/components/ui/TeamRequestButtons'
import ManagerApplicationButtons from '@/components/ui/ManagerApplicationButtons'

interface Props {
  data: any
  variant: 'desktop' | 'mobile'
}

export default function UsersAndManagersClient({ data, variant }: Props) {
  const { profiles, teamByManager, changeRequests, managerApplications, profileMap, managerTeams, managedTeamByUser, hasAvailabilityIds } = data
  const [activeTab, setActiveTab] = useState<'users' | 'managers'>('users')

  const isDesktop = variant === 'desktop'
  const pendingCount = (changeRequests?.length ?? 0) + (managerApplications?.length ?? 0)

  const tabBtn = (tab: 'users' | 'managers', label: string, icon: any, sub?: string) => {
    const Icon = icon
    const active = activeTab === tab
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
          active
            ? 'bg-accent text-bg-base shadow-sm'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/80'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
        {sub && <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-bg-base/20' : 'bg-accent/20 text-accent'}`}>{sub}</span>}
      </button>
    )
  }

  const header =
    isDesktop ? (
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users &amp; Managers</h1>
          <p className="text-text-muted text-sm mt-space-1">{(profiles?.length ?? 0)} registered users</p>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Users &amp; Managers</h1>
          <p className="text-text-muted text-xs mt-space-1">{(profiles?.length ?? 0)} registered users</p>
        </div>
      </div>
    )

  const tabs = (
    <div className="flex items-center gap-2">
      {tabBtn('users', 'Users', UserCog)}
      {tabBtn('managers', 'Assign Managers', Briefcase, `${managerTeams?.filter((t: any) => t.manager_id).length ?? 0}/${managerTeams?.length ?? 0}`)}
    </div>
  )

  const container = isDesktop ? 'max-w-7xl mx-auto space-y-6' : 'px-4 pb-8 space-y-5'

  return (
    <div className={container}>
      {header}
      {tabs}

      {activeTab === 'managers' ? (
        <ManagersClient
          teams={managerTeams ?? []}
          profiles={profiles ?? []}
          managedTeamByUser={managedTeamByUser ?? {}}
          hasAvailabilityIds={hasAvailabilityIds ?? []}
        />
      ) : (
        <>
          {/* Pending Manager Applications */}
          {(managerApplications?.length ?? 0) > 0 && (
            <Card className={isDesktop ? 'p-space-5' : 'p-space-3'}>
              <h2 className="section-header">
                <Star className={`${isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-accent`} />
                Manager Applications
                <span className={`ml-auto ${isDesktop ? 'text-xs' : 'text-[10px]'} bg-accent/20 text-accent border border-accent/30 rounded-full px-space-2 py-0.5`}>
                  {managerApplications!.length}
                </span>
              </h2>
              {isDesktop ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-base border-b-2 border-accent/20">
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
                              {team ? (
                                <div className="flex items-center gap-space-2">
                                  {team.logo_league_folder && (
                                    <TeamLogo leagueFolder={team.logo_league_folder} teamSlug={team.logo_team_slug} context="standings_row" alt="" className="w-6 h-6" />
                                  )}
                                  <span className="text-text-primary">{team.name}</span>
                                </div>
                              ) : (
                                <span className="text-text-muted text-xs italic">Waiting for team — assign via WhatsApp</span>
                              )}
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
                              <ManagerApplicationButtons applicationId={app.id} hasTeam={!!team} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-space-2">
                  {managerApplications!.map((app: any) => {
                    const applicant = Array.isArray(app.applicant) ? app.applicant[0] : app.applicant
                    const team = Array.isArray(app.team) ? app.team[0] : app.team
                    const currentManagerName = team?.manager_id ? (profileMap[team.manager_id] ?? 'Unknown') : null
                    return (
                      <div key={app.id} className="bg-bg-elevated/50 border border-border rounded-lg p-space-3 space-y-space-2">
                        <div className="flex items-center gap-space-2">
                          {applicant?.avatar_url ? (
                            <Image src={applicant.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center text-xs text-text-muted">
                              {applicant?.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-text-primary font-medium text-sm">{applicant?.username}</span>
                          <span className="text-text-muted text-xs ml-auto">{new Date(app.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div className="flex items-center gap-space-2 flex-wrap">
                          {team ? (
                            <>
                              {team.logo_league_folder && (
                                <TeamLogo leagueFolder={team.logo_league_folder} teamSlug={team.logo_team_slug} context="standings_row" alt="" className="w-5 h-5" />
                              )}
                              <span className="text-text-primary text-sm">Wants to manage: <strong>{team.name}</strong></span>
                              {currentManagerName && (
                                <span className="text-text-muted text-xs">(Current: @{currentManagerName})</span>
                              )}
                            </>
                          ) : (
                            <span className="text-text-muted text-xs italic">Waiting for team — assign via WhatsApp</span>
                          )}
                        </div>
                        <ManagerApplicationButtons applicationId={app.id} hasTeam={!!team} />
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Pending Team Change Requests */}
          {(changeRequests?.length ?? 0) > 0 && (
            <Card className={isDesktop ? 'p-space-5' : 'p-space-3'}>
              <h2 className="section-header">
                <RefreshCw className={`${isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-feedback-warning`} />
                Pending Team Change Requests
                <span className={`ml-auto ${isDesktop ? 'text-xs' : 'text-[10px]'} bg-feedback-warning/20 text-feedback-warning border border-feedback-warning/30 rounded-full px-space-2 py-0.5`}>
                  {changeRequests!.length}
                </span>
              </h2>
              {isDesktop ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-base border-b-2 border-accent/20">
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
                                <TeamLogo leagueFolder={req.requested_team.logo_league_folder} teamSlug={req.requested_team.logo_team_slug} context="standings_row" alt="" className="w-6 h-6" />
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
              ) : (
                <div className="space-y-space-2">
                  {changeRequests!.map((req: any) => (
                    <div key={req.id} className="bg-bg-elevated/50 border border-border rounded-lg p-space-3 space-y-space-2">
                      <div className="flex items-center gap-space-2">
                        {req.requesting_user?.avatar_url ? (
                          <Image src={req.requesting_user.avatar_url} alt="" width={28} height={28} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center text-xs text-text-muted">
                            {req.requesting_user?.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-text-primary font-medium text-sm">{req.requesting_user?.username}</span>
                        <span className="text-text-muted text-xs ml-auto">{new Date(req.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      <div className="flex items-center gap-space-2 flex-wrap text-sm">
                        <span className="text-text-secondary">{req.current_team?.name ?? 'No team'}</span>
                        <span className="text-text-muted">→</span>
                        {req.requested_team?.logo_league_folder && (
                          <TeamLogo leagueFolder={req.requested_team.logo_league_folder} teamSlug={req.requested_team.logo_team_slug} context="standings_row" alt="" className="w-5 h-5" />
                        )}
                        <span className="text-text-primary">{req.requested_team?.name}</span>
                      </div>
                      <TeamRequestButtons requestId={req.id} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Users */}
          <Card className={isDesktop ? 'p-space-5' : 'p-space-3'}>
            <h2 className="section-header">All Users</h2>
            {isDesktop ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-base border-b-2 border-accent/20">
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
                                  <TeamLogo leagueFolder={team.logo_league_folder} teamSlug={team.logo_team_slug} context="standings_row" alt={team.name} className="w-7 h-7" />
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
            ) : (
              <div className="space-y-space-2">
                {(profiles ?? []).map((profile: any) => {
                  const team = teamByManager[profile.id]
                  return (
                    <div key={profile.id} className="bg-bg-elevated/50 border border-border rounded-lg p-space-3 space-y-space-2">
                      <div className="flex items-center gap-space-3">
                        {profile.avatar_url ? (
                          <Image src={profile.avatar_url} alt="" width={36} height={36} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-border-subtle flex items-center justify-center text-sm font-bold text-text-muted">
                            {profile.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-space-2">
                            <p className="text-text-primary font-medium text-sm truncate">{profile.username}</p>
                            <span className={`text-[10px] px-space-1.5 py-0.5 rounded border font-medium ${
                              profile.role === 'admin'
                                ? 'text-accent bg-accent/10 border-accent/30'
                                : 'text-text-secondary bg-border-subtle border-border'
                            }`}>
                              {profile.role}
                            </span>
                          </div>
                          <p className="text-text-muted text-xs">
                            Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-space-2">
                        <div className="flex items-center gap-space-2">
                          {team ? (
                            <>
                              {team.logo_league_folder && (
                                <TeamLogo leagueFolder={team.logo_league_folder} teamSlug={team.logo_team_slug} context="standings_row" alt={team.name} className="w-6 h-6" />
                              )}
                              <span className="text-text-primary text-xs">{team.name}</span>
                              {team.abandon_count >= 3 && (
                                <span className="text-feedback-error font-bold text-xs"><AlertTriangle className="w-3 h-3 inline" /> {team.abandon_count}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-text-muted text-xs italic">No team</span>
                          )}
                        </div>
                        <UserActionButtons
                          profileId={profile.id}
                          username={profile.username}
                          currentRole={profile.role}
                          teamId={team?.id ?? null}
                          teamName={team?.name ?? null}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
