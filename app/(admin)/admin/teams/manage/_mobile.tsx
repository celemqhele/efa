'use client'

import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamManageActions from './TeamManageActions'
import AddTeamForm from './AddTeamForm'
import { AlertTriangle } from 'lucide-react'

export default function Mobile({ data }: { data: any }) {
  const teams = data.teams as any[]
  const managerMap = data.managerMap as Record<string, { username: string; avatar_url: string | null }>

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Team Management</h1>
          <p className="text-text-muted text-xs mt-0.5">{(teams?.length ?? 0)} teams registered</p>
        </div>
      </div>

      <AddTeamForm />

      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3.5 bg-bg-base border-b-2 border-accent/20">
          <h2 className="text-sm font-bold text-text-primary">All Teams</h2>
        </div>

        <div className="divide-y divide-border">
          {(teams ?? []).map((team) => {
            const manager = team.manager_id ? managerMap[team.manager_id] : null
            return (
              <div key={team.id} className="p-4 space-y-3">
                <div className="flex items-center gap-3">
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
                    <span className="text-red-400 font-bold text-xs shrink-0 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {team.abandon_count}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {manager ? (
                      <>
                        {manager.avatar_url ? (
                          <Image src={manager.avatar_url} alt="" width={22} height={22} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-bg-base flex items-center justify-center text-xs text-text-muted">
                            {manager.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="text-text-secondary text-xs">{manager.username}</span>
                      </>
                    ) : (
                      <span className="text-green-400 text-xs">(Available)</span>
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
      </div>
    </div>
  )
}
