import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import UserActionButtons from './UserActionButtons'
import TeamRequestButtons from '@/components/ui/TeamRequestButtons'
import ManagerApplicationButtons from '@/components/ui/ManagerApplicationButtons'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Star, RefreshCw } from 'lucide-react'

export default function Mobile({ data }: { data: any }) {
  const { profiles, teamByManager, changeRequests, managerApplications, profileMap } = data

  return (
    <div className="space-y-space-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">User Management</h1>
          <p className="text-text-muted text-xs mt-space-1">{(profiles?.length ?? 0)} registered users</p>
        </div>
      </div>

      {/* Pending Manager Applications */}
      {(managerApplications?.length ?? 0) > 0 && (
        <Card className="p-space-3">
          <h2 className="section-header">
            <Star className="w-4 h-4 text-accent" />
            Manager Applications
            <span className="ml-auto text-[10px] bg-accent/20 text-accent border border-accent/30 rounded-full px-space-2 py-0.5">
              {managerApplications!.length}
            </span>
          </h2>
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
                    {team?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                        alt="" width={20} height={20} className="object-contain"
                      />
                    )}
                    <span className="text-text-primary text-sm">Wants to manage: <strong>{team?.name}</strong></span>
                    {currentManagerName && (
                      <span className="text-text-muted text-xs">(Current: @{currentManagerName})</span>
                    )}
                  </div>
                  <ManagerApplicationButtons applicationId={app.id} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Pending Team Change Requests */}
      {(changeRequests?.length ?? 0) > 0 && (
        <Card className="p-space-3">
          <h2 className="section-header">
            <RefreshCw className="w-4 h-4 text-feedback-warning" />
            Pending Team Change Requests
            <span className="ml-auto text-[10px] bg-feedback-warning/20 text-feedback-warning border border-feedback-warning/30 rounded-full px-space-2 py-0.5">
              {changeRequests!.length}
            </span>
          </h2>
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
                    <Image
                      src={getTeamLogo(req.requested_team.logo_league_folder, req.requested_team.logo_team_slug, 'standings_row')}
                      alt="" width={20} height={20} className="object-contain"
                    />
                  )}
                  <span className="text-text-primary">{req.requested_team?.name}</span>
                </div>
                <TeamRequestButtons requestId={req.id} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Users List */}
      <Card className="p-space-3">
        <h2 className="section-header">All Users</h2>
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
                          <Image
                            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                            alt={team.name}
                            width={24} height={24}
                            className="object-contain"
                          />
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
      </Card>
    </div>
  )
}
