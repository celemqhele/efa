'use client'

import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import TeamManageActions from './TeamManageActions'
import AddTeamForm from './AddTeamForm'
import { AlertTriangle } from 'lucide-react'

export default function Desktop({ data }: { data: any }) {
  const teams = data.teams as any[]
  const managerMap = data.managerMap as Record<string, { username: string; avatar_url: string | null }>

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Team Management</h1>
        <p className="text-text-muted text-sm mt-1">{(teams?.length ?? 0)} teams registered</p>
      </div>

      <AddTeamForm />

      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
          <h2 className="text-base font-bold text-text-primary">All Teams</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-base border-b-2 border-accent/20">
                <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Team</th>
                <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Manager</th>
                <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Abandons</th>
                <th className="text-right text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(teams ?? []).map((team) => {
                const manager = team.manager_id ? managerMap[team.manager_id] : null
                return (
                  <tr key={team.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {team.logo_league_folder ? (
                          <Image
                            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                            alt={team.name}
                            width={40} height={40}
                            className="object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-bg-base flex items-center justify-center text-text-muted text-xs">?</div>
                        )}
                        <div>
                          <p className="text-text-primary font-semibold">{team.name}</p>
                          <p className="text-text-muted text-xs">{team.logo_league_folder?.split('.')[0] ?? '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {manager ? (
                        <div className="flex items-center gap-2">
                          {manager.avatar_url ? (
                            <Image src={manager.avatar_url} alt="" width={24} height={24} className="rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-bg-base flex items-center justify-center text-xs text-text-muted">
                              {manager.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-text-primary text-sm">{manager.username}</span>
                        </div>
                      ) : (
                        <span className="text-green-400 text-xs font-medium">(Available)</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 font-bold text-sm ${
                        team.abandon_count >= 3 ? 'text-red-400' : 'text-text-muted'
                      }`}>
                        {team.abandon_count >= 3 && <AlertTriangle className="w-3.5 h-3.5" />}
                        {team.abandon_count}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <TeamManageActions
                        teamId={team.id}
                        teamName={team.name}
                        managerId={team.manager_id}
                        managerName={manager?.username ?? null}
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
