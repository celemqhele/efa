'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TeamLogo from '@/components/ui/TeamLogo'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import SackCooldownDialog from '@/components/ui/SackCooldownDialog'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Check, X, Trophy, Loader2, Search } from 'lucide-react'
import ModalPortal from '@/components/ui/ModalPortal'

// --- Types -------------------------------------------------------------------

interface Team {
  id: string | null
  name: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

interface FinalStandingRow {
  position: number
  team_id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
  division?: number
}

interface Tournament {
  id: string
  name: string
  type: string
  status: string
  division: number | null
  fixture_count: number
  completed_count: number
  knockout_ready: boolean
}

interface LeagueDivision {
  id: string
  name: string
  division: number
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
  league_tournaments?: LeagueDivision[]
  league_total_fixtures: number
  league_completed_fixtures: number
  final_standings?: FinalStandingRow[]
  final_standings_by_division?: Record<number, FinalStandingRow[]>
  cup_taken?: Record<string, string>
}

interface Props {
  seasons: Season[]
  allTeams: Team[]
}

// --- Season card -------------------------------------------------------------

function SeasonCard({
  season,
  isFirst,
  onEndSeason,
  onCancelSeason,
  onGenerateKnockouts,
  onRefresh,
}: {
  season: Season
  isFirst: boolean
  onEndSeason: (id: string) => Promise<void>
  onCancelSeason: (id: string) => Promise<void>
  onGenerateKnockouts: (tournamentId: string) => Promise<void>
  onRefresh: () => void
}) {
  const [cancelDialog, setCancelDialog] = useState(false)
  const [showSuperCup, setShowSuperCup] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [startCupType, setStartCupType] = useState<'tournament_club' | 'tournament_international' | null>(null)

  const leagueT = season.tournaments.find((t) => t.type === 'league')
  const leagueDivs = season.league_tournaments ?? []
  const clubTs = season.tournaments
    .filter((t) => t.type === 'tournament_club' || t.type === 'tournament_international')
    .sort((a, b) => a.name.localeCompare(b.name))
  const superCupT = season.tournaments.find((t) => t.type === 'friendlies')

  const total = season.league_total_fixtures
  const done = season.league_completed_fixtures
  const allDone = total > 0 && done >= total
  const isActive = season.status === 'active'
  const isUpcoming = season.status === 'upcoming'
  const isCompleted = season.status === 'completed'

  // Cups can be started once every league fixture of an active season is played
  const cupsStartable = isActive && allDone && !!leagueT && (season.final_standings?.length ?? 0) > 0

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
              ? 'bg-accent/10 border-accent/30 text-accent'
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
          {/* League progress — one bar per division */}
          {leagueDivs.length > 0 && (
            <div className="space-y-space-3">
              {leagueDivs.map((div) => {
                const dTotal = div.fixture_count
                const dDone = div.completed_count
                const dProgress = dTotal > 0 ? Math.round((dDone / dTotal) * 100) : 0
                const dAllDone = dTotal > 0 && dDone >= dTotal
                return (
                  <div key={div.id}>
                    <div className="flex items-center justify-between mb-space-1">
                      <span className="text-xs text-text-muted">{div.name}</span>
                      <span className="text-xs text-text-secondary">
                        {dDone}/{dTotal} fixtures
                      </span>
                    </div>
                    <div className="w-full h-space-2 bg-bg-base rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${dAllDone ? 'bg-feedback-success' : 'bg-accent'}`}
                        style={{ width: `${dProgress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {allDone && (
                <p className="text-xs text-feedback-success">All league fixtures completed</p>
              )}
            </div>
          )}

          {/* Other tournaments — one tile per competition, labelled by its real name */}
          <div className="grid grid-cols-3 gap-space-2">
            {(['tournament_club', 'tournament_international'] as const).map((cupType) => {
              const existing = clubTs.find((t) => t.type === cupType)
              if (existing) {
                return (
                  <div key={existing.id} className="bg-bg-base rounded-lg px-space-3 py-space-2 text-center space-y-space-1">
                    <p className="text-xs font-bold text-text-primary truncate" title={existing.name}>
                      {existing.name}
                    </p>
                    <p
                      className={`text-[10px] ${
                        existing.status === 'active'
                          ? 'text-feedback-success'
                          : existing.status === 'completed'
                          ? 'text-text-muted'
                          : 'text-feedback-warning'
                      }`}
                    >
                      {existing.status === 'active' ? 'Active' : existing.status === 'completed' ? 'Done' : 'Upcoming'}
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      {existing.completed_count}/{existing.fixture_count}
                    </p>
                    {(existing.knockout_ready && isActive) && (
                      <Button
                        onClick={() => handleGenerateKO(existing.id)}
                        isLoading={loading === `ko-${existing.id}`}
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
                <div key={cupType} className="bg-bg-base rounded-lg px-space-3 py-space-2 text-center space-y-space-1">
                  <p className="text-xs font-bold text-text-primary truncate">
                    {cupType === 'tournament_club' ? 'Champions League' : 'Europa League'}
                  </p>
                  {cupsStartable ? (
                    <Button
                      onClick={() => setStartCupType(cupType)}
                      variant="secondary"
                      className="w-full text-[9px] py-space-1 px-space-1"
                    >
                      Start
                    </Button>
                  ) : (
                    <p className="text-[10px] text-text-muted opacity-50 py-space-1">
                      {isActive || isCompleted ? 'Starts after league' : 'Upcoming'}
                    </p>
                  )}
                </div>
              )
            })}
            <div className="bg-bg-base rounded-lg px-space-3 py-space-2 text-center space-y-space-1">
              {superCupT ? (
                <>
                  <p className="text-xs font-bold text-text-primary truncate" title={superCupT.name}>
                    {superCupT.name}
                  </p>
                  <p className={`text-[10px] ${superCupT.status === 'completed' ? 'text-text-muted' : 'text-feedback-warning'}`}>
                    {superCupT.status === 'completed' ? 'Done' : 'Upcoming'}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {superCupT.completed_count}/{superCupT.fixture_count}
                  </p>
                </>
              ) : isActive && clubTs.length >= 2 ? (
                <Button
                  onClick={() => setShowSuperCup(true)}
                  variant="secondary"
                  className="w-full h-full min-h-[52px] flex flex-col items-center justify-center gap-space-1"
                >
                  <Trophy className="w-4 h-4 text-gold" />
                  <span className="text-[9px]">Generate Super Cup</span>
                </Button>
              ) : (
                <p className="text-xs text-text-muted opacity-30">-</p>
              )}
            </div>
          </div>

          {/* Super Cup generation dialog */}
          {showSuperCup && (
            <SuperCupDialog
              seasonId={season.id}
              uclTId={clubTs.find((t) => t.type === 'tournament_club')?.id ?? ''}
              europaTId={clubTs.find((t) => t.type === 'tournament_international')?.id ?? ''}
              onClose={() => setShowSuperCup(false)}
              onCreated={() => { setShowSuperCup(false); window.location.reload() }}
            />
          )}

          {/* Start a cup from the final league standings */}
          {startCupType && (
            <StartCupDialog
              season={season}
              cupType={startCupType}
              onClose={() => setStartCupType(null)}
              onStarted={() => { setStartCupType(null); onRefresh() }}
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
        <TeamLogo
          leagueFolder={team.logo_league_folder}
          teamSlug={team.logo_team_slug}
          context="standings_row"
          alt={team.name}
          className="w-5 h-5 shrink-0"
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
  onClose,
}: {
  allTeams: Team[]
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [localManagers, setLocalManagers] = useState<Record<string, string>>({})
  const [assigningTeamId, setAssigningTeamId] = useState<string | null>(null)
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({})
  const [cooldown, setCooldown] = useState<{ username: string; cooldownEndsAt: string; teamId?: string | null } | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const [seasonName, setSeasonName] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [teamSearch, setTeamSearch] = useState('')

  // Selection by slug — two divisions (EFA Premier League / EFA Championship),
  // defaulting to 16 teams in each as the expected split.
  const allSlugs = allTeams.map((t) => t.logo_team_slug)
  const [activeDiv, setActiveDiv] = useState<1 | 2>(1)
  const [d1Slugs, setD1Slugs] = useState<string[]>(allSlugs.slice(0, 16))
  const [d2Slugs, setD2Slugs] = useState<string[]>(allSlugs.slice(16, 32))

  const leagueTeamObjects = allTeams.filter((t) => d1Slugs.includes(t.logo_team_slug) || d2Slugs.includes(t.logo_team_slug))
  const filteredTeams = allTeams.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
    t.logo_team_slug.toLowerCase().includes(teamSearch.toLowerCase())
  )

  const activeSlugs = activeDiv === 1 ? d1Slugs : d2Slugs
  const otherSlugs = activeDiv === 1 ? d2Slugs : d1Slugs

  function toggleTeam(slug: string) {
    if (otherSlugs.includes(slug)) return
    const setter = activeDiv === 1 ? setD1Slugs : setD2Slugs
    if (activeSlugs.includes(slug)) {
      setter((prev) => prev.filter((x) => x !== slug))
    } else {
      setter((prev) => [...prev, slug])
    }
  }

  function setActiveSlugs(slugs: string[]) {
    if (activeDiv === 1) setD1Slugs(slugs)
    else setD2Slugs(slugs)
  }

  const divObjects = (slugs: string[]) =>
    slugs.map((slug) => allTeams.find((t) => t.logo_team_slug === slug)!)

  function computeFixtureCounts() {
    const d1 = d1Slugs.length
    const d2 = d2Slugs.length
    const leagueCount = (d1 > 1 ? d1 * (d1 - 1) : 0) + (d2 > 1 ? d2 * (d2 - 1) : 0)
    return { division1: d1 > 1 ? d1 * (d1 - 1) : 0, division2: d2 > 1 ? d2 * (d2 - 1) : 0, total: leagueCount }
  }

  const endDate = (() => {
    const counts = computeFixtureCounts()
    const days = Math.max(7, Math.ceil(counts.total / 15))
    const d = new Date(startDate)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  })()

  async function handleStart() {
    setLoading(true)
    setError('')
    try {
      const toTeamData = (slugs: string[]) =>
        divObjects(slugs).filter(Boolean).map((t) => ({
          id: t.id,
          name: t.name,
          logo_league_folder: t.logo_league_folder,
          logo_team_slug: t.logo_team_slug,
          manager_id: localManagers[t.logo_team_slug] ?? t.manager_id ?? null,
        }))

      const res = await fetch('/api/admin/start-phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_name: seasonName,
          start_date: startDate,
          division1_teams: toTeamData(d1Slugs),
          division2_teams: toTeamData(d2Slugs),
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
      if (d1Slugs.length < 2 && d2Slugs.length < 2) { setError('Select at least 2 teams for the league.'); return }
      if (d1Slugs.length >= 2 && d1Slugs.length % 2 !== 0) { setError('Division 1 must have an even number of teams.'); return }
      if (d2Slugs.length >= 2 && d2Slugs.length % 2 !== 0) { setError('Division 2 must have an even number of teams.'); return }
      setUsersLoading(true)
      supabase.from('profiles').select('id, username').order('username')
        .then(({ data }) => { setUsers(data ?? []); setUsersLoading(false) })
    }
    setStep((s) => s + 1)
  }

  const STEP_LABELS = ['Phase Details', 'League Teams', 'Assign Managers', 'Confirm & Launch']

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-space-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-2xl overflow-hidden my-space-8">
        {/* Header */}
        <div className="px-space-6 py-space-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-text-primary font-bold text-lg">Start New Phase</h2>
            <p className="text-text-muted text-xs mt-space-1">
              Step {step} of 4: {STEP_LABELS[step - 1]}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Progress bar */}
        <div className="h-space-1 bg-border-subtle">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(step / 4) * 100}%` }}
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
                    value={endDate || '—'}
                    readOnly
                    className="input-field opacity-50 cursor-not-allowed"
                    placeholder="Computed on launch"
                  />
                </div>
              </div>
              <Card className="p-space-4 text-xs text-text-muted space-y-space-1">
                <p className="font-medium text-text-primary">What gets generated:</p>
                <ul className="list-disc list-inside space-y-space-1 mt-space-1">
                  <li>Premier League fixtures for your selected teams</li>
                  <li>15 fixtures per weekday, 30 per weekend day</li>
                  <li>UCL &amp; Europa start later — from the final league standings</li>
                </ul>
              </Card>
            </div>
          )}

          {/* -- Step 2: League teams -- */}
          {step === 2 && (
            <div className="space-y-space-3">
              {/* Division tabs */}
              <div className="flex items-center gap-space-2">
                {([1, 2] as const).map((dv) => {
                  const slugs = dv === 1 ? d1Slugs : d2Slugs
                  const even = slugs.length % 2 === 0
                  const active = activeDiv === dv
                  return (
                    <button
                      key={dv}
                      type="button"
                      onClick={() => setActiveDiv(dv)}
                      className={`flex-1 rounded-xl border px-space-3 py-space-2 text-left transition-colors ${
                        active ? 'border-accent bg-accent/10' : 'border-border bg-bg-base'
                      }`}
                    >
                      <p className="text-xs font-bold text-text-primary">Division {dv}</p>
                      <p className="text-[10px] text-text-muted">{dv === 1 ? 'EFA Premier League' : 'EFA Championship'}</p>
                      <p className={`text-[10px] font-bold mt-space-0.5 ${even && slugs.length >= 2 ? 'text-feedback-success' : 'text-accent'}`}>
                        {slugs.length} team{slugs.length !== 1 ? 's' : ''} {!even ? '· needs even count' : ''}
                      </p>
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-text-muted">
                Each division needs an even number of teams (any amount). Click teams or import from a poll.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search teams..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="input-field pl-8"
                  />
                </div>
                <ImportFromPollButton allTeams={allTeams} onSelect={(slugs) => setActiveSlugs(slugs)} />
              </div>

              <div className="grid grid-cols-2 gap-space-2 max-h-72 overflow-y-auto pr-space-1">
                {filteredTeams.map((team) => {
                  const inActive = activeSlugs.includes(team.logo_team_slug)
                  const inOther = otherSlugs.includes(team.logo_team_slug)
                  return (
                    <TeamPickerButton
                      key={team.logo_team_slug}
                      team={team}
                      selected={inActive}
                      disabled={inOther}
                      badgeText={inOther ? `in Division ${activeDiv === 1 ? 2 : 1}` : undefined}
                      accentClass="bg-feedback-success/10 border-feedback-success/40"
                      onClick={() => toggleTeam(team.logo_team_slug)}
                    />
                  )
                })}
              </div>

              {activeSlugs.length > 0 && (
                <div className="pt-space-2 border-t border-border">
                  <p className="text-[10px] text-text-muted mb-space-1">Selected (Division {activeDiv}): {activeSlugs.map((s) => allTeams.find((t) => t.logo_team_slug === s)?.name).join(', ')}</p>
                </div>
              )}
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
                Assign managers to your selected league teams.
              </p>

              {usersLoading ? (
                <div className="py-space-8 text-center text-text-muted text-sm">Loading users...</div>
              ) : (
                <div className="space-y-space-1.5 max-h-80 overflow-y-auto pr-space-1">
                  {leagueTeamObjects.map((team) => {
                    const resolvedManagerId = localManagers[team.logo_team_slug] ?? team.manager_id
                    const mgr = resolvedManagerId ? users.find((u) => u.id === resolvedManagerId) : null
                    const isAssigning = assigningTeamId === team.logo_team_slug
                    const assignErr = assignErrors[team.logo_team_slug]

                    return (
                      <div key={team.logo_team_slug} className="flex items-center gap-space-2.5 px-space-3 py-space-2 rounded-lg bg-bg-elevated border border-border">
                        {team.logo_league_folder ? (
                          <TeamLogo
                            leagueFolder={team.logo_league_folder}
                            teamSlug={team.logo_team_slug}
                            context="standings_row"
                            alt={team.name}
                            className="w-5 h-5 shrink-0"
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
                              onClick={() => setLocalManagers((prev) => { const n = { ...prev }; delete n[team.logo_team_slug]; return n })}
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
                              setAssigningTeamId(team.logo_team_slug)
                              setAssignErrors((prev) => { const n = { ...prev }; delete n[team.logo_team_slug]; return n })
                                try {
                                  const res = await fetch('/api/admin/managers/assign', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      team_id: team.id,
                                      user_id: userId,
                                      logo_league_folder: team.logo_league_folder,
                                      logo_team_slug: team.logo_team_slug,
                                      name: team.name,
                                      override: false,
                                    }),
                                  })
                                  const data = await res.json()
                                  if (!res.ok) {
                                    if (data?.code === 'SACK_COOLDOWN') {
                                      const profile = users.find((u) => u.id === userId)
                                      setCooldown({
                                        username: profile?.username ?? 'this manager',
                                        cooldownEndsAt: data.cooldown_ends_at,
                                        teamId: team.id,
                                      })
                                    }
                                    throw new Error(data.error ?? 'Failed to assign')
                                  }
                                  setLocalManagers((prev) => ({ ...prev, [team.logo_team_slug]: userId }))
                                } catch (err: any) {
                                  setAssignErrors((prev) => ({ ...prev, [team.logo_team_slug]: err.message }))
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

          {/* -- Step 4: Confirm -- */}
          {step === 4 && (() => {
            const counts = computeFixtureCounts()
            return (
            <div className="space-y-space-4">
              <h3 className="text-text-primary font-semibold">Ready to launch</h3>
              <Card className="p-space-4 space-y-space-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Phase name</span>
                  <span className="text-text-primary font-medium">{seasonName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Start date</span>
                  <span className="text-text-primary">{startDate}</span>
                </div>
                <div className="border-t border-border pt-space-3 space-y-space-2">
                  <div className="flex justify-between">
                    <span className="text-blue-500">Division 1</span>
                    <span className="text-blue-500 font-medium">{d1Slugs.length} teams — {counts.division1} fixtures</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-500">Division 2</span>
                    <span className="text-blue-500 font-medium">{d2Slugs.length} teams — {counts.division2} fixtures</span>
                  </div>
                </div>
                <div className="border-t border-border pt-space-3 flex justify-between font-semibold">
                  <span className="text-text-secondary">Total fixtures</span>
                  <span className="text-text-primary">{counts.total}</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  UCL &amp; Europa are not generated now. Once every league fixture is played, start them
                  from this page — teams are chosen manually.
                </p>
              </Card>
            </div>
            )
          })()}

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

          {step < 4 ? (
            <Button variant="primary" onClick={nextStep} className="px-space-8">
              Next
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

      <SackCooldownDialog
        open={!!cooldown}
        username={cooldown?.username ?? ''}
        cooldownEndsAt={cooldown?.cooldownEndsAt ?? ''}
        onClose={() => setCooldown(null)}
        onOverride={() => {
          if (cooldown) {
            const user = users.find(u => u.username === cooldown.username)
            const team = cooldown.teamId ? allTeams.find(t => t.id === cooldown.teamId) : undefined
            if (user && team) {
              setCooldown(null)
              fetch('/api/admin/managers/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  team_id: team.id,
                  user_id: user.id,
                  logo_league_folder: team.logo_league_folder,
                  logo_team_slug: team.logo_team_slug,
                  name: team.name,
                  override: true,
                }),
              }).then(res => res.json()).then(data => {
                if (data.success) {
                  setLocalManagers((prev) => ({ ...prev, [team.logo_team_slug]: user.id }))
                } else {
                  setAssignErrors((prev) => ({ ...prev, [team.logo_team_slug]: data.error }))
                }
              })
            }
          }
        }}
      />

      </div>
    </div>
  )
}

// --- Import from Poll button --------------------------------------------------

function ImportFromPollButton({ allTeams, onSelect }: { allTeams: Team[]; onSelect: (slugs: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [polls, setPolls] = useState<any[]>([])
  const [apps, setApps] = useState<any[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [done, setDone] = useState(0)

  async function loadPolls() {
    setImportLoading(true)
    setImportError('')
    try {
      const res = await fetch('/api/admin/polls')
      if (!res.ok) { setImportError(`API error: ${res.status}`); return }
      const data = await res.json()
      setPolls(data.polls ?? [])
      setApps(data.applications ?? [])
    } catch (e: any) {
      setImportError(e.message ?? 'Failed to load polls')
    }
    setImportLoading(false)
  }

  function handleImport(pollId: string) {
    try {
      const pollApps = apps.filter((a: any) => a.poll_id === pollId && a.status !== 'withdrawn')
      const matched: string[] = []
      for (const app of pollApps) {
        const team = allTeams.find(
          (t) => t.logo_team_slug === app.team_slug && t.logo_league_folder === app.team_league
        )
        if (team) matched.push(team.logo_team_slug)
      }
      if (matched.length > 0) {
        onSelect(matched)
        setDone(matched.length)
        setTimeout(() => setDone(0), 2500)
      } else {
        setImportError('No teams matched — the slug/league names differ from the logo database.')
      }
    } catch (e: any) {
      setImportError(e.message ?? 'Import failed')
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        {done > 0 && <span className="text-[10px] text-green-400">{done} imported</span>}
        <button
          type="button"
          onClick={() => { setOpen(true); loadPolls() }}
          className="text-[10px] px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors whitespace-nowrap"
        >
          Import from Poll
        </button>
      </div>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative z-10 w-full max-w-md bg-bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-scale-in max-h-[80vh] flex flex-col">
              <h3 className="text-lg font-bold text-foreground-primary mb-4">Import from Poll</h3>

              {importError && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-4">{importError}</p>
              )}

              {importLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              ) : polls.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No polls found.</p>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {polls.map((poll) => {
                    const pollApps = apps.filter((a: any) => a.poll_id === poll.id && a.status !== 'withdrawn')
                    return (
                      <button
                        key={poll.id}
                        type="button"
                        onClick={() => handleImport(poll.id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-bg-elevated hover:border-accent/30 transition-colors text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground-primary">{poll.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{pollApps.length} teams</p>
                        </div>
                        <span className="text-xs text-accent shrink-0">Import</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 text-sm text-text-muted hover:text-foreground-secondary transition-colors self-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
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
  const [uclTeams, setUclTeams] = useState<Team[]>([])
  const [europaTeams, setEuropaTeams] = useState<Team[]>([])
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
          .select('team:teams(id, name, logo_league_folder, logo_team_slug)')
          .eq('tournament_id', uclTId) as any
        if (uclPart) {
          setUclTeams(uclPart.map((p: any) => p.team).filter(Boolean))
        }
      }

      // Load Europa participants
      if (europaTId) {
        const { data: europaPart } = await supabase
          .from('tournament_participants')
          .select('team:teams(id, name, logo_league_folder, logo_team_slug)')
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

    setLoading(true)
    setError('')
    setResult(null)

    try {
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
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate Super Cup')
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-space-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl bg-bg-surface border border-border rounded-2xl overflow-hidden my-space-8" onClick={(e) => e.stopPropagation()}>
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
          <div className="p-space-6 space-y-space-6">
            <div className="space-y-space-4">
              <div className="bg-accent-muted border border-accent/20 rounded-lg p-space-3 text-xs text-accent">
                Select the winners of the UCL and Europa League to generate the Super Cup final.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-6">
                {/* UCL Picker */}
                <div>
                  <div className="flex items-center justify-between mb-space-3">
                    <h3 className="text-text-primary font-semibold text-sm">UCL Winner</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-space-2 max-h-60 overflow-y-auto pr-space-1">
                    {uclTeams.map((team) => (
                      <TeamPickerButton
                        key={team.id ?? team.logo_team_slug}
                        team={team}
                        selected={selectedUcl === team.id}
                        disabled={false}
                        accentClass="bg-accent/10 border-accent/40"
                        onClick={() => team.id && setSelectedUcl(team.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Europa Picker */}
                <div>
                  <div className="flex items-center justify-between mb-space-3">
                    <h3 className="text-text-primary font-semibold text-sm">Europa Winner</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-space-2 max-h-60 overflow-y-auto pr-space-1">
                    {europaTeams.map((team) => (
                      <TeamPickerButton
                        key={team.id ?? team.logo_team_slug}
                        team={team}
                        selected={selectedEuropa === team.id}
                        disabled={false}
                        accentClass="bg-feedback-warning/10 border-feedback-warning/40"
                        onClick={() => team.id && setSelectedEuropa(team.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-feedback-error text-sm text-center">{error}</p>
            )}

            <div className="flex gap-space-3">
              <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
              <Button 
                onClick={handleSubmit} 
                isLoading={loading} 
                variant="primary" 
                className="flex-1"
                disabled={!selectedUcl || !selectedEuropa}
              >
                Generate Final
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- Start Cup Dialog ---------------------------------------------------------

function StartCupDialog({
  season,
  cupType,
  onClose,
  onStarted,
}: {
  season: Season
  cupType: 'tournament_club' | 'tournament_international'
  onClose: () => void
  onStarted: () => void
}) {
  const title = cupType === 'tournament_club' ? 'Champions League' : 'Europa League'
  const otherBadge = cupType === 'tournament_club' ? 'EL' : 'UCL'

  const standingsByDiv = season.final_standings_by_division ?? {}
  const standings = season.final_standings ?? []
  const hasDivisions = Object.keys(standingsByDiv).length > 0
  const taken = season.cup_taken ?? {}

  const divisionGroups: [string, FinalStandingRow[]][] = hasDivisions
    ? Object.entries(standingsByDiv).sort(([a], [b]) => Number(a) - Number(b))
    : [['0', standings]]

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
  const [numGroups, setNumGroups] = useState(2)
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allRows = divisionGroups.flatMap(([, rows]) => rows).filter((row) => !taken[row.team_id])
  const selected = allRows.filter((row) => selectedSlugs.has(row.team_id))
  const perGroup = numGroups > 0 ? Math.floor(selected.length / numGroups) : 0
  const validSplit = numGroups >= 1 && selected.length >= numGroups * 2 && selected.length % numGroups === 0
  const fixtureCount = validSplit ? numGroups * perGroup * (perGroup - 1) : 0

  function toggleTeam(teamId: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  async function handleStart() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/start-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: season.id,
          type: cupType,
          team_ids: selected.map((s) => s.team_id),
          num_groups: numGroups,
          qualifiers_per_group: qualifiersPerGroup,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start tournament')
      onStarted()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-space-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-xl bg-bg-surface border border-border rounded-2xl overflow-hidden my-space-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-space-6 py-space-4 border-b border-border flex items-center justify-between">
          <h2 className="text-text-primary font-bold text-lg flex items-center gap-space-2">
            <Trophy className="w-5 h-5 text-gold" /> Start {title}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-space-6 space-y-space-5">
          <div className="bg-accent-muted border border-accent/20 rounded-lg p-space-3 text-xs text-accent">
            Teams are chosen manually — click teams in the list to pick them for this competition.
            Teams already taken by the other competition are locked.
          </div>

          {/* Config */}
          <div className="grid grid-cols-3 gap-space-3">
            <div>
              <label className="text-[10px] text-text-muted">Selected</label>
              <div className="input-field text-xs flex items-center gap-space-1">
                {selected.length} <span className="text-text-muted">/ {allRows.length}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-muted">Groups</label>
              <input
                type="number"
                min={1}
                value={numGroups}
                onChange={(e) => setNumGroups(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted">Qualify per group</label>
              <input
                type="number"
                min={1}
                value={qualifiersPerGroup}
                onChange={(e) => setQualifiersPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field text-xs"
              />
            </div>
          </div>

          <p className={`text-xs ${validSplit ? 'text-text-secondary' : 'text-feedback-error'}`}>
            {allRows.length === 0
              ? 'No teams left to pick from.'
              : validSplit
              ? `${selected.length} teams in ${numGroups} group${numGroups > 1 ? 's' : ''} of ${perGroup} — ${fixtureCount} fixtures`
              : `Select a team count that divides evenly across groups (min 2 per group).`}
          </p>

          {/* Standings list — grouped by division */}
          <div className="space-y-space-3 max-h-80 overflow-y-auto pr-space-1">
            {divisionGroups.map(([divNum, rows]) => (
              <div key={divNum}>
                {hasDivisions && (
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-space-1">
                    Division {divNum}
                  </p>
                )}
                <div className="space-y-space-1.5">
                  {rows.map((row) => {
                    const isSelected = selectedSlugs.has(row.team_id)
                    const isTaken = !!taken[row.team_id]
                    return (
                      <button
                        key={row.team_id}
                        type="button"
                        disabled={isTaken}
                        onClick={() => toggleTeam(row.team_id)}
                        className={`w-full flex items-center gap-space-2.5 px-space-3 py-space-2 rounded-lg border text-left ${
                          isSelected
                            ? 'bg-accent/10 border-accent/40'
                            : isTaken
                            ? 'bg-bg-elevated border-border opacity-50'
                            : 'bg-bg-elevated border-border hover:border-border-strong'
                        }`}
                      >
                        <span className="text-xs font-bold text-text-secondary w-6 shrink-0 tabular-nums">{row.position}</span>
                        {row.logo_team_slug ? (
                          <TeamLogo
                            leagueFolder={row.logo_league_folder}
                            teamSlug={row.logo_team_slug}
                            context="standings_row"
                            alt={row.name}
                            className="w-5 h-5 shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-bg-base shrink-0" />
                        )}
                        <span className="text-xs font-medium text-text-primary truncate flex-1 min-w-0">{row.name}</span>
                        {isTaken && <span className="text-[9px] text-text-muted shrink-0">{otherBadge}</span>}
                        {isSelected && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-accent" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-space-3 text-feedback-error text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-space-6 pb-space-6 flex gap-space-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
          <Button
            onClick={handleStart}
            isLoading={loading}
            disabled={!validSplit || loading}
            variant="primary"
            className="flex-1"
          >
            Start &amp; Generate Fixtures
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Main export --------------------------------------------------------------

export default function SeasonManager({ seasons, allTeams }: Props) {
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
              onRefresh={() => router.refresh()}
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
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  )
}
