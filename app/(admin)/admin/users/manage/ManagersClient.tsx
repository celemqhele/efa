'use client'

import { useState } from 'react'
import Image from 'next/image'
import WhatsAppButton from '@/components/ui/WhatsAppButton'
import SackCooldownDialog from '@/components/ui/SackCooldownDialog'
import { Briefcase, Circle, ArrowLeftRight } from 'lucide-react'
import { COUNTRY_CODES, parsePhoneParts, toStoredPhone } from '@/lib/phone'

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
  phone?: string | null
}

interface Props {
  teams: Team[]
  profiles: Profile[]
  managedTeamByUser: Record<string, Team>
  hasAvailabilityIds: string[]
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function ManagersClient({ teams, profiles, managedTeamByUser, hasAvailabilityIds }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localTeams, setLocalTeams] = useState<Team[]>(teams)
  const [localManagedMap, setLocalManagedMap] = useState<Record<string, Team>>(managedTeamByUser)
  const [localProfiles, setLocalProfiles] = useState<Profile[]>(profiles)

  // Sack cooldown popup state
  const [cooldown, setCooldown] = useState<{ username: string; cooldownEndsAt: string } | null>(null)

  // WhatsApp number editing state
  const [editingWa, setEditingWa] = useState(false)
  const [waCountryCode, setWaCountryCode] = useState('')
  const [waInput, setWaInput] = useState('')
  const [waSaving, setWaSaving] = useState(false)
  const [waError, setWaError] = useState('')

  // Transfer manager data state
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferResult, setTransferResult] = useState<any>(null)

  const managerProfile = selectedTeam?.manager_id
    ? localProfiles.find((p) => p.id === selectedTeam.manager_id) ?? null
    : null



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
      setEditingWa(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAssign(teamId: string, userId: string, override: boolean = false) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/managers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, user_id: userId, override }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (!override && data?.code === 'SACK_COOLDOWN') {
          const profile = localProfiles.find((p) => p.id === userId)
          setCooldown({ username: profile?.username ?? 'this manager', cooldownEndsAt: data.cooldown_ends_at })
          setLoading(false)
          return
        }
        throw new Error(data.error ?? 'Failed to assign manager')
      }

      setLocalTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, manager_id: userId } : t))
      )
      const assignedTeam = localTeams.find((t) => t.id === teamId)
      if (assignedTeam) {
        setLocalManagedMap((prev) => ({ ...prev, [userId]: { ...assignedTeam, manager_id: userId } }))
      }
      setSelectedTeam((t) => (t ? { ...t, manager_id: userId } : null))
      setEditingWa(false)
      setCooldown(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveWa(userId: string) {
    setWaSaving(true)
    setWaError('')
    try {
      const res = await fetch('/api/admin/managers/set-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, phone: toStoredPhone(waCountryCode, waInput) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')

      // Update local profile so WA button appears immediately
      setLocalProfiles((prev) =>
        prev.map((p) => p.id === userId ? { ...p, phone: data.phone } : p)
      )
      setEditingWa(false)
      setWaInput('')
    } catch (err: any) {
      setWaError(err.message)
    } finally {
      setWaSaving(false)
    }
  }

  function openEditWa(currentNumber: string | null | undefined) {
    const parts = parsePhoneParts(currentNumber)
    setWaCountryCode(parts.countryCode)
    setWaInput(parts.local)
    setWaError('')
    setEditingWa(true)
  }

  async function handleTransfer() {
    if (!selectedTeam?.manager_id || !transferTargetId) return
    setTransferLoading(true)
    setTransferError('')
    setTransferResult(null)
    try {
      const res = await fetch('/api/admin/managers/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: selectedTeam.manager_id, to_user_id: transferTargetId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Transfer failed')
      setTransferResult(data)
    } catch (err: any) {
      setTransferError(err.message)
    } finally {
      setTransferLoading(false)
    }
  }

  const managedCount = localTeams.filter((t) => t.manager_id).length

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Team list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {managedCount} / {localTeams.length} clubs managed
          </p>
          <div className="flex items-center gap-3 text-xs text-text-muted">
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
            const manager = team.manager_id ? localProfiles.find((p) => p.id === team.manager_id) : null
            const hasWa = !!manager?.phone
            return (
              <button
                key={team.id}
                onClick={() => { setSelectedTeam(team); setError(''); setEditingWa(false) }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-gold bg-gold/10 shadow-[0_0_12px_rgba(201,168,76,0.15)]'
                    : 'border-border bg-bg-surface hover:border-gold/40 hover:bg-gold/5'
                }`}
              >
                <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg">
                  {team.logo_league_folder && team.logo_team_slug ? (
                    <Image
                      src={logoSrc(team.logo_league_folder, team.logo_team_slug)}
                      alt={team.name}
                      width={36} height={36}
                      className="object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                    />
                  ) : (
                    <span className="text-text-muted text-xs font-bold">?</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground-primary text-sm font-semibold truncate">{team.name}</p>
                  {manager ? (
                    <div className="flex items-center gap-1.5">
                      <p className="text-green-600 text-xs truncate">{manager.username}</p>
                      {hasWa && (
                        <Circle className="w-2 h-2 text-[#25D366] fill-current" />
                      )}
                    </div>
                  ) : (
                    <p className="text-text-muted text-xs italic">No manager</p>
                  )}
                </div>

                <span className={`w-2 h-2 rounded-full shrink-0 ${team.manager_id ? 'bg-green-400' : 'bg-slate-300'}`} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="lg:sticky lg:top-20 self-start">
        {!selectedTeam ? (
          <div className="card p-12 text-center text-text-muted">
            <Briefcase className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm">Select a club to manage its manager.</p>
          </div>
        ) : (
          <div className="card p-5 space-y-5">
            {/* Team header */}
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-14 h-14 shrink-0 flex items-center justify-center rounded-xl">
                {selectedTeam.logo_league_folder && selectedTeam.logo_team_slug ? (
                  <Image
                    src={logoSrc(selectedTeam.logo_league_folder, selectedTeam.logo_team_slug)}
                    alt={selectedTeam.name}
                    width={52} height={52}
                    className="object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                  />
                ) : (
                  <span className="text-text-muted text-lg font-bold">?</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground-primary">{selectedTeam.name}</h2>
                <p className="text-text-muted text-sm">
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
              <div className="space-y-3">
                <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Current Manager</p>

                <div className="rounded-xl px-4 py-3 border border-border space-y-3">
                  {/* Manager info row */}
                  <div className="flex items-center gap-3">
                    {managerProfile.avatar_url ? (
                      <Image
                        src={managerProfile.avatar_url}
                        alt={managerProfile.username}
                        width={40} height={40}
                        className="rounded-full object-cover bg-bg-surface"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                        <span className="text-gold font-bold text-sm">
                          {managerProfile.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground-primary font-semibold">{managerProfile.username}</p>
                      <p className="text-text-muted text-xs capitalize">{managerProfile.role}</p>
                    </div>
                    <button
                      onClick={() => handleSack(selectedTeam.id)}
                      disabled={loading}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Removing…' : 'Remove'}
                    </button>
                  </div>

                  {/* WhatsApp section */}
                  <div className="pt-2 border-t border-slate-100">
                    {editingWa ? (
                      <div className="space-y-2">
                        <label className="text-xs text-text-muted font-medium">
                          Phone number (international)
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={waCountryCode}
                            onChange={(e) => setWaCountryCode(e.target.value)}
                            className="input-field text-sm py-1.5 w-40 shrink-0"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            value={waInput}
                            onChange={(e) => setWaInput(e.target.value)}
                            placeholder="e.g. 74 008 857"
                            className="input-field text-sm py-1.5 w-full"
                            autoFocus
                          />
                        </div>
                        {waError && <p className="text-red-400 text-xs">{waError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveWa(managerProfile.id)}
                            disabled={waSaving}
                            className="btn-gold text-xs py-1.5 flex-1"
                          >
                            {waSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingWa(false); setWaError('') }}
                            className="btn-outline text-xs py-1.5 flex-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {managerProfile.phone ? (
                          <>
                            <WhatsAppButton
                              phone={managerProfile.phone}
                              message={`Hi ${managerProfile.username}! This is the EFA League Admin. `}
                              label={`Message ${managerProfile.username}`}
                            />
                            <button
                              onClick={() => openEditWa(managerProfile.phone)}
                              className="text-xs text-text-muted hover:text-foreground-secondary underline"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openEditWa(null)}
                            className="text-xs text-text-muted hover:text-[#25D366] border border-dashed border-border hover:border-[#25D366]/50 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            + Add phone number
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Availability link */}
                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={`/admin/managers/availability?managerId=${managerProfile.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold border border-dashed border-border hover:border-gold/50 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Set Availability Schedule
                    </a>
                    {!hasAvailabilityIds.includes(managerProfile.id) && (
                      <span className="text-[10px] text-feedback-warning font-semibold bg-feedback-warning/10 border border-feedback-warning/30 px-2 py-0.5 rounded-full">
                        Not set
                      </span>
                    )}
                  </div>

                  {/* Transfer data link */}
                  <div className="pt-2">
                    <button
                      onClick={() => { setTransferOpen(true); setTransferTargetId(''); setTransferError(''); setTransferResult(null) }}
                      className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold border border-dashed border-border hover:border-gold/50 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      Transfer Manager Data
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Assign a Manager</p>

                {localProfiles.length === 0 && (
                  <p className="text-text-muted text-sm text-center py-4">
                    No registered users found.
                  </p>
                )}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {localProfiles.map((user) => {
                    const theirTeam = localManagedMap[user.id]
                    const isTheirTeam = theirTeam?.id === selectedTeam.id
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleAssign(selectedTeam.id, user.id)}
                        disabled={loading || isTheirTeam}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left disabled:opacity-50 ${
                          isTheirTeam
                            ? 'border-border bg-bg-surface cursor-not-allowed'
                            : 'border-border bg-bg-surface hover:border-gold/50 hover:bg-gold/5 cursor-pointer'
                        }`}
                      >
                        {user.avatar_url ? (
                          <Image
                            src={user.avatar_url}
                            alt={user.username}
                            width={32} height={32}
                             className="rounded-full object-cover bg-bg-elevated shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center shrink-0">
                            <span className="text-text-muted text-xs font-bold">
                              {user.username[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground-primary text-sm font-medium">{user.username}</p>
                          {isTheirTeam ? (
                            <p className="text-xs text-text-muted">Already manages this team</p>
                          ) : theirTeam ? (
                            <p className="text-xs text-gold">Also manages {theirTeam.name}</p>
                          ) : (
                            <p className="text-xs text-green-600">Available</p>
                          )}
                        </div>
                        {!isTheirTeam && (
                          <span className="text-gold text-xs font-semibold shrink-0">Assign →</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      <SackCooldownDialog
        open={!!cooldown}
        username={cooldown?.username ?? ''}
        cooldownEndsAt={cooldown?.cooldownEndsAt ?? ''}
        onClose={() => setCooldown(null)}
        onOverride={() => {
          if (cooldown && selectedTeam) {
            const user = localProfiles.find(p => p.username === cooldown.username)
            if (user) handleAssign(selectedTeam.id, user.id, true)
          }
        }}
      />

      {/* Transfer Manager Data Dialog */}
      {transferOpen && managerProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setTransferOpen(false)}>
          <div className="bg-bg-surface border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground-primary">Transfer Manager Data</h3>
            <p className="text-sm text-text-muted">
              Transfer <span className="font-semibold text-foreground-primary">@{managerProfile.username}</span>&apos;s forfeit balances, tenures, and hall of fame trophies to another account.
            </p>

            {transferResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                  <p className="text-green-700 font-semibold">Transfer complete</p>
                  <p className="text-green-600 text-xs mt-1">
                    {transferResult.forfeits_transferred} forfeit(s), {transferResult.tenures_transferred} tenure(s), {transferResult.trophies_transferred} trophy(s) transferred from @{transferResult.from_username} to @{transferResult.to_username}.
                  </p>
                </div>
                <button onClick={() => setTransferOpen(false)} className="btn-gold w-full text-sm">Done</button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-text-muted font-medium">Transfer to</label>
                  <select
                    className="input-field text-sm mt-1 w-full"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                  >
                    <option value="">Select a user…</option>
                    {localProfiles
                      .filter((p) => p.id !== managerProfile.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.username}</option>
                      ))}
                  </select>
                </div>

                {transferError && (
                  <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{transferError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleTransfer}
                    disabled={transferLoading || !transferTargetId}
                    className="btn-gold text-sm flex-1 disabled:opacity-50"
                  >
                    {transferLoading ? 'Transferring…' : 'Transfer Data'}
                  </button>
                  <button
                    onClick={() => setTransferOpen(false)}
                    className="btn-outline text-sm flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}