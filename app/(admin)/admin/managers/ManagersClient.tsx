'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Team {
  id: string
  name: string
  logo_league_folder: string | null
  logo_team_slug: string | null
  manager_id: string | null
}

interface Profile {
  id: string
  username: string
  avatar_url: string | null
  role: string
}

interface Props {
  teams: Team[]
  profiles: Profile[]
  managedTeamByUser: Record<string, Team>
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function ManagersClient({ teams, profiles, managedTeamByUser }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localTeams, setLocalTeams] = useState<Team[]>(teams)
  const [localManagedMap, setLocalManagedMap] = useState<Record<string, Team>>(managedTeamByUser)

  const managerProfile = selectedTeam?.manager_id
    ? profiles.find((p) => p.id === selectedTeam.manager_id) ?? null
    : null

  // Users who are not managing any team (available to assign)
  const freeUsers = profiles.filter((p) => !localManagedMap[p.id])
  // Users who already manage a team
  const busyUsers = profiles.filter((p) => !!localManagedMap[p.id])

  async function handleSack(teamId: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/managers/sack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove manager')

      // Update local state
      setLocalTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, manager_id: null } : t))
      )
      setLocalManagedMap((prev) => {
        const next = { ...prev }
        const managerId = selectedTeam?.manager_id
        if (managerId) delete next[managerId]
        return next
      })
      setSelectedTeam((t) => (t ? { ...t, manager_id: null } : null))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(teamId: string, userId: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign manager')

      // Update local state
      setLocalTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, manager_id: userId } : t))
      )
      const assignedTeam = localTeams.find((t) => t.id === teamId)
      if (assignedTeam) {
        setLocalManagedMap((prev) => ({ ...prev, [userId]: { ...assignedTeam, manager_id: userId } }))
      }
      setSelectedTeam((t) => (t ? { ...t, manager_id: userId } : null))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const managedCount = localTeams.filter((t) => t.manager_id).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Team list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {managedCount} / {localTeams.length} clubs managed
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Managed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" /> Vacant
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {localTeams.map((team) => {
            const isSelected = selectedTeam?.id === team.id
            const manager = team.manager_id ? profiles.find((p) => p.id === team.manager_id) : null
            return (
              <button
                key={team.id}
                onClick={() => { setSelectedTeam(team); setError('') }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-gold bg-gold/10 shadow-[0_0_12px_rgba(201,168,76,0.15)]'
                    : 'border-slate-200 bg-white hover:border-gold/40 hover:bg-gold/5'
                }`}
              >
                {/* Logo */}
                <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-slate-50 rounded-lg">
                  {team.logo_league_folder && team.logo_team_slug ? (
                    <Image
                      src={logoSrc(team.logo_league_folder, team.logo_team_slug)}
                      alt={team.name}
                      width={36} height={36}
                      className="object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                    />
                  ) : (
                    <span className="text-slate-300 text-xs font-bold">?</span>
                  )}
                </div>

                {/* Name + manager */}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-sm font-semibold truncate">{team.name}</p>
                  {manager ? (
                    <p className="text-green-600 text-xs truncate">{manager.username}</p>
                  ) : (
                    <p className="text-slate-400 text-xs italic">No manager</p>
                  )}
                </div>

                {/* Status dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${team.manager_id ? 'bg-green-400' : 'bg-slate-300'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="lg:sticky lg:top-20 self-start">
        {!selectedTeam ? (
          <div className="card p-12 text-center text-slate-400">
            <p className="text-4xl mb-3">👔</p>
            <p className="text-sm">Select a club to manage its manager.</p>
          </div>
        ) : (
          <div className="card p-5 space-y-5">
            {/* Team header */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
              <div className="w-14 h-14 shrink-0 flex items-center justify-center bg-slate-50 rounded-xl">
                {selectedTeam.logo_league_folder && selectedTeam.logo_team_slug ? (
                  <Image
                    src={logoSrc(selectedTeam.logo_league_folder, selectedTeam.logo_team_slug)}
                    alt={selectedTeam.name}
                    width={52} height={52}
                    className="object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                  />
                ) : (
                  <span className="text-slate-300 text-lg font-bold">?</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedTeam.name}</h2>
                <p className="text-slate-400 text-sm">
                  {selectedTeam.manager_id ? 'Has a manager' : 'Vacant — no manager'}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Current manager */}
            {selectedTeam.manager_id && managerProfile ? (
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Current Manager</p>
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                  {managerProfile.avatar_url ? (
                    <Image
                      src={managerProfile.avatar_url}
                      alt={managerProfile.username}
                      width={40} height={40}
                      className="rounded-full object-contain bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                      <span className="text-gold font-bold text-sm">
                        {managerProfile.username[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-semibold">{managerProfile.username}</p>
                    <p className="text-slate-400 text-xs capitalize">{managerProfile.role}</p>
                  </div>
                  <button
                    onClick={() => handleSack(selectedTeam.id)}
                    disabled={loading}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Assign a Manager</p>

                {/* Free users */}
                {freeUsers.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">
                    All registered users are already managing a team.
                  </p>
                )}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {freeUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAssign(selectedTeam.id, user.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-gold/50 hover:bg-gold/5 transition-all text-left disabled:opacity-50"
                    >
                      {user.avatar_url ? (
                        <Image
                          src={user.avatar_url}
                          alt={user.username}
                          width={32} height={32}
                          className="rounded-full object-contain bg-slate-100 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <span className="text-slate-500 text-xs font-bold">
                            {user.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-medium">{user.username}</p>
                        <p className="text-green-600 text-xs">Available</p>
                      </div>
                      <span className="text-gold text-xs font-semibold shrink-0">Assign →</span>
                    </button>
                  ))}

                  {/* Busy users (already have a team) */}
                  {busyUsers.length > 0 && (
                    <>
                      {freeUsers.length > 0 && (
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide pt-2 pb-1">
                          Already managing a club
                        </p>
                      )}
                      {busyUsers.map((user) => {
                        const theirTeam = localManagedMap[user.id]
                        return (
                          <div
                            key={user.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          >
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.username}
                                width={32} height={32}
                                className="rounded-full object-contain bg-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <span className="text-slate-500 text-xs font-bold">
                                  {user.username[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-slate-700 text-sm font-medium">{user.username}</p>
                              <p className="text-slate-400 text-xs truncate">
                                Manages {theirTeam?.name ?? 'a team'} — sack first
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
