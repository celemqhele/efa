'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getTeamLogo } from '@/lib/logo-resolver'

interface Season {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
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

  // Team selection
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [teamSearch, setTeamSearch] = useState('')

  // Auto-population for UCL / Europa
  const topTeamIds = leagueStandings.slice(0, UCL_SPOTS).map((s) => s.team_id)
  const europaTeamIds = leagueStandings.slice(UCL_SPOTS, UCL_SPOTS + EUROPA_SPOTS).map((s) => s.team_id)

  useEffect(() => {
    if (type !== 'custom') setName(TOURNAMENT_NAMES[type] ?? type)
    if (type === 'ucl') {
      setSelectedTeamIds(topTeamIds)
    } else if (type === 'europa') {
      setSelectedTeamIds(europaTeamIds)
    } else if (type === 'super_cup') {
      setSelectedTeamIds([])
    } else if (type === 'custom') {
      setSelectedTeamIds([])
      setName('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  // Submission
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    )
  }

  const filteredTeams = allTeams.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError('Tournament name is required.')
    if ((type === 'league' || type === 'custom') && selectedTeamIds.length < 2) return setError('Select at least 2 teams.')
    if (!startDate || !endDate) return setError('Start and end dates are required.')

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

      const resolvedType = type === 'custom' ? (customTypeName.trim() || 'custom') : type
      const res = await fetch('/api/admin/create-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId || null,
          name,
          type: resolvedType,
          start_date: startDate,
          end_date: endDate,
          team_ids: selectedTeamIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create tournament')

      // Redirect to fixture generation
      router.push(`/admin/fixtures/manage?tournament=${data.id}&generate=1`)
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
              seasonMode === 'existing' ? 'bg-gold text-navy border-gold' : 'bg-navy-light text-slate-700 border-navy-border'
            }`}
          >
            Existing Season
          </button>
          <button
            type="button"
            onClick={() => setSeasonMode('new')}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              seasonMode === 'new' ? 'bg-gold text-navy border-gold' : 'bg-navy-light text-slate-700 border-navy-border'
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
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="input-field"
            >
              <option value="league">League (EFA Premier League)</option>
              <option value="ucl">UCL – Champions League</option>
              <option value="europa">Europa League</option>
              <option value="super_cup">Super Cup</option>
              <option value="custom">Custom Competition</option>
            </select>
          </div>

          {type === 'custom' && (
            <div>
              <label className="form-label">Competition Type Slug</label>
              <input
                type="text"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g. world_cup, fa_cup"
                className="input-field"
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
            <label className="form-label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>
      </div>

      {/* Team Selection */}
      {type !== 'super_cup' && (
        <div className="card p-5">
          <h2 className="section-header">
            Teams
            <span className="ml-auto text-sm font-normal text-slate-400">
              {selectedTeamIds.length} selected
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
            placeholder="Search teams..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="input-field mb-4"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {filteredTeams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id)
              const isTopTeam = type === 'ucl' && topTeamIds.includes(team.id)
              const isEuropaTeam = type === 'europa' && europaTeamIds.includes(team.id)
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-slate-900'
                      : 'bg-navy-light border-navy-border text-slate-700 hover:border-gold/20'
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
                    <span className="ml-auto text-gold text-xs shrink-0">★</span>
                  )}
                  {isSelected && !isTopTeam && !isEuropaTeam && (
                    <span className="ml-auto text-green-400 text-xs shrink-0">✓</span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedTeamIds.length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-border">
              <p className="text-xs text-slate-400 mb-2">Selected Teams</p>
              <div className="flex flex-wrap gap-2">
                {selectedTeamIds.map((id) => {
                  const team = allTeams.find((t) => t.id === id)
                  if (!team) return null
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-gold/10 border border-gold/30 rounded-full pl-1.5 pr-2.5 py-0.5">
                      {team.logo_league_folder && (
                        <Image
                          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                          alt={team.name} width={18} height={18} className="object-contain"
                        />
                      )}
                      <span className="text-xs text-slate-900">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleTeam(id)}
                        className="text-slate-400 hover:text-slate-900 text-xs ml-0.5"
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
          <p className="text-slate-400 text-sm mb-4">Select exactly 2 teams for the Super Cup.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {allTeams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id)
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      toggleTeam(team.id)
                    } else if (selectedTeamIds.length < 2) {
                      toggleTeam(team.id)
                    }
                  }}
                  disabled={!isSelected && selectedTeamIds.length >= 2}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-slate-900'
                      : selectedTeamIds.length >= 2
                        ? 'bg-navy-light border-navy-border text-slate-600 cursor-not-allowed'
                        : 'bg-navy-light border-navy-border text-slate-700 hover:border-gold/20'
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
                  {isSelected && <span className="ml-auto text-green-400 text-xs">✓</span>}
                </button>
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
