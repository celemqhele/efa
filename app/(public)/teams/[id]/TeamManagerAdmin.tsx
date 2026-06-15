'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Profile {
  id: string
  username: string
  avatar_url: string | null
}

interface Props {
  teamId: string
  currentManagerId: string | null
  currentManagerUsername: string | null
  currentManagerAvatar: string | null
  allProfiles: Profile[]
  managedTeamByUser: Record<string, string> // userId → team name
}

export default function TeamManagerAdmin({
  teamId,
  currentManagerId,
  currentManagerUsername,
  currentManagerAvatar,
  allProfiles,
  managedTeamByUser,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [managerId, setManagerId] = useState(currentManagerId)
  const [managerUsername, setManagerUsername] = useState(currentManagerUsername)
  const [managerAvatar, setManagerAvatar] = useState(currentManagerAvatar)

  const freeUsers = allProfiles.filter((p) => !managedTeamByUser[p.id])
  const busyUsers = allProfiles.filter((p) => !!managedTeamByUser[p.id] && p.id !== managerId)

  async function handleSack() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/managers/sack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setManagerId(null)
      setManagerUsername(null)
      setManagerAvatar(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(userId: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      const profile = allProfiles.find((p) => p.id === userId)
      setManagerId(userId)
      setManagerUsername(profile?.username ?? null)
      setManagerAvatar(profile?.avatar_url ?? null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 border-gold/20">
      <h2 className="section-header text-gold">Admin — Manager Controls</h2>

      {error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {managerId ? (
        <div className="flex items-center gap-3 bg-bg-surface border border-border rounded-xl px-4 py-3">
          {managerAvatar ? (
            <Image src={managerAvatar} alt={managerUsername ?? ''} width={40} height={40} className="rounded-full object-cover bg-bg-surface shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              <span className="text-gold font-bold">{(managerUsername ?? '?')[0].toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-foreground-primary font-semibold">@{managerUsername}</p>
            <p className="text-text-muted text-xs">Current manager</p>
          </div>
          <button
            onClick={handleSack}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Removing…' : 'Sack'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-text-muted mb-3">No manager assigned. Pick a user to assign:</p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {freeUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleAssign(user.id)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-bg-surface hover:border-gold/50 hover:bg-gold/5 transition-all text-left disabled:opacity-50"
              >
                {user.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.username} width={32} height={32} className="rounded-full object-cover bg-bg-elevated shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                    <span className="text-text-muted text-xs font-bold">{user.username[0].toUpperCase()}</span>
                  </div>
                )}
                <span className="text-foreground-primary text-sm font-medium flex-1">{user.username}</span>
                <span className="text-gold text-xs font-semibold">Assign →</span>
              </button>
            ))}

            {busyUsers.length > 0 && (
              <>
                <p className="text-xs text-text-muted uppercase tracking-wide font-medium pt-2 pb-1">
                  Already managing a club
                </p>
                {busyUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-bg-surface opacity-60"
                  >
                    {user.avatar_url ? (
                      <Image src={user.avatar_url} alt={user.username} width={32} height={32} className="rounded-full object-cover bg-bg-elevated shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                        <span className="text-text-muted text-xs font-bold">{user.username[0].toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground-secondary text-sm font-medium">{user.username}</p>
                      <p className="text-text-muted text-xs truncate">Manages {managedTeamByUser[user.id]} — sack first</p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {freeUsers.length === 0 && busyUsers.length === 0 && (
              <p className="text-text-muted text-sm text-center py-4">No registered users.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
