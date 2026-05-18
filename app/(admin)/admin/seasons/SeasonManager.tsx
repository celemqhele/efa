'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Season card ─────────────────────────────────────────────────────────────

function SeasonCard({
  season,
  isFirst,
  onEndSeason,
  onCancelSeason,
}: {
  season: Season
  isFirst: boolean
  onEndSeason: (id: string) => Promise<void>
  onCancelSeason: (id: string) => Promise<void>
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
          <h3 className="text-white font-bold text-lg">{season.name}</h3>
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
              <div className="w-full h-2 bg-[#1e2d5a] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-[#c9a84c]'}`}
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
                <div key={t.id} className="bg-[#0f1a3d] rounded-lg px-3 py-2 text-center">
                  <p className="text-xs font-bold text-white truncate">
                    {t.type === 'ucl' ? 'UCL' : t.type === 'europa' ? 'Europa' : 'Super Cup'}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      t.status === 'active'
                        ? 'text-green-400'
                        : t.status === 'completed'
                        ? 'text-slate-500'
                        : 'text-yellow-400'
                    }`}
                  >
                    {t.status === 'active' ? 'Active' : t.status === 'completed' ? 'Done' : 'Upcoming'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {t.completed_count}/{t.fixture_count}
                  </p>
                </div>
              ) : (
                <div
                  key={idx}
                  className="bg-[#0f1a3d] rounded-lg px-3 py-2 text-center opacity-30"
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

// ─── Start Phase Dialog ───────────────────────────────────────────────────────

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
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const [seasonName, setSeasonName] = useState('')
  const [startDate, setStartDate] = useState(today)

  // Auto-compute end date: start + 45 days (display only)
  const endDate = (() => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + 45)
    return d.toISOString().split('T')[0]
  })()

  // Pre-populate UCL/Europa from previous season standings
  const prevTeamIds = prevSeasonStandings?.map((s) => s.team_id) ?? []
  const [uclTeamIds, setUclTeamIds] = useState<string[]>(prevTeamIds.slice(0, 12))
  const [europaTeamIds, setEuropaTeamIds] = useState<string[]>(prevTeamIds.slice(12, 20))

  const isFirstPhase = prevTeamIds.length === 0

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
      if (uclTeamIds.length !== 12) { setError('Select exactly 12 teams for UCL.'); return }
      if (europaTeamIds.length !== 8) { setError('Select exactly 8 teams for Europa.'); return }
    }
    setStep((s) => s + 1)
  }

  const managedCount = allTeams.filter((t) => t.manager_id !== null).length
  const totalTeams = allTeams.length

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0a1128] border border-[#1e2d5a] rounded-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2d5a] flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Start New Phase</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Step {step} of 3:{' '}
              {step === 1 ? 'Phase Details' : step === 2 ? 'UCL & Europa Draw' : 'Confirm & Launch'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1e2d5a]">
          <div
            className="h-full bg-[#c9a84c] transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* ── Step 1: Phase details ── */}
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
              <div className="bg-[#0f1a3d] rounded-xl p-4 text-xs text-slate-400 space-y-2">
                <p className="font-medium text-slate-300">What gets generated automatically:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>
                    EFA Premier League — all {totalTeams} teams ({managedCount} managed, {totalTeams - managedCount} ghost), 380 fixtures over 38 matchdays
                  </li>
                  <li>EFA Champions League — 12 teams, 2 groups of 6, 60 group fixtures</li>
                  <li>EFA Europa League — 8 teams, 2 groups of 4, 24 group fixtures</li>
                  <li>2 rounds per weekday, 3 rounds per weekend / public holiday</li>
                  <li>UCL & Europa spread throughout the 45-day phase</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 2: UCL & Europa draw ── */}
          {step === 2 && (
            <div className="space-y-6">
              {!isFirstPhase && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
                  Pre-populated from previous phase standings. Adjust as needed.
                </div>
              )}

              {/* UCL */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">EFA Champions League</h3>
                  <span
                    className={`text-xs font-bold ${
                      uclTeamIds.length === 12 ? 'text-green-400' : 'text-[#c9a84c]'
                    }`}
                  >
                    {uclTeamIds.length}/12
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {allTeams.map((team) => {
                    const sel = uclTeamIds.includes(team.id)
                    const inEuropa = europaTeamIds.includes(team.id)
                    const disabled = (!sel && uclTeamIds.length >= 12) || inEuropa
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => !disabled && toggleUcl(team.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                          sel
                            ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-white'
                            : inEuropa
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : disabled
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-300 hover:border-[#c9a84c]/30'
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
                          <div className="w-5 h-5 rounded bg-[#1e2d5a] shrink-0" />
                        )}
                        <span className="truncate">{team.name}</span>
                        {sel && <span className="ml-auto text-[#c9a84c] shrink-0">✓</span>}
                        {inEuropa && <span className="ml-auto text-orange-500 shrink-0 text-[9px]">EL</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Europa */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">EFA Europa League</h3>
                  <span
                    className={`text-xs font-bold ${
                      europaTeamIds.length === 8 ? 'text-green-400' : 'text-orange-400'
                    }`}
                  >
                    {europaTeamIds.length}/8
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {allTeams.map((team) => {
                    const sel = europaTeamIds.includes(team.id)
                    const inUcl = uclTeamIds.includes(team.id)
                    const disabled = (!sel && europaTeamIds.length >= 8) || inUcl
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => !disabled && toggleEuropa(team.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                          sel
                            ? 'bg-orange-500/10 border-orange-500/40 text-white'
                            : inUcl
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : disabled
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-300 hover:border-orange-400/20'
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
                          <div className="w-5 h-5 rounded bg-[#1e2d5a] shrink-0" />
                        )}
                        <span className="truncate">{team.name}</span>
                        {sel && <span className="ml-auto text-orange-400 shrink-0">✓</span>}
                        {inUcl && <span className="ml-auto text-[#c9a84c] shrink-0 text-[9px]">UCL</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Ready to launch</h3>
              <div className="bg-[#0f1a3d] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Phase name</span>
                  <span className="text-white font-medium">{seasonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-white">
                    {startDate} → {endDate} (45 days)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">League teams</span>
                  <span className="text-white">{allTeams.length} teams</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">League fixtures</span>
                  <span className="text-white font-medium">380</span>
                </div>
                <div className="border-t border-[#1e2d5a] pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#c9a84c]">UCL teams</span>
                    <span className="text-[#c9a84c] font-medium">
                      {uclTeamIds.length} teams · 60 group fixtures
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-400">Europa teams</span>
                    <span className="text-orange-400 font-medium">
                      {europaTeamIds.length} teams · 24 group fixtures
                    </span>
                  </div>
                </div>
                <div className="border-t border-[#1e2d5a] pt-3 flex justify-between font-semibold">
                  <span className="text-slate-300">Total fixtures</span>
                  <span className="text-white">464</span>
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

          {step < 3 ? (
            <button onClick={nextStep} className="btn-gold text-sm px-8">
              Next
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

// ─── Main export ──────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Phases</h1>
          <p className="text-slate-400 text-sm mt-1">Manage the EFA competition lifecycle</p>
        </div>
        {canStartNew ? (
          <button onClick={() => setShowDialog(true)} className="btn-gold">
            + Start Phase
          </button>
        ) : (
          <span className="text-xs text-slate-500 bg-[#0f1a3d] border border-[#1e2d5a] rounded-lg px-3 py-1.5">
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
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-lg font-medium text-white mb-2">No phases yet</p>
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
