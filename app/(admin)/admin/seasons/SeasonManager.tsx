'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'

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

// ─── Season timeline card ─────────────────────────────────────────────────────

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
  const [confirmCancel, setConfirmCancel] = useState(false)
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
    setLoading('cancel')
    await onCancelSeason(season.id)
    setLoading(null)
    setConfirmCancel(false)
  }

  return (
    <div className={`card p-5 space-y-4 ${isUpcoming && !isFirst ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">{season.name}</h3>
          {season.start_date && season.end_date && (
            <p className="text-slate-500 text-xs mt-0.5">
              {new Date(season.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' – '}
              {new Date(season.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
          Waiting for the previous season to end before this can start.
        </p>
      )}

      {(isActive || isCompleted) && (
        <>
          {/* League progress */}
          {leagueT && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">EFA Premier League</span>
                <span className="text-xs text-slate-500">{done}/{total} fixtures</span>
              </div>
              <div className="w-full h-2 bg-[#1e2d5a] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allDone ? 'bg-green-500' : 'bg-[#c9a84c]'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {allDone && <p className="text-xs text-green-400 mt-1">All fixtures completed</p>}
            </div>
          )}

          {/* Other tournaments */}
          <div className="grid grid-cols-3 gap-2">
            {[uclT, europaT, superCupT].map((t) =>
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
                </div>
              ) : (
                <div key={Math.random()} className="bg-[#0f1a3d] rounded-lg px-3 py-2 text-center opacity-30">
                  <p className="text-xs text-slate-500">—</p>
                </div>
              )
            )}
          </div>

          {/* Actions */}
          {isActive && (
            <div className="flex gap-3 pt-1">
              {!confirmCancel ? (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1.5 border border-slate-700 rounded-lg"
                >
                  Cancel Season
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-red-400 flex-1">Are you sure? This cannot be undone.</span>
                  <button
                    onClick={handleCancel}
                    disabled={loading === 'cancel'}
                    className="text-xs text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {loading === 'cancel' ? 'Cancelling…' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="text-xs text-slate-400 px-3 py-1.5"
                  >
                    No
                  </button>
                </div>
              )}

              <button
                onClick={handleEnd}
                disabled={!allDone || loading === 'end'}
                className={`ml-auto btn-gold text-xs px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed`}
                title={!allDone ? `${total - done} fixtures still remaining` : undefined}
              >
                {loading === 'end' ? 'Ending…' : allDone ? 'End Season' : `End Season (${done}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Start Season Wizard ──────────────────────────────────────────────────────

function StartSeasonWizard({
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

  // Step 1: Season info
  const today = new Date().toISOString().split('T')[0]
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [seasonName, setSeasonName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(nextMonth)

  // Step 2: League teams
  const [leagueTeamIds, setLeagueTeamIds] = useState<string[]>([])
  const [teamSearch, setTeamSearch] = useState('')

  // Step 3: UCL/Europa qualifiers (editable)
  const prevTeamIds = prevSeasonStandings?.map((s) => s.team_id) ?? []
  const [uclTeamIds, setUclTeamIds] = useState<string[]>(prevTeamIds.slice(0, 12))
  const [europaTeamIds, setEuropaTeamIds] = useState<string[]>(prevTeamIds.slice(12, 20))
  const isFirstSeason = !prevSeasonStandings || prevSeasonStandings.length === 0

  function toggleLeague(id: string) {
    setLeagueTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const managedTeams = allTeams.filter((t) => t.manager_id !== null)
  const filteredTeams = managedTeams.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase())
  )

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/start-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_name: seasonName,
          start_date: startDate,
          end_date: endDate,
          league_team_ids: leagueTeamIds,
          ucl_team_ids: isFirstSeason ? [] : uclTeamIds,
          europa_team_ids: isFirstSeason ? [] : europaTeamIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start season')
      router.refresh()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const STEPS = ['Season Details', 'League Teams', isFirstSeason ? 'Confirm' : 'UCL & Europa', 'Confirm']
  const totalSteps = isFirstSeason ? 3 : 4

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0a1128] border border-[#1e2d5a] rounded-2xl overflow-hidden my-8">
        {/* Wizard header */}
        <div className="px-6 py-4 border-b border-[#1e2d5a] flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">Start New Season</h2>
            <p className="text-slate-500 text-xs mt-0.5">Step {step} of {totalSteps}: {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-[#1e2d5a]">
          <div
            className="h-full bg-[#c9a84c] transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Season details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">Season Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="e.g. Season 1 (May–June 2026)"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="bg-[#0f1a3d] rounded-lg p-4 text-xs text-slate-400 space-y-1">
                <p>The system will automatically schedule:</p>
                <ul className="list-disc list-inside space-y-0.5 mt-2">
                  <li>2 fixture rounds per weekday</li>
                  <li>3 fixture rounds per weekend / public holiday</li>
                  {!isFirstSeason && <li>UCL group stage (top 12 from previous season)</li>}
                  {!isFirstSeason && <li>Europa League draw (bottom 8 from previous season)</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: League teams */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">
                  Select 20 managers for the league.
                </p>
                <span className={`text-sm font-bold ${leagueTeamIds.length === 20 ? 'text-green-400' : 'text-[#c9a84c]'}`}>
                  {leagueTeamIds.length}/20 selected
                </span>
              </div>
              <input
                type="text"
                placeholder="Search teams…"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="input-field"
              />
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {filteredTeams.map((team) => {
                  const selected = leagueTeamIds.includes(team.id)
                  const disabled = !selected && leagueTeamIds.length >= 20
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => !disabled && toggleLeague(team.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                        selected
                          ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-white'
                          : disabled
                          ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                          : 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-300 hover:border-[#c9a84c]/20'
                      }`}
                    >
                      {team.logo_league_folder ? (
                        <Image
                          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                          alt={team.name} width={24} height={24} className="object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-[#1e2d5a] shrink-0" />
                      )}
                      <span className="text-xs font-medium truncate">{team.name}</span>
                      {selected && <span className="ml-auto text-[#c9a84c] text-xs shrink-0">✓</span>}
                    </button>
                  )
                })}
                {filteredTeams.length === 0 && (
                  <p className="col-span-2 text-center text-slate-500 text-sm py-4">
                    {managedTeams.length === 0 ? 'No managed teams exist yet.' : 'No teams match your search.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: UCL & Europa (skipped for first season) */}
          {step === 3 && !isFirstSeason && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
                Auto-populated from previous season's final standings. You can remove or add teams.
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">EFA Champions League</h3>
                  <span className={`text-xs font-bold ${uclTeamIds.length === 12 ? 'text-green-400' : 'text-[#c9a84c]'}`}>
                    {uclTeamIds.length}/12
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {allTeams.map((team) => {
                    const sel = uclTeamIds.includes(team.id)
                    const disabled = !sel && uclTeamIds.length >= 12
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          if (sel) setUclTeamIds((p) => p.filter((x) => x !== team.id))
                          else if (!disabled) setUclTeamIds((p) => [...p, team.id])
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                          sel
                            ? 'bg-[#c9a84c]/10 border-[#c9a84c]/40 text-white'
                            : disabled
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-300 hover:border-[#c9a84c]/20'
                        }`}
                      >
                        <span className="truncate">{team.name}</span>
                        {sel && <span className="ml-auto text-[#c9a84c] shrink-0">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">EFA Europa League</h3>
                  <span className={`text-xs font-bold ${europaTeamIds.length === 8 ? 'text-green-400' : 'text-orange-400'}`}>
                    {europaTeamIds.length}/8
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {allTeams.map((team) => {
                    const sel = europaTeamIds.includes(team.id)
                    const disabled = !sel && europaTeamIds.length >= 8
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          if (sel) setEuropaTeamIds((p) => p.filter((x) => x !== team.id))
                          else if (!disabled) setEuropaTeamIds((p) => [...p, team.id])
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                          sel
                            ? 'bg-orange-500/10 border-orange-500/40 text-white'
                            : disabled
                            ? 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-600 cursor-not-allowed'
                            : 'bg-[#0f1a3d] border-[#1e2d5a] text-slate-300 hover:border-orange-400/20'
                        }`}
                      >
                        <span className="truncate">{team.name}</span>
                        {sel && <span className="ml-auto text-orange-400 shrink-0">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Confirm step */}
          {((step === 3 && isFirstSeason) || (step === 4 && !isFirstSeason)) && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Ready to start</h3>
              <div className="bg-[#0f1a3d] rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Season</span>
                  <span className="text-white font-medium">{seasonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dates</span>
                  <span className="text-white">{startDate} → {endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">League teams</span>
                  <span className="text-white">{leagueTeamIds.length} teams</span>
                </div>
                {!isFirstSeason && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">UCL qualifiers</span>
                      <span className="text-[#c9a84c]">{uclTeamIds.length} teams</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Europa qualifiers</span>
                      <span className="text-orange-400">{europaTeamIds.length} teams</span>
                    </div>
                  </>
                )}
                {isFirstSeason && (
                  <div className="text-slate-500 text-xs border-t border-[#1e2d5a] pt-3 mt-1">
                    UCL & Europa will be created after this season ends, using the final standings.
                  </div>
                )}
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

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex justify-between gap-3">
          <button
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            className="btn-outline text-sm"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {((step === 3 && isFirstSeason) || (step === 4 && !isFirstSeason)) ? (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="btn-gold text-sm px-8 disabled:opacity-50"
            >
              {loading ? 'Starting season…' : 'Start Season'}
            </button>
          ) : (
            <button
              onClick={() => {
                setError('')
                if (step === 1 && !seasonName.trim()) { setError('Season name is required.'); return }
                if (step === 1 && !startDate) { setError('Start date is required.'); return }
                if (step === 2 && leagueTeamIds.length < 2) { setError('Select at least 2 teams for the league.'); return }
                setStep((s) => s + 1)
              }}
              className="btn-gold text-sm px-8"
            >
              Next
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
  const [showWizard, setShowWizard] = useState(false)
  const [actionError, setActionError] = useState('')

  // Determine if we can start a new season (no active season exists)
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
    if (!res.ok) { setActionError(data.error ?? 'Failed to end season'); return }
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
    if (!res.ok) { setActionError(data.error ?? 'Failed to cancel season'); return }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Seasons</h1>
          <p className="text-slate-400 text-sm mt-1">Manage the EFA season lifecycle</p>
        </div>
        {canStartNew && (
          <button onClick={() => setShowWizard(true)} className="btn-gold">
            + Start Season
          </button>
        )}
        {!canStartNew && (
          <span className="text-xs text-slate-500 bg-[#0f1a3d] border border-[#1e2d5a] rounded-lg px-3 py-1.5">
            End the active season first
          </span>
        )}
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {actionError}
        </div>
      )}

      {/* Season timeline */}
      {seasons.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-lg font-medium text-white mb-2">No seasons yet</p>
          <p className="text-sm text-slate-500 mb-6">Start your first season to begin scheduling fixtures.</p>
          <button onClick={() => setShowWizard(true)} className="btn-gold">Start First Season</button>
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

          {/* Next season placeholder (greyed) */}
          {hasActiveSeason && (
            <div className="card p-5 opacity-40 border-dashed">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-slate-400 font-bold">Next Season</h3>
                  <p className="text-slate-600 text-xs mt-0.5">Available after current season ends</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-600">
                  Locked
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wizard modal */}
      {showWizard && (
        <StartSeasonWizard
          allTeams={allTeams}
          prevSeasonStandings={prevSeasonStandings}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
