'use client'

// File encoding: UTF-8
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getTeamLogo } from '@/lib/logo-resolver'
import { createClient } from '@/lib/supabase/client'
import { addDays, format, parseISO } from 'date-fns'
import { Loader2 } from 'lucide-react'

interface Season {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

interface Team {
  id: string | null
  name: string
  logo_league_folder: string
  logo_team_slug: string
  manager_id: string | null
}

interface Standing {
  team_id: string
  points: number
}

interface Props {
  seasons: Season[]
  allTeams: Team[]
  activeLeagueName: string | null
  leagueStandings: Standing[]
}

const TOURNAMENT_NAMES: Record<string, string> = {
  league: 'EFA Premier League',
  ucl: 'EFA Champions League',
  europa: 'EFA Europa League',
  super_cup: 'EFA Super Cup',
}

const UCL_SPOTS = 12
const EUROPA_SPOTS = 8

export default function CreateTournamentClient({ seasons, allTeams, activeLeagueName, leagueStandings }: Props) {
  const router = useRouter()

  // Season
  const [seasonMode, setSeasonMode] = useState<'existing' | 'new'>('existing')
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    seasons.find((s) => s.status === 'active')?.id ?? seasons[0]?.id ?? ''
  )
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonLeague, setNewSeasonLeague] = useState('')

  // Tournament
  const [type, setType] = useState<'league' | 'ucl' | 'europa' | 'super_cup' | 'custom'>('league')
  const [customTypeName, setCustomTypeName] = useState('')
  const [name, setName] = useState(TOURNAMENT_NAMES.league)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Format Settings
  const [numGroups, setNumGroups] = useState(4)
  const [teamsPerGroup, setTeamsPerGroup] = useState(3)
  const [numRounds, setNumRounds] = useState(2)
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2)

  // Team selection — using logo_team_slug as the unique key
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [teamSearch, setTeamSearch] = useState('')

  // Auto-population for UCL / Europa
  const topTeamIds = leagueStandings.slice(0, UCL_SPOTS).map((s) => s.team_id)
  const europaTeamIds = leagueStandings.slice(UCL_SPOTS, UCL_SPOTS + EUROPA_SPOTS).map((s) => s.team_id)

  const topTeamSlugs = allTeams.filter(t => t.id && topTeamIds.includes(t.id)).map(t => t.logo_team_slug)
  const europaTeamSlugs = allTeams.filter(t => t.id && europaTeamIds.includes(t.id)).map(t => t.logo_team_slug)

  useEffect(() => {
    if (type !== 'custom') setName(TOURNAMENT_NAMES[type] ?? type)
    if (type === 'ucl') {
      setSelectedSlugs(topTeamSlugs)
      setNumGroups(4)
      setTeamsPerGroup(3)
      setNumRounds(2)
      setQualifiersPerGroup(2)
    } else if (type === 'europa') {
      setSelectedSlugs(europaTeamSlugs)
      setNumGroups(2)
      setTeamsPerGroup(4)
      setNumRounds(2)
      setQualifiersPerGroup(2)
    } else if (type === 'super_cup') {
      setSelectedSlugs([])
      setNumGroups(1)
      setTeamsPerGroup(2)
      setNumRounds(1)
    } else if (type === 'custom') {
      setSelectedSlugs([])
      setName('')
    } else if (type === 'league') {
      setNumRounds(2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  // Auto-calculate end date from slot capacity
  const calcEndDate = useCallback((start: string, teamCount: number, r: number, t: string, g: number, tpg: number) => {
    if (!start || teamCount < 2) return ''
    let totalFixtures: number
    if (t === 'super_cup') {
      totalFixtures = 1
    } else if (t === 'league' || t === 'custom') {
      totalFixtures = teamCount * (teamCount - 1) * r / 2
    } else {
      totalFixtures = g * tpg * (tpg - 1) * r / 2
    }
    let date = parseISO(start)
    let remaining = totalFixtures
    for (let safety = 0; safety < 365; safety++) {
      if (remaining <= 0) break
      const dow = date.getDay()
      const cap = dow === 0 || dow === 6 ? 10 : 5
      remaining -= cap
      date = addDays(date, 1)
    }
    return format(date, 'yyyy-MM-dd')
  }, [])

  useEffect(() => {
    const teams = type === 'super_cup' ? 2 : selectedSlugs.length
    const autoEnd = calcEndDate(startDate, teams, numRounds, type, numGroups, teamsPerGroup)
    if (autoEnd) setEndDate(autoEnd)
  }, [startDate, selectedSlugs, numRounds, type, numGroups, teamsPerGroup, calcEndDate])

  // Manager assignments
  const [users, setUsers] = useState<{ id: string; username: string }[]>([])
  const [localManagers, setLocalManagers] = useState<Record<string, string>>({}) // slug -> user_id
  const [assigningSlug, setAssigningSlug] = useState<string | null>(null)
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('id, username').order('username')
      .then(({ data }) => setUsers(data ?? []))
  }, [])

  // Submission
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleTeam(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    )
  }

  const filteredTeams = allTeams.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
    t.logo_team_slug.toLowerCase().includes(teamSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError('Tournament name is required.')
    if ((type === 'league' || type === 'custom') && selectedSlugs.length < 2) return setError('Select at least 2 teams.')
    if (!startDate || !endDate) return setError('Start and end dates are required.')
    
    // Validation for groups
    if (type !== 'league' && type !== 'super_cup') {
      if (selectedSlugs.length !== numGroups * teamsPerGroup) {
        return setError(`Team count (${selectedSlugs.length}) does not match Group settings (${numGroups} groups × ${teamsPerGroup} teams = ${numGroups * teamsPerGroup}).`)
      }
    }

    setLoading(true)
    try {
      let seasonId = selectedSeasonId
      if (seasonMode === 'new') {
        if (!newSeasonName.trim()) { setError('Season name is required.'); setLoading(false); return }
        const sRes = await fetch('/api/admin/create-season', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newSeasonName, base_league: newSeasonLeague || 'EFA League' }),
        })
        const sData = await sRes.json()
        if (!sRes.ok) throw new Error(sData.error ?? 'Failed to create season')
        seasonId = sData.id
      }

      const selectedTeams = allTeams.filter(t => selectedSlugs.includes(t.logo_team_slug))
      const teamsData = selectedTeams.map(t => ({
        id: t.id,
        name: t.name,
        logo_league_folder: t.logo_league_folder,
        logo_team_slug: t.logo_team_slug,
        manager_id: localManagers[t.logo_team_slug] ?? null
      }))

      const resolvedType = type === 'custom' ? 'league' : type
      const res = await fetch('/api/admin/create-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId || null,
          name,
          type: resolvedType,
          start_date: startDate,
          end_date: endDate,
          teams: teamsData,
          settings: {
            num_groups: numGroups,
            teams_per_group: teamsPerGroup,
            num_rounds: numRounds,
            qualifiers_per_group: qualifiersPerGroup,
            fixture_mode: type === 'custom' ? 'groups' : 'round_robin'
          }
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create tournament')

      // Redirect to fixture generation
      router.push(`/admin/fixtures/manage?tournament=${data.tournament_id}&generate=1`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isAutoPopulated = (type === 'ucl' || type === 'europa') && leagueStandings.length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Season */}
      <div className="card p-5">
        <h2 className="section-header">Season</h2>
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => setSeasonMode('existing')}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              seasonMode === 'existing' ? 'bg-gold text-navy border-gold' : 'bg-navy-light text-foreground-secondary border-navy-border'
            }`}
          >
            Existing Season
          </button>
          <button
            type="button"
            onClick={() => setSeasonMode('new')}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              seasonMode === 'new' ? 'bg-gold text-navy border-gold' : 'bg-navy-light text-foreground-secondary border-navy-border'
            }`}
          >
            Create New Season
          </button>
        </div>

        {seasonMode === 'existing' ? (
          <div>
            <label className="form-label">Select Season</label>
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="input-field max-w-sm"
            >
              <option value="">No season (standalone)</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Season Name</label>
              <input
                type="text"
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="e.g. Season 5"
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Base League Name</label>
              <input
                type="text"
                value={newSeasonLeague}
                onChange={(e) => setNewSeasonLeague(e.target.value)}
                placeholder="e.g. EFA Premier League"
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tournament Details */}
      <div className="card p-5">
        <h2 className="section-header">Tournament Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Type</label>
            <select
              value={type === 'custom' ? 'custom' : type}
              onChange={(e) => {
                const val = e.target.value
                setType(val as any)
                if (val !== 'custom') {
                  setCustomTypeName('')
                }
              }}
              className="input-field"
            >
              <option value="league">League (EFA Premier League)</option>
              <option value="ucl">UCL – Champions League</option>
              <option value="europa">Europa League</option>
              <option value="super_cup">Super Cup</option>
              <option value="custom">Other</option>
            </select>
          </div>

          {type === 'custom' && (
            <div>
              <label className="form-label">Competition Name</label>
              <input
                type="text"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                placeholder="e.g. World Cup"
                className="input-field"
                required
              />
            </div>
          )}

          <div className={type === 'custom' ? '' : 'md:col-span-1 lg:col-span-1'}>
            <label className="form-label">Tournament Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'custom' ? 'e.g. EFA World Cup 2026' : ''}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="form-label">End Date <span className="text-text-muted text-[10px]">(auto-calculated from slot capacity)</span></label>
            <input
              type="date"
              value={endDate}
              readOnly
              className="input-field opacity-50 cursor-not-allowed bg-bg-elevated"
              required
            />
          </div>
        </div>
      </div>

      {/* Format Settings */}
      {(type !== 'super_cup') && (
        <div className="card p-5">
          <h2 className="section-header">Format Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {type !== 'league' && (
              <>
                <div>
                  <label className="form-label">Number of Groups</label>
                  <input
                    type="number"
                    min="1"
                    value={numGroups}
                    onChange={(e) => setNumGroups(parseInt(e.target.value) || 1)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Teams per Group</label>
                  <input
                    type="number"
                    min="2"
                    value={teamsPerGroup}
                    onChange={(e) => setTeamsPerGroup(parseInt(e.target.value) || 2)}
                    className="input-field"
                  />
                </div>
              </>
            )}
            <div>
              <label className="form-label">Rounds (1=Single, 2=H&A)</label>
              <input
                type="number"
                min="1"
                max="4"
                value={numRounds}
                onChange={(e) => setNumRounds(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>
            {type !== 'league' && (
              <div>
                <label className="form-label">Qualifiers per Group</label>
                <input
                  type="number"
                  min="1"
                  value={qualifiersPerGroup}
                  onChange={(e) => setQualifiersPerGroup(parseInt(e.target.value) || 1)}
                  className="input-field"
                />
              </div>
            )}
          </div>
          {type !== 'league' && (
            <p className="mt-3 text-xs text-text-muted">
              Total teams required: <strong className="text-gold">{numGroups * teamsPerGroup}</strong>
            </p>
          )}
        </div>
      )}

      {/* Team Selection */}
      {type !== 'super_cup' && (
        <div className="card p-5">
          <h2 className="section-header">
            Teams
            <span className="ml-auto text-xs font-normal text-text-muted flex items-center gap-2">
              <ImportFromPollButton allTeams={allTeams} onSelect={setSelectedSlugs} />
              {selectedSlugs.length} selected
            </span>
          </h2>

          {isAutoPopulated && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4 text-sm text-blue-300">
              Auto-populated from <strong>{activeLeagueName}</strong> standings.
              {type === 'ucl' && ` Top ${UCL_SPOTS} teams.`}
              {type === 'europa' && ` Positions ${UCL_SPOTS + 1}–${UCL_SPOTS + EUROPA_SPOTS}.`}
            </div>
          )}

          <input
            type="text"
            placeholder="Search all clubs..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="input-field mb-4"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {filteredTeams.map((team) => {
              const isSelected = selectedSlugs.includes(team.logo_team_slug)
              const isTopTeam = type === 'ucl' && topTeamSlugs.includes(team.logo_team_slug)
              const isEuropaTeam = type === 'europa' && europaTeamSlugs.includes(team.logo_team_slug)
              return (
                <button
                  key={team.logo_team_slug}
                  type="button"
                  onClick={() => toggleTeam(team.logo_team_slug)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-foreground-primary'
                      : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-gold/20'
                  }`}
                >
                  {team.logo_league_folder ? (
                    <Image
                      src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                      alt={team.name}
                      width={24} height={24}
                      className="object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-navy-border shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">{team.name}</span>
                  {(isTopTeam || isEuropaTeam) && (
                    <span className="ml-auto text-gold text-xs shrink-0">?</span>
                  )}
                  {isSelected && !isTopTeam && !isEuropaTeam && (
                    <span className="ml-auto text-green-400 text-xs shrink-0">?</span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedSlugs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-border">
              <p className="text-xs text-text-muted mb-2">Selected Teams</p>
              <div className="flex flex-wrap gap-2">
                {selectedSlugs.map((slug) => {
                  const team = allTeams.find((t) => t.logo_team_slug === slug)
                  if (!team) return null
                  return (
                    <div key={slug} className="flex items-center gap-1.5 bg-gold/10 border border-gold/30 rounded-full pl-1.5 pr-2.5 py-0.5">
                      {team.logo_league_folder && (
                        <Image
                          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                          alt={team.name} width={18} height={18} className="object-contain"
                        />
                      )}
                      <span className="text-xs text-foreground-primary">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleTeam(slug)}
                        className="text-text-muted hover:text-foreground-primary text-xs ml-0.5"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {type === 'super_cup' && (
        <div className="card p-5">
          <h2 className="section-header">Super Cup Teams</h2>
          <p className="text-text-muted text-sm mb-4">Select exactly 2 teams for the Super Cup.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {allTeams.map((team) => {
              const isSelected = selectedSlugs.includes(team.logo_team_slug)
              return (
                <button
                  key={team.logo_team_slug}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      toggleTeam(team.logo_team_slug)
                    } else if (selectedSlugs.length < 2) {
                      toggleTeam(team.logo_team_slug)
                    }
                  }}
                  disabled={!isSelected && selectedSlugs.length >= 2}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-foreground-primary'
                      : selectedSlugs.length >= 2
                        ? 'bg-navy-light border-navy-border text-foreground-muted cursor-not-allowed'
                        : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-gold/20'
                  }`}
                >
                  {team.logo_league_folder ? (
                    <Image
                      src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                      alt={team.name} width={24} height={24} className="object-contain shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-navy-border shrink-0" />
                  )}
                  <span className="text-xs font-medium truncate">{team.name}</span>
                  {isSelected && <span className="ml-auto text-green-400 text-xs">?</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Manager Assignments */}
      {selectedSlugs.length > 0 && (
        <div className="card p-5">
          <h2 className="section-header">
            Manager Assignments
            <span className="ml-auto text-sm font-normal text-text-muted">Optional</span>
          </h2>
          <p className="text-text-muted text-xs mb-4">
            Assign managers to selected teams. Teams can compete without a manager.
          </p>
          <div className="space-y-1.5">
            {selectedSlugs.map((slug) => {
              const team = allTeams.find((t) => t.logo_team_slug === slug)
              if (!team) return null
              const resolvedManagerId = localManagers[slug] ?? team.manager_id
              const mgr = resolvedManagerId ? users.find((u) => u.id === resolvedManagerId) : null
              const isAssigning = assigningSlug === slug
              const assignErr = assignErrors[slug]

              return (
                <div key={slug} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-navy-light border border-navy-border">
                  {team.logo_league_folder && (
                    <Image
                      src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                      alt={team.name}
                      width={20}
                      height={20}
                      className="object-contain shrink-0"
                    />
                  )}
                  <span className="text-xs font-medium text-foreground-primary truncate flex-1 min-w-0">{team.name}</span>

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
                        onClick={() => setLocalManagers((prev) => { const n = { ...prev }; delete n[slug]; return n })}
                        className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <select
                      className="text-xs border border-navy-border rounded-md px-2 py-1 bg-bg-surface text-foreground-secondary max-w-[160px] shrink-0"
                      value=""
                      disabled={isAssigning}
                      onChange={async (e) => {
                        const userId = e.target.value
                        if (!userId) return
                        setAssigningSlug(slug)
                        setAssignErrors((prev) => { const n = { ...prev }; delete n[slug]; return n })
                        try {
                          // Note: This API might need updating to handle creating team if it doesn't exist yet, 
                          // but for now we'll assume it handles it or we'll update it next.
                          const res = await fetch('/api/admin/managers/assign', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              team_id: team.id, 
                              user_id: userId,
                              // Add these for potential team creation in the assign API
                              logo_league_folder: team.logo_league_folder,
                              logo_team_slug: team.logo_team_slug,
                              name: team.name
                            }),
                          })
                          const data = await res.json()
                          if (!res.ok) throw new Error(data.error ?? 'Failed to assign')
                          setLocalManagers((prev) => ({ ...prev, [slug]: userId }))
                        } catch (err: any) {
                          setAssignErrors((prev) => ({ ...prev, [slug]: err.message }))
                        } finally {
                          setAssigningSlug(null)
                        }
                      }}
                    >
                      <option value="">{isAssigning ? 'Assigning…' : '— assign manager —'}</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-4">
        <a href="/admin/tournaments" className="btn-outline">Cancel</a>
        <button
          type="submit"
          disabled={loading}
          className="btn-gold px-8 py-3 text-base font-bold disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Creating...
            </span>
          ) : (
            'Create Tournament & Generate Fixtures'
          )}
        </button>
      </div>
    </form>
  )
}

function ImportFromPollButton({ allTeams, onSelect }: { allTeams: Team[]; onSelect: (slugs: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [polls, setPolls] = useState<any[]>([])
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(0)

  async function loadPolls() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/polls')
      if (!res.ok) { setError(`API error: ${res.status}`); return }
      const data = await res.json()
      setPolls(data.polls ?? [])
      setApps(data.applications ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Failed to load polls')
    }
    setLoading(false)
  }

  function handleImport(pollId: string) {
    try {
      const pollApps = apps.filter((a: any) => a.poll_id === pollId && a.status !== 'withdrawn')
      console.log('[ImportFromPoll] pollApps:', pollApps.length, pollApps)
      const matched: string[] = []
      for (const app of pollApps) {
        const team = allTeams.find(
          (t) => t.logo_team_slug === app.team_slug && t.logo_league_folder === app.team_league
        )
        console.log(`[ImportFromPoll] app: "${app.team_slug}" / "${app.team_league}" -> ${team ? 'MATCH' : 'NO MATCH'}`)
        if (team) matched.push(team.logo_team_slug)
      }
      console.log('[ImportFromPoll] matched:', matched)
      if (matched.length > 0) {
        onSelect(matched)
        setDone(matched.length)
        setTimeout(() => setDone(0), 2500)
      } else {
        setError('No teams matched — the slug/league names differ from the logo database.')
      }
    } catch (e: any) {
      setError(e.message ?? 'Import failed')
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {done > 0 && <span className="text-[10px] text-green-400">{done} imported</span>}
        <button
          type="button"
          onClick={() => { setOpen(true); loadPolls() }}
          className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
        >
          Import from Poll
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-bg-surface border border-border rounded-2xl shadow-2xl p-6 animate-scale-in max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold text-foreground-primary mb-4">Import from Poll</h3>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}

            {loading ? (
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
      )}
    </>
  )
}

