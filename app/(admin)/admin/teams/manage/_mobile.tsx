'use client'

import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamManageActions from './TeamManageActions'
import AddTeamForm from './AddTeamForm'
import { Card } from '@/components/ui/Card'
import { AlertTriangle } from 'lucide-react'

export default function Mobile({ data }: { data: any }) {
  const teams = data.teams as any[]
  const managerMap = data.managerMap as Record<string, { username: string; avatar_url: string | null }>

  return (
    <div className="space-y-space-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Team Management</h1>
          <p className="text-text-muted text-xs mt-space-1">{(teams?.length ?? 0)} teams registered</p>
        </div>
      </div>

      <AddTeamForm />

      <Card className="p-space-3">
        <h2 className="section-header">All Teams</h2>

        <div className="space-y-space-2">
          {(teams ?? []).map((team) => {
            const manager = team.manager_id ? managerMap[team.manager_id] : null
            return (
              <div key={team.id} className="bg-bg-elevated rounded-lg p-space-3 space-y-space-2 border border-border">
                <div className="flex items-center gap-space-3">
                  {team.logo_league_folder ? (
                    <Image
                      src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                      alt={team.name}
                      width={44} height={44}
                      className="object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded bg-bg-base flex items-center justify-center text-text-muted text-xs shrink-0">?</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary font-semibold text-sm truncate">{team.name}</p>
                    <p className="text-text-muted text-xs truncate">{team.logo_league_folder?.split('.')[0] ?? '-'}</p>
                  </div>
                  {team.abandon_count >= 3 && (
                    <span className="text-feedback-error font-bold text-xs shrink-0"><AlertTriangle className="w-3 h-3 inline" /> {team.abandon_count}</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-space-2">
                  <div className="flex items-center gap-space-2">
                    {manager ? (
                      <>
                        {manager.avatar_url ? (
                          <Image src={manager.avatar_url} alt="" width={20} height={20} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-bg-base flex items-center justify-center text-xs text-text-muted">
                            {manager.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-text-secondary text-xs">{manager.username}</span>
                      </>
                    ) : (
                      <span className="text-feedback-success text-xs">(Available)</span>
                    )}
                  </div>
                  <TeamManageActions
                    teamId={team.id}
                    teamName={team.name}
                    managerId={team.manager_id}
                    managerName={manager?.username ?? null}
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
