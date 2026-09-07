'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import BottomSheet from '@/components/ui/BottomSheet'
import SackCooldownDialog from '@/components/ui/SackCooldownDialog'
import { LEAGUE_META } from '@/lib/registry'
import { Search, X } from 'lucide-react'

interface Team {
  id: string
  name: string
  logo_league_folder: string | null
  logo_team_slug: string | null
  manager_id: string | null
}

interface Props {
  profileId: string
  username: string
  currentRole: string
  teamId: string | null
  teamName: string | null
  teams?: Team[]
  profiles?: any[]
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function UserActionButtons({ profileId, username, currentRole, teamId, teamName, teams = [], profiles = [] }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [role, setRole] = useState(currentRole)
  const [hasTeam, setHasTeam] = useState(!!teamId)
  const [localTeamName, setLocalTeamName] = useState(teamName)
  const [dialog, setDialog] = useState<'sack' | 'role' | 'reset-password' | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  // Assign-team picker state
  const [assignOpen, setAssignOpen] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [assignLoading, setAssignLoading] = useState<string | null>(null)
  const [assignError, setAssignError] = useState('')
  const [cooldown, setCooldown] = useState<{ username: string; cooldownEndsAt: string } | null>(null)
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null)

  const profileNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of profiles) if (p?.username) m[p.id] = p.username
    return m
  }, [profiles])

  const assignableTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase()
    const filtered = teams.filter((t) => t.name.toLowerCase().includes(q))
    const groups = new Map<string, Team[]>()
    for (const t of filtered) {
      const folder = t.logo_league_folder ?? 'unknown'
      if (!groups.has(folder)) groups.set(folder, [])
      groups.get(folder)!.push(t)
    }
    return Array.from(groups.entries())
      .map(([folder, list]) => ({ folder, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => {
        const labelA = LEAGUE_META[a.folder]?.country ?? a.folder
        const labelB = LEAGUE_META[b.folder]?.country ?? b.folder
        return labelA.localeCompare(labelB)
      })
  }, [teams, teamSearch])

  async function postAction(endpoint: string, body: object) {
    setError('')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Action failed')
    return data
  }

  async function handleRoleToggle() {
    const newRole = role === 'admin' ? 'user' : 'admin'
    setDialog(null)
    setLoading('role')
    try {
      await postAction('/api/admin/role', { userId: profileId, role: newRole })
      setRole(newRole)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleSack() {
    setDialog(null)
    setLoading('sack')
    try {
      await postAction('/api/admin/sack', { teamId })
      setHasTeam(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleResetPassword() {
    setDialog(null)
    setLoading('reset-password')
    setResetSuccess(false)
    try {
      await postAction('/api/admin/reset-password', { user_id: profileId })
      setResetSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  async function handleAssignTeam(teamIdToAssign: string, override = false) {
    setError('')
    setAssignError('')
    setAssignLoading(teamIdToAssign)
    try {
      const res = await fetch('/api/admin/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamIdToAssign, user_id: profileId, override }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (!override && data?.code === 'SACK_COOLDOWN') {
          setPendingTeamId(teamIdToAssign)
          setCooldown({ username, cooldownEndsAt: data.cooldown_ends_at })
          return
        }
        throw new Error(data.error ?? 'Failed to assign team')
      }
      const picked = teams.find((t) => t.id === teamIdToAssign)
      setLocalTeamName(picked?.name ?? null)
      setHasTeam(true)
      setCooldown(null)
      setAssignOpen(false)
      setTeamSearch('')
      router.refresh()
    } catch (e: any) {
      setAssignError(e.message)
    } finally {
      setAssignLoading(null)
    }
  }

  const newRole = role === 'admin' ? 'user' : 'admin'

  return (
    <>
      <ConfirmDialog
        open={dialog === 'sack'}
        title="Sack Manager"
        message={`Remove "${username}" as manager of "${localTeamName}"? Their stats will be sealed.`}
        confirmLabel="Sack"
        danger
        onConfirm={handleSack}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'role'}
        title={newRole === 'admin' ? 'Grant Admin' : 'Remove Admin'}
        message={
          newRole === 'admin'
            ? `Give "${username}" full admin access to the platform?`
            : `Remove admin access from "${username}"?`
        }
        confirmLabel={newRole === 'admin' ? 'Grant' : 'Remove'}
        danger={newRole !== 'admin'}
        onConfirm={handleRoleToggle}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'reset-password'}
        title="Reset Password"
        message={`Reset "${username}"'s password to the default? They should change it after logging in.`}
        confirmLabel="Reset"
        onConfirm={handleResetPassword}
        onCancel={() => setDialog(null)}
      />

      <BottomSheet open={assignOpen} onClose={() => setAssignOpen(false)} desktopMaxWidth="max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Assign a team to @{username}</h2>
            <p className="text-xs text-text-muted mt-0.5">Pick a vacant team — managed clubs are greyed out.</p>
          </div>
          <button
            onClick={() => setAssignOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="Search teams…"
            autoFocus
            className="input-field text-sm pl-9 w-full"
          />
        </div>

        {assignError && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mt-3">{assignError}</p>
        )}

        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 space-y-5">
          {assignableTeams.length === 0 && (
            <p className="text-text-muted text-sm text-center py-8">No teams match your search.</p>
          )}
          {assignableTeams.map(({ folder, list }) => {
            const meta = LEAGUE_META[folder]
            const label = meta ? `${meta.country} — ${meta.league}` : folder
            return (
              <div key={folder}>
                <h3 className="font-semibold text-text-primary mb-2 text-sm">{label}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {list.map((team) => {
                    const taken = !!team.manager_id
                    const managerName = team.manager_id ? (profileNameMap[team.manager_id] ?? null) : null
                    return (
                      <button
                        key={team.id}
                        disabled={taken || !!assignLoading}
                        onClick={() => handleAssignTeam(team.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-left ${
                          taken
                            ? 'cursor-not-allowed border-border bg-bg-base opacity-50'
                            : assignLoading === team.id
                              ? 'border-gold bg-gold/10 cursor-wait'
                              : 'border-border bg-bg-surface hover:border-gold/50 hover:bg-gold/5 cursor-pointer'
                        }`}
                      >
                        <div className="w-10 h-10 flex items-center justify-center">
                          {team.logo_league_folder && team.logo_team_slug ? (
                            <Image
                              src={logoSrc(team.logo_league_folder, team.logo_team_slug)}
                              alt={team.name}
                              width={40}
                              height={40}
                              className="object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                            />
                          ) : (
                            <span className="text-text-muted text-xs font-bold">?</span>
                          )}
                        </div>
                        <span className="text-[10px] text-center leading-tight text-text-secondary font-medium line-clamp-2 w-full">
                          {team.name}
                        </span>
                        {assignLoading === team.id ? (
                          <span className="text-[9px] text-gold font-medium">Assigning…</span>
                        ) : managerName ? (
                          <span className="text-[9px] text-text-muted font-medium truncate w-full text-center">@ {managerName}</span>
                        ) : (
                          <span className="text-[9px] font-medium text-green-600">Vacant</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </BottomSheet>

      <SackCooldownDialog
        open={!!cooldown}
        username={cooldown?.username ?? ''}
        cooldownEndsAt={cooldown?.cooldownEndsAt ?? ''}
        onClose={() => { setCooldown(null); setPendingTeamId(null) }}
        onOverride={() => { if (cooldown && pendingTeamId) handleAssignTeam(pendingTeamId, true) }}
      />

      <div className="flex flex-wrap items-center gap-2 lg:grid lg:grid-cols-[minmax(6.5rem,auto)_minmax(7.5rem,auto)_minmax(8.5rem,auto)] lg:gap-2">
        {hasTeam && teamId ? (
          <button
            onClick={() => setDialog('sack')}
            disabled={loading === 'sack'}
            className="btn-danger text-xs py-1 px-2.5"
          >
            {loading === 'sack' ? '...' : 'Sack'}
          </button>
        ) : (
          <button
            onClick={() => { setAssignError(''); setAssignOpen(true) }}
            disabled={!!assignLoading}
            className="text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors text-gold border-gold/40 bg-gold/10 hover:bg-gold/20 disabled:opacity-50"
          >
            Assign
          </button>
        )}
        <button
          onClick={() => setDialog('role')}
          disabled={loading === 'role'}
          className={`text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors ${
            role === 'admin'
              ? 'text-orange-400 border-orange-400/30 bg-orange-400/10 hover:bg-orange-400/20'
              : 'text-blue-400 border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20'
          }`}
        >
          {loading === 'role' ? '...' : role === 'admin' ? 'Remove Admin' : 'Make Admin'}
        </button>
        <button
          onClick={() => { setResetSuccess(false); setDialog('reset-password') }}
          disabled={loading === 'reset-password'}
          className="text-xs py-1 px-2.5 rounded-lg border font-medium transition-colors text-violet-400 border-violet-400/30 bg-violet-400/10 hover:bg-violet-400/20"
        >
          {loading === 'reset-password' ? '...' : 'Reset Password'}
        </button>
      </div>
      <div className="mt-1">
        {error && <span className="text-red-400 text-xs">{error}</span>}
        {resetSuccess && (
          <span className="text-green-400 text-xs">Password reset — remind them to change it</span>
        )}
      </div>
    </>
  )
}