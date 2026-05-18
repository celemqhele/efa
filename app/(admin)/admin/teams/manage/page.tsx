import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import Image from 'next/image'
import TeamManageActions from './TeamManageActions'
import AddTeamForm from './AddTeamForm'

export const revalidate = 0

export default async function TeamsManagePage() {
  const supabase = await createClient()

  // All teams with manager info
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, logo_league_folder, logo_team_slug, manager_id, abandon_count, created_at')
    .order('name', { ascending: true })

  // Manager profiles
  const managerIds = (teams ?? []).filter((t) => t.manager_id).map((t) => t.manager_id!)
  const { data: managers } = managerIds.length
    ? await supabase.from('profiles').select('id, username, avatar_url').in('id', managerIds)
    : { data: [] }

  const managerMap: Record<string, { username: string; avatar_url: string | null }> = {}
  for (const m of managers ?? []) managerMap[m.id] = m

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="text-slate-400 text-sm mt-1">{(teams?.length ?? 0)} teams registered</p>
        </div>
      </div>

      {/* Add Team */}
      <AddTeamForm />

      {/* Teams Table */}
      <div className="card p-5">
        <h2 className="section-header">All Teams</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-border">
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Team</th>
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Manager</th>
                <th className="text-left text-xs text-slate-500 pb-3 pr-4">Abandons</th>
                <th className="text-left text-xs text-slate-500 pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-border">
              {(teams ?? []).map((team) => {
                const manager = team.manager_id ? managerMap[team.manager_id] : null
                return (
                  <tr key={team.id} className="hover:bg-navy-light/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {team.logo_league_folder ? (
                          <Image
                            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                            alt={team.name}
                            width={48} height={48}
                            className="object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-navy-border flex items-center justify-center text-slate-500 text-xs">
                            ?
                          </div>
                        )}
                        <div>
                          <p className="text-white font-semibold">{team.name}</p>
                          <p className="text-slate-500 text-xs">{team.logo_league_folder?.split('.')[0] ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {manager ? (
                        <div className="flex items-center gap-2">
                          {manager.avatar_url ? (
                            <Image src={manager.avatar_url} alt="" width={24} height={24} className="rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-navy-border flex items-center justify-center text-xs text-slate-400">
                              {manager.username?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-white">{manager.username}</span>
                        </div>
                      ) : (
                        <span className="text-green-400 text-xs font-medium">(Available)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        team.abandon_count >= 3 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        {team.abandon_count >= 3 && <span className="text-xs">⚠</span>}
                        {team.abandon_count}
                      </span>
                    </td>
                    <td className="py-3">
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
