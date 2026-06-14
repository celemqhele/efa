'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Check, X, Trophy } from 'lucide-react'

// --- Types -------------------------------------------------------------------

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

interface Tournament {
  id: string
  name: string
  type: string
  status: string
  fixture_count: number
  completed_count: number
  knockout_ready: boolean
}

interface Season {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  tournaments: Tournament[]
  league_total_fixtures: number
  league_completed_fixtures: number
}

interface Props {
  seasons: Season[]
  allTeams: Team[]
  prevSeasonStandings: { team_id: string; team_name: string }[] | null
}

// --- Season card -------------------------------------------------------------

function SeasonCard({
  season,
  isFirst,
  onEndSeason,
  onCancelSeason,
  onGenerateKnockouts,
}: {
  season: Season
  isFirst: boolean
  onEndSeason: (id: string) => Promise<void>
  onCancelSeason: (id: string) => Promise<void>
  onGenerateKnockouts: (tournamentId: string) => Promise<void>
}) {
  const [cancelDialog, setCancelDialog] = useState(false)
  const [showSuperCup, setShowSuperCup] = useState(false)
  const [scLoading, setScLoading] = useState(false)
  const [uclTeams, setUclTeams] = useState<Team[]>([])
  const [europaTeams, setEuropaTeams] = useState<Team[]>([])
  const [selectedUcl, setSelectedUcl] = useState<string>('')
  const [selectedEuropa, setSelectedEuropa] = useState<string>('')
  const [loading, setLoading] = useState<string | null>(null)

  const leagueT = season.tournaments.find((t) => t.type === 'league')
  const uclT = season.tournaments.find((t) => t.type === 'ucl')
  const europaT = season.tournaments.find((t) => t.type === 'europa')
  const superCupT = season.tournaments.find((t) => t.type === 'super_cup')

  const total = season.league_total_fixtures
  const done = season.league_completed_fixtures
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done >= total
  const isActive = season.status === 'active'
  const isUpcoming = season.status === 'upcoming'
  const isCompleted = season.status === 'completed'

  async function handleEnd() {
    setLoading('end')
    await onEndSeason(season.id)
    setLoading(null)
  }

  async function handleCancel() {
    setCancelDialog(false)
    setLoading('cancel')
    await onCancelSeason(season.id)
    setLoading(null)
  }

  async function handleGenerateKO(tournamentId: string) {
    setLoading(`ko-${tournamentId}`)
    await onGenerateKnockouts(tournamentId)
    setLoading(null)
  }

  return (
    <Card className={`p-space-5 space-y-space-4 ${isUpcoming && !isFirst ? 'opacity-50' : ''}`}>
      <ConfirmDialog
        open={cancelDialog}
        title="Cancel Phase"
        message={`Cancel "${season.name}"? All fixtures will be cleared and this cannot be undone.`}
        confirmLabel="Cancel Phase"
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelDialog(false)}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-space-3">
        <div>
          <h3 className="text-text-primary font-bold text-lg">{season.name}</h3>
          {season.start_date && season.end_date && (
            <p className="text-text-muted text-xs mt-space-1">
              {new Date(season.start_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' — '}
              {new Date(season.end_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <span
          className={`text-xs px-space-2 py-space-1 rounded-full border font-medium shrink-0 ${
            isActive
              ? 'bg-feedback-success/10 border-feedback-success/30 text-feedback-success'
              : isCompleted
              ? 'bg-bg-elevated border-border text-text-muted'
              : 'bg-feedback-warning/10 border-feedback-warning/30 text-feedback-warning'
          }`}
        >
          {isCompleted ? 'Completed' : isActive ? 'Active' : 'Upcoming'}
        </span>
      </div>

      {isUpcoming && !isFirst && (
        <p className="text-text-muted text-sm text-center py-space-2">
          Waiting for the previous phase to end before this can start.
        </p>
      )}

      {(isActive || isCompleted) && (
        <>
          {/* League progress */}
          {leagueT && (
            <div>
              <div className="flex items-center justify-between mb-space-1">
                <span className="text-xs text-text-muted">EFA Premier League</span>
                <span className="text-xs text-text-secondary">
                  {done}/{total} fixtures
                </span>
              </div>
              <div className="w-full h-space-2 bg-bg-base rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? 'bg-feedback-success' : 'bg-accent'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {allDone && (
                <p className="text-xs text-feedback-success mt-space-1">All fixtures completed</p>
              )}
            </div>
          )}

          {/* Other tournaments */}
          <div className="grid grid-cols-3 gap-space-2">
            {[uclT, europaT, superCupT].map((t, idx) => {
              if (t) {
                return (
                  <div key={t.id} className="bg-bg-base rounded-lg px-space-3 py-space-2 text-center space-y-space-1">
                    <p className="text-xs font-bold text-text-primary truncate">
                      {t.type === 'ucl' ? 'UCL' : t.type === 'europa' ? 'Europa' : 'Super Cup'}
                    </p>
                    <p
                      className={`text-[10px] ${
                        t.status === 'active'
                          ? 'text-feedback-success'
                          : t.status === 'completed'
                          ? 'text-text-muted'
                          : 'text-feedback-warning'
                      }`}
                    >
                      {t.status === 'active' ? 'Active' : t.status === 'completed' ? 'Done' : 'Upcoming'}
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      {t.completed_count}/{t.fixture_count}
                    </p>
                    {(t.knockout_ready && isActive && (t.type === 'ucl' || t.type === 'europa')) && (
                      <Button
                        onClick={() => handleGenerateKO(t.id)}
                        isLoading={loading === `ko-${t.id}`}
                        variant="secondary"
                        className="w-full text-[9px] py-space-1 px-space-1"
                      >
                        Generate KOs
                      </Button>
                    )}
                  </div>
                )
              }
              return (
                <div
                  key={idx}
                  className="bg-bg-base rounded-lg px-space-3 py-space-2 text-center space-y-space-1"
                >
                  {idx === 2 && isActive && uclT && europaT ? (
                    <Button
                      onClick={() => setShowSuperCup(true)}
                      variant="secondary"
                      className="w-full h-full min-h-[68px] flex flex-col items-center justify-center gap-space-1"
                    >
                      <Trophy className="w-4 h-4 text-gold" />
                      <span className="text-[9px]">Generate Super Cup</span>
                    </Button>
                  ) : (
                    <p className="text-xs text-text-muted opacity-30">-</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Super Cup generation dialog */}
          {showSuperCup && (
            <SuperCupDialog
              seasonId={season.id}
              uclTId={uclT?.id ?? ''}
              europaTId={europaT?.id ?? ''}
              onClose={() => { setShowSuperCup(false); setSelectedUcl(''); setSelectedEuropa('') }}
              onCreated={() => { setShowSuperCup(false); window.location.reload() }}
            />
          )}

          {/* Actions */}
          {isActive && (
            <div className="flex gap-space-3 pt-space-1">
              <Button
                onClick={() => setCancelDialog(true)}
                isLoading={loading === 'cancel'}
                variant="secondary"
                className="text-xs"
              >
                Cancel Phase
              </Button>

              <Button
                onClick={handleEnd}
                isLoading={loading === 'end'}
                disabled={!allDone}
                variant="primary"
                className="ml-auto text-xs"
                title={!allDone ? `${total - done} league fixtures still remaining` : undefined}
              >
                {allDone ? 'End Phase' : `End Phase (${done}/${total})`}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// --- Team picker button -------------------------------------------------------

function TeamPickerButton({
  team,
  selected,
  disabled,
  badgeText,
  accentClass,
  onClick,
}: {
  team: Team
  selected: boolean
  disabled: boolean
  badgeText?: string
  accentClass: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      variant={selected ? 'primary' : 'secondary'}
      className={`flex items-center gap-space-2 p-space-2 text-left text-xs ${selected ? accentClass : ''}`}
    >
      {team.logo_league_folder ? (
        <Image
          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
          alt={team.name}
          width={20}
          height={20}
          className="object-contain shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded bg-bg-base shrink-0" />
      )}
      <span className="truncate flex-1">{team.name}</span>
      {selected && !badgeText && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
      {badgeText && <span className="ml-auto shrink-0 text-[9px] text-text-muted">{badgeText}</span>}
    </Button>
  )
}

// --- Start Phase Dialog -------------------------------------------------------

function StartPhaseDialog({
  allTeams,
  prevSeasonStandings,
  onClose,
}: {
  allTeams: Team[]
  prevSeasonStandings: { team_id: string; team_name: string }[] | null
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Manager assignment state (step 3)
  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [localManagers, setLocalManagers] = useState<Record<string, string>>({})
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null)
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({})

  const today = new Date().toISOString().split('T')[0]
  const [seasonName, setSeasonName] = useState('')
  const [startDate, setStartDate] = useState(today)

  const endDate = (() => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + 45)
    return d.toISOString().split('T')[0]
  })()

  // League: default all teams selected
  const [leagueTeamIds, setLeagueTeamIds] = useState<string[]>(allTeams.map((t) => t.id))

  // UCL/Europa: pre-populate from previous season standings
  const prevTeamIds = prevSeasonStandings?.map((s) => s.team_id) ?? []
  const [uclTeamIds, setUclTeamIds] = useState<string[]>(prevTeamIds.slice(0, 12))
  const [europaTeamIds, setEuropaTeamIds] = useState<string[]>(prevTeamIds.slice(12, 20))

  const leagueTeamObjects = allTeams.filter((t) => leagueTeamIds.includes(t.id))

  function toggleLeague(id: string) {
    if (leagueTeamIds.includes(id)) {
      setLeagueTeamIds((prev) => prev.filter((x) => x !== id))
      setUclTeamIds((prev) => prev.filter((x) => x !== id))
      setEuropaTeamIds((prev) => prev.filter((x) => x !== id))
    } else if (leagueTeamIds.length < 20) {
      setLeagueTeamIds((prev) => [...prev, id])
    }
  }

  function toggleUcl(id: string) {
    setUclTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 12 ? [...prev, id] : prev
    )
  }

  function toggleEuropa(id: string) {
    setEuropaTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 8 ? [...prev, id] : prev
    )
  }

  async function handleStart() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/start-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_name: seasonName,
          start_date: startDate,
          league_team_ids: leagueTeamIds,
          ucl_team_ids: uclTeamIds,
          europa_team_ids: europaTeamIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start phase')
      router.refresh()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function nextStep() {
    setError('')
    if (step === 1) {
      if (!seasonName.trim()) { setError('Phase name is required.'); return }
      if (!startDate) { setError('Start date is required.'); return }
    }
    if (step === 2) {
      if (leagueTeamIds.length !== 20) {
        setError(`Select exactly 20 teams for the league. (${leagueTeamIds.length}/20 selected)`)
        return
      }
      // Fetch users for the manager assignment step
      setUsersLoading(true)
      supabase.from('profiles').select('id, username').order('username')
        .then(({ data }) => { setUsers(data ?? []); setUsersLoading(false) })
    }
    if (step === 4) {
      if (uclTeamIds.length !== 12) { setError('Select exactly 12 teams for UCL.'); return }
      if (europaTeamIds.length !== 8) { setError('Select exactly 8 teams for Europa.'); return }
    }
    setStep((s) => s + 1)
  }

  const STEP_LABELS = ['Phase Details', 'League Teams', 'Assign Managers', 'UCL & Europa Draw', 'Confirm & Launch']

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-space-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-2xl overflow-hidden my-space-8">
        {/* Header */}
        <div className="px-space-6 py-space-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-text-primary font-bold text-lg">Start New Phase</h2>
            <p className="text-text-muted text-xs mt-space-1">
              Step {step} of 5: {STEP_LABELS[step - 1]}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Progress bar */}
        <div className="h-space-1 bg-border-subtle">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        <div className="p-space-6 space-y-space-5">
          {/* -- Step 1: Phase details -- */}
          {step === 1 && (
            <div className="space-y-space-4">
              <div>
                <label className="form-label">Phase Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="e.g. Season 1 — May 2026"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-space-4">
                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">End Date (auto)</label>
                  <input
                    type="date"
                    value={endDate}
                    readOnly
                    className="input-field opacity-50 cursor-not-allowed"
                  />
                </div>
              </div>
              <Card className="p-space-4 text-xs text-text-muted space-y-space-1">
                <p className="font-medium text-text-primary">What gets generated:</p>
                <ul className="list-disc list-inside space-y-space-1 mt-space-1">
                  <li>EFA Premier League — 20 teams you choose, 380 fixtures</li>
                  <li>EFA Champions League — 12 teams, 60 group fixtures</li>
                  <li>EFA Europa League — 8 teams, 24 group fixtures</li>
                  <li>2 rounds per weekday, 3 per weekend</li>
                </ul>
              </Card>
            </div>
          )}

          {/* -- Step 2: League teams (exactly 20) -- */}
          {step === 2 && (
            <div className="space-y-space-3">
              <div className="flex items-center justify-between">
                <h3 className="text-text-primary font-semibold text-sm">EFA Premier League</h3>
                <span className={`text-xs font-bold ${leagueTeamIds.length === 20 ? 'text-feedback-success' : 'text-accent'}`}>
                  {leagueTeamIds.length}/20
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Select exactly 20 teams.
              </p>
              <div className="grid grid-cols-2 gap-space-2 max-h-72 overflow-y-auto pr-space-1">
                {allTeams.map((team) => {
                  const sel = leagueTeamIds.includes(team.id)
                  const atMax = !sel && leagueTeamIds.length >= 20
                  return (
                    <TeamPickerButton
                      key={team.id}
                      team={team}
                      selected={sel}
                      disabled={atMax}
                      accentClass="bg-feedback-success/10 border-feedback-success/40"
                      onClick={() => toggleLeague(team.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* -- Step 3: Assign Managers -- */}
          {step === 3 && (
            <div className="space-y-space-3">
              <div className="flex items-center justify-between">
                <h3 className="text-text-primary font-semibold text-sm">Manager Assignments</h3>
                <span className="text-xs text-text-muted">Optional — can skip</span>
              </div>
              <p className="text-xs text-text-muted">
                Assign managers to your selected teams.
              </p>

              {usersLoading ? (
                <div className="py-space-8 text-center text-text-muted text-sm">Loading users...</div>
              ) : (
                <div className="space-y-space-1.5 max-h-80 overflow-y-auto pr-space-1">
                  {leagueTeamObjects.map((team) => {
                    const resolvedManagerId = localManagers[team.id] ?? team.manager_id
                    const mgr = resolvedManagerId ? users.find((u) => u.id === resolvedManagerId) : null
                    const isAssigning = assigningTeamId === team.id
                    const assignErr = assignErrors[team.id]

                    return (
                      <div key={team.id} className="flex items-center gap-space-2.5 px-space-3 py-space-2 rounded-lg bg-bg-elevated border border-border">
                        {team.logo_league_folder ? (
                          <Image
                            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                            alt={team.name}
                            width={20}
                            height={20}
                            className="object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-bg-base shrink-0" />
                        )}
                        <span className="text-xs font-medium text-text-primary truncate flex-1 min-w-0">{team.name}</span>

                        {assignErr && (
                          <span className="text-[10px] text-feedback-error truncate max-w-[100px] shrink-0" title={assignErr}>
                            {assignErr}
                          </span>
                        )}

                        {mgr ? (
                          <div className="flex items-center gap-space-1 shrink-0">
                            <span className="text-xs text-feedback-success font-medium">{mgr.username}</span>
                            <Button
                              variant="ghost"
                              className="text-[10px] py-0 px-space-1"
                              onClick={() => setLocalManagers((prev) => { const n = { ...prev }; delete n[team.id]; return n })}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <select
                            className="text-xs border border-border rounded-md px-space-2 py-space-1 bg-bg-surface text-text-primary max-w-[150px] shrink-0"
                            value=""
                            disabled={isAssigning}
                            onChange={async (e) => {
                              const userId = e.target.value
                              if (!userId) return
                              setAssigningTeamId(team.id)
                              setAssignErrors((prev) => { const n = { ...prev }; delete n[team.id]; return n })
                              try {
                                const res = await fetch('/api/admin/managers/assign', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ team_id: team.id, user_id: userId }),
                                })
                                const data = await res.json()
                                if (!res.ok) throw new Error(data.error ?? 'Failed to assign')
                                setLocalManagers((prev) => ({ ...prev, [team.id]: userId }))
                              } catch (err: any) {
                                setAssignErrors((prev) => ({ ...prev, [team.id]: err.message }))
                              } finally {
                                setAssigningTeamId(null)
                              }
                            }}
                          >
                            <option value="">{isAssigning ? 'Assigning...' : '— assign —'}</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* -- Step 4: UCL & Europa draw -- */}
          {step === 4 && (
            <div className="space-y-space-6">
              <div className="bg-accent-muted border border-accent/20 rounded-lg p-space-3 text-xs text-accent">
                Pre-populated from previous phase standings. Adjust as needed.
              </div>

              {/* UCL */}
              <div>
                <div className="flex items-center justify-between mb-space-3">
                  <h3 className="text-text-primary font-semibold text-sm">EFA Champions League</h3>
                  <span className={`text-xs font-bold ${uclTeamIds.length === 12 ? 'text-feedback-success' : 'text-accent'}`}>
                    {uclTeamIds.length}/12
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-space-2 max-h-52 overflow-y-auto pr-space-1">
                  {leagueTeamObjects.map((team) => {
                    const sel = uclTeamIds.includes(team.id)
                    const inEuropa = europaTeamIds.includes(team.id)
                    return (
                      <TeamPickerButton
                        key={team.id}
                        team={team}
                        selected={sel}
                        disabled={(!sel && uclTeamIds.length >= 12) || inEuropa}
                        badgeText={inEuropa ? 'EL' : undefined}
                        accentClass="bg-accent/10 border-accent/40"
                        onClick={() => !inEuropa && toggleUcl(team.id)}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Europa */}
              <div>
                <div className="flex items-center justify-between mb-space-3">
                  <h3 className="text-text-primary font-semibold text-sm">EFA Europa League</h3>
                  <span className={`text-xs font-bold ${europaTeamIds.length === 8 ? 'text-feedback-success' : 'text-feedback-warning'}`}>
                    {europaTeamIds.length}/8
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-space-2 max-h-52 overflow-y-auto pr-space-1">
                  {leagueTeamObjects.map((team) => {
                    const sel = europaTeamIds.includes(team.id)
                    const inUcl = uclTeamIds.includes(team.id)
                    return (
                      <TeamPickerButton
                        key={team.id}
                        team={team}
                        selected={sel}
                        disabled={(!sel && europaTeamIds.length >= 8) || inUcl}
                        badgeText={inUcl ? 'UCL' : undefined}
                        accentClass="bg-feedback-warning/10 border-feedback-warning/40"
                        onClick={() => !inUcl && toggleEuropa(team.id)}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* -- Step 5: Confirm -- */}
          {step === 5 && (
            <div className="space-y-space-4">
              <h3 className="text-text-primary font-semibold">Ready to launch</h3>
              <Card className="p-space-4 space-y-space-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Phase name</span>
                  <span className="text-text-primary font-medium">{seasonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Duration</span>
                  <span className="text-text-primary">{startDate} — {endDate} (45 days)</span>
                </div>
                <div className="border-t border-border pt-space-3 space-y-space-2">
                  <div className="flex justify-between">
                    <span className="text-blue-500">League teams</span>
                    <span className="text-blue-500 font-medium">{leagueTeamIds.length} teams — 380 fixtures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-accent">UCL teams</span>
                    <span className="text-accent font-medium">{uclTeamIds.length} teams — 60 group fixtures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-feedback-warning">Europa teams</span>
                    <span className="text-feedback-warning font-medium">{europaTeamIds.length} teams — 24 group fixtures</span>
                  </div>
                </div>
                <div className="border-t border-border pt-space-3 flex justify-between font-semibold">
                  <span className="text-text-secondary">Total fixtures</span>
                  <span className="text-text-primary">464</span>
                </div>
              </Card>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-space-3 text-feedback-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-space-6 pb-space-6 flex justify-between gap-space-3">
          <Button variant="secondary" onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 5 ? (
            <Button variant="primary" onClick={nextStep} className="px-space-8">
              {step === 3 ? 'Next (UCL & Europa)' : 'Next'}
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              isLoading={loading}
              variant="primary"
              className="px-space-8"
            >
              Launch Phase
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Super Cup Generation Dialog ---------------------------------------------

function SuperCupDialog({
  seasonId,
  uclTId,
  europaTId,
  onClose,
  onCreated,
}: {
  seasonId: string
  uclTId: string
  europaTId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [uclTeams, setUclTeams] = useState<{ id: string; name: string }[]>([])
  const [europaTeams, setEuropaTeams] = useState<{ id: string; name: string }[]>([])
  const [selectedUcl, setSelectedUcl] = useState('')
  const [selectedEuropa, setSelectedEuropa] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ scheduled_date: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      if (!uclTId && !europaTId) return

      // Load UCL participants
      if (uclTId) {
        const { data: uclPart } = await supabase
          .from('tournament_participants')
          .select('team:team_id(id, name)')
          .eq('tournament_id', uclTId) as any
        if (uclPart) {
          setUclTeams(uclPart.map((p: any) => p.team).filter(Boolean))
        }
      }

      // Load Europa participants
      if (europaTId) {
        const { data: europaPart } = await supabase
          .from('tournament_participants')
          .select('team:team_id(id, name)')
          .eq('tournament_id', europaTId) as any
        if (europaPart) {
          setEuropaTeams(europaPart.map((p: any) => p.team).filter(Boolean))
        }
      }
    }
    load()
  }, [uclTId, europaTId, supabase])

  async function handleSubmit() {
    if (!selectedUcl || !selectedEuropa) {
      setError('Please select both UCL and Europa winners')
      return
    }
    if (selectedUcl === selectedEuropa) {
      setError('UCL and Europa winners must be different teams')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/admin/generate-super-cup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        ucl_winner_id: selectedUcl,
        europa_winner_id: selectedEuropa,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to generate Super Cup')
      return
    }

    setResult(data)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-space-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-bg-surface border border-border rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-space-6 py-space-4 border-b border-border flex items-center justify-between">
          <h2 className="text-text-primary font-bold text-lg flex items-center gap-space-2">
            <Trophy className="w-5 h-5 text-gold" /> Generate Super Cup
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-space-6 space-y-space-4">
            <div className="bg-feedback-success/10 border border-feedback-success/30 rounded-xl p-space-4 text-center space-y-space-2">
              <Trophy className="w-8 h-8 text-gold mx-auto" />
              <p className="text-text-primary font-bold">Super Cup Generated!</p>
              <p className="text-sm text-text-secondary">Scheduled for {new Date(result.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <Button onClick={onCreated} variant="primary" className="w-full">Done</Button>
          </div>
        ) : (
          <div className="p-space-6 space-y-space-5">
            {/* UCL Winner */}
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-space-2 block">
                UCL Winner
              </label>
              <select
                value={selectedUcl}
                onChange={(e) => setSelectedUcl(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-lg px-space-4 py-space-3 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select UCL winner...</option>
                {uclTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Europa Winner */}
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-space-2 block">
                Europa League Winner
              </label>
              <select
                value={selectedEuropa}
                onChange={(e) => setSelectedEuropa(e.target.value)}
                className="w-full bg-bg-base border border-border rounded-lg px-space-4 py-space-3 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select Europa winner...</option>
                {europaTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-feedback-error text-sm text-center">{error}</p>
            )}

            <div className="flex gap-space-3">
              <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
              <Button onClick={handleSubmit} isLoading={loading} variant="primary" className="flex-1">
                Generate Super Cup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main export --------------------------------------------------------------

export default function SeasonManager({ seasons, allTeams, prevSeasonStandings }: Props) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [actionError, setActionError] = useState('')

  const hasActiveSeason = seasons.some((s) => s.status === 'active')
  const canStartNew = !hasActiveSeason

  async function handleEndSeason(seasonId: string) {
    setActionError('')
    const res = await fetch('/api/admin/end-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(data.error ?? 'Failed to end phase')
      return
    }
    router.refresh()
  }

  async function handleCancelSeason(seasonId: string) {
    setActionError('')
    const res = await fetch('/api/admin/cancel-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(data.error ?? 'Failed to cancel phase')
      return
    }
    router.refresh()
  }

  async function handleGenerateKnockouts(tournamentId: string) {
    setActionError('')
    const res = await fetch('/api/admin/generate-knockouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament_id: tournamentId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(data.error ?? 'Failed to generate knockouts')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-space-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Phases</h1>
          <p className="text-text-muted text-sm mt-space-1">Manage the EFA competition lifecycle</p>
        </div>
        {canStartNew ? (
          <Button onClick={() => setShowDialog(true)} variant="primary">
            + Start Phase
          </Button>
        ) : (
          <span className="text-xs text-text-muted bg-bg-elevated border border-border rounded-lg px-space-3 py-space-1.5">
            End the active phase first
          </span>
        )}
      </div>

      {actionError && (
        <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-space-3 text-feedback-error text-sm">
          {actionError}
        </div>
      )}

      {/* Phase timeline */}
      {seasons.length === 0 ? (
        <Card className="p-space-12 text-center">
          <p className="text-4xl mb-space-4">∅</p>
          <p className="text-lg font-medium text-text-primary mb-space-2">No phases yet</p>
          <p className="text-sm text-text-muted mb-space-6">
            Start the first phase to generate all fixtures automatically.
          </p>
          <Button onClick={() => setShowDialog(true)} variant="primary">
            Start First Phase
          </Button>
        </Card>
      ) : (
        <div className="space-y-space-4">
          {seasons.map((season, idx) => (
            <SeasonCard
              key={season.id}
              season={season}
              isFirst={idx === 0}
              onEndSeason={handleEndSeason}
              onCancelSeason={handleCancelSeason}
              onGenerateKnockouts={handleGenerateKnockouts}
            />
          ))}

          {hasActiveSeason && (
            <Card className="p-space-5 opacity-40 border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-text-muted font-bold">Next Phase</h3>
                  <p className="text-text-secondary text-xs mt-space-0.5">
                    Available after current phase ends
                  </p>
                </div>
                <span className="text-xs px-space-2 py-space-1 rounded-full border border-border text-text-muted">
                  Locked
                </span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <StartPhaseDialog
          allTeams={allTeams}
          prevSeasonStandings={prevSeasonStandings}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  )
}
