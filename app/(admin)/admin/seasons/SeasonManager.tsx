'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'

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
    <div className={`card p-5 space-y-4 ${isUpcoming && !isFirst ? 'opacity-50' : ''}`}>
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-slate-900 font-bold text-lg">{season.name}</h3>
          {season.start_date && season.end_date && (
            <p className="text-slate-500 text-xs mt-0.5">
              {new Date(season.start_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' – '}
              {new Date(season.end_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${
            isActive
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : isCompleted
              ? 'bg-slate-500/10 border-slate-500/30 text-slate-400'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          }`}
        >
          {isCompleted ? 'Completed' : isActive ? 'Active' : 'Upcoming'}
        </span>
      </div>

      {isUpcoming && !isFirst && (
        <p className="text-slate-500 text-sm text-center py-2">
          Waiting for the previous phase to end before this can start.
        </p>
      )}

      {(isActive || isCompleted) && (
        <>
          {/* League progress */}
          {leagueT && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">EFA Premier League</span>
                <span className="text-xs text-slate-500">
                  {done}/{total} fixtures
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-accent'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {allDone && (
                <p className="text-xs text-green-400 mt-1">All fixtures completed</p>
              )}
            </div>
          )}

          {/* Other tournaments */}
          <div className="grid grid-cols-3 gap-2">
            {[uclT, europaT, superCupT].map((t, idx) =>
              t ? (
                <div key={t.id} className="bg-slate-50 rounded-lg px-3 py-2 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {t.type === 'ucl' ? 'UCL' : t.type === 'europa' ? 'Europa' : 'Super Cup'}
                  </p>
                  <p
                    className={`text-[10px] ${
                      t.status === 'active'
                        ? 'text-green-400'
                        : t.status === 'completed'
                        ? 'text-slate-500'
                        : 'text-yellow-400'
                    }`}
                  >
                    {t.status === 'active' ? 'Active' : t.status === 'completed' ? 'Done' : 'Upcoming'}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {t.completed_count}/{t.fixture_count}
                  </p>
                  {t.knockout_ready && isActive && (
                    <button
                      onClick={() => handleGenerateKO(t.id)}
                      disabled={loading === `ko-${t.id}`}
                      className="w-full text-[9px] py-0.5 px-1 rounded bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors font-bold disabled:opacity-40"
                    >
                      {loading === `ko-${t.id}` ? '...' : 'Generate KOs'}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-lg px-3 py-2 text-center opacity-30"
                >
                  <p className="text-xs text-slate-500">—</p>
                </div>
              )
            )}
          </div>

          {/* Actions */}
          {isActive && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setCancelDialog(true)}
                disabled={loading === 'cancel'}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 border border-slate-700 rounded-lg disabled:opacity-40"
              >
                {loading === 'cancel' ? 'Cancelling…' : 'Cancel Phase'}
              </button>

              <button
                onClick={handleEnd}
                disabled={!allDone || loading === 'end'}
                className="ml-auto btn-gold text-xs px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                title={!allDone ? `${total - done} league fixtures still remaining` : undefined}
              >
                {loading === 'end'
                  ? 'Ending…'
                  : allDone
                  ? 'End Phase'
                  : `End Phase (${done}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
        selected
          ? `${accentClass} text-slate-900`
          : disabled
          ? 'bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed'
          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-500/50'
      }`}
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
        <div className="w-5 h-5 rounded bg-slate-200 shrink-0" />
      )}
      <span className="truncate flex-1">{team.name}</span>
      {selected && !badgeText && <span className="ml-auto text-current shrink-0">?</span>}
      {badgeText && <span className="ml-auto shrink-0 text-[9px] text-slate-500">{badgeText}</span>}
    </button>
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-slate-900 font-bold text-lg">Start New Phase</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Step {step} of 5: {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-xl leading-none">
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-slate-200">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* -- Step 1: Phase details -- */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Phase Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="e.g. Season 1 – May 2026"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-400 space-y-1">
                <p className="font-medium text-slate-700">What gets generated:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>EFA Premier League — 20 teams you choose, 380 fixtures (38 matchdays)</li>
                  <li>EFA Champions League — 12 teams, 2 groups of 6, 60 group fixtures</li>
                  <li>EFA Europa League — 8 teams, 2 groups of 4, 24 group fixtures</li>
                  <li>2 rounds per weekday, 3 per weekend / public holiday</li>
                </ul>
              </div>
            </div>
          )}

          {/* -- Step 2: League teams (exactly 20) -- */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 font-semibold text-sm">EFA Premier League</h3>
                <span className={`text-xs font-bold ${leagueTeamIds.length === 20 ? 'text-green-400' : 'text-accent'}`}>
                  {leagueTeamIds.length}/20
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Select exactly 20 teams. UCL/Europa teams must be in this list.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {allTeams.map((team) => {
                  const sel = leagueTeamIds.includes(team.id)
                  const atMax = !sel && leagueTeamIds.length >= 20
                  return (
                    <TeamPickerButton
                      key={team.id}
                      team={team}
                      selected={sel}
                      disabled={atMax}
                      accentClass="bg-blue-500/10 border-blue-500/40"
                      onClick={() => toggleLeague(team.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* -- Step 3: Assign Managers -- */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-slate-900 font-semibold text-sm">Manager Assignments</h3>
                <span className="text-xs text-slate-500">Optional — can skip</span>
              </div>
              <p className="text-xs text-slate-500">
                Assign managers to your selected teams. Teams without a manager can still compete.
              </p>

              {usersLoading ? (
                <div className="py-8 text-center text-slate-400 text-sm">Loading users…</div>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {leagueTeamObjects.map((team) => {
                    const resolvedManagerId = localManagers[team.id] ?? team.manager_id
                    const mgr = resolvedManagerId ? users.find((u) => u.id === resolvedManagerId) : null
                    const isAssigning = assigningTeamId === team.id
                    const assignErr = assignErrors[team.id]

                    return (
                      <div key={team.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                        {team.logo_league_folder ? (
                          <Image
                            src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                            alt={team.name}
                            width={20}
                            height={20}
                            className="object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-slate-200 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-slate-900 truncate flex-1 min-w-0">{team.name}</span>

                        {assignErr && (
                          <span className="text-[10px] text-red-400 truncate max-w-[100px] shrink-0" title={assignErr}>
                            {assignErr}
                          </span>
                        )}

                        {mgr ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-green-600 font-medium">{mgr.username}</span>
                            <button
                              type="button"
                              title="Change manager"
                              onClick={() => setLocalManagers((prev) => { const n = { ...prev }; delete n[team.id]; return n })}
                              className="text-[10px] text-slate-400 hover:text-red-400 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <select
                            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 max-w-[150px] shrink-0"
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
                            <option value="">{isAssigning ? 'Assigning…' : '— assign —'}</option>
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

              <p className="text-[11px] text-slate-400">
                {leagueTeamObjects.filter((t) => localManagers[t.id] || t.manager_id).length} of {leagueTeamObjects.length} teams have managers
              </p>
            </div>
          )}

          {/* -- Step 4: UCL & Europa draw (from league teams) -- */}
          {step === 4 && (
            <div className="space-y-6">
              {prevTeamIds.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                  Pre-populated from previous phase standings. Adjust as needed.
                </div>
              )}

              {/* UCL */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-900 font-semibold text-sm">EFA Champions League</h3>
                  <span className={`text-xs font-bold ${uclTeamIds.length === 12 ? 'text-green-400' : 'text-accent'}`}>
                    {uclTeamIds.length}/12
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-900 font-semibold text-sm">EFA Europa League</h3>
                  <span className={`text-xs font-bold ${europaTeamIds.length === 8 ? 'text-green-400' : 'text-orange-400'}`}>
                    {europaTeamIds.length}/8
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
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
                        accentClass="bg-orange-500/10 border-orange-500/40"
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
            <div className="space-y-4">
              <h3 className="text-slate-900 font-semibold">Ready to launch</h3>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Phase name</span>
                  <span className="text-slate-900 font-medium">{seasonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-slate-900">{startDate} ? {endDate} (45 days)</span>
                </div>
                <div className="border-t border-slate-200 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-400">League teams</span>
                    <span className="text-blue-400 font-medium">{leagueTeamIds.length} teams · 380 fixtures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-accent">UCL teams</span>
                    <span className="text-accent font-medium">{uclTeamIds.length} teams · 60 group fixtures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-400">Europa teams</span>
                    <span className="text-orange-400 font-medium">{europaTeamIds.length} teams · 24 group fixtures</span>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between font-semibold">
                  <span className="text-slate-700">Total fixtures</span>
                  <span className="text-slate-900">464</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-between gap-3">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="btn-outline text-sm"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 5 ? (
            <button onClick={nextStep} className="btn-gold text-sm px-8">
              {step === 3 ? 'Next (UCL & Europa)' : 'Next'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              className="btn-gold text-sm px-8 disabled:opacity-50"
            >
              {loading ? 'Generating fixtures…' : 'Launch Phase'}
            </button>
          )}
        </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Phases</h1>
          <p className="text-slate-400 text-sm mt-1">Manage the EFA competition lifecycle</p>
        </div>
        {canStartNew ? (
          <button onClick={() => setShowDialog(true)} className="btn-gold">
            + Start Phase
          </button>
        ) : (
          <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            End the active phase first
          </span>
        )}
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Phase timeline */}
      {seasons.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-4">??</p>
          <p className="text-lg font-medium text-slate-900 mb-2">No phases yet</p>
          <p className="text-sm text-slate-500 mb-6">
            Start the first phase to generate all fixtures automatically.
          </p>
          <button onClick={() => setShowDialog(true)} className="btn-gold">
            Start First Phase
          </button>
        </div>
      ) : (
        <div className="space-y-4">
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
            <div className="card p-5 opacity-40 border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-400 font-bold">Next Phase</h3>
                  <p className="text-slate-600 text-xs mt-0.5">
                    Available after current phase ends
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-600">
                  Locked
                </span>
              </div>
            </div>
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

