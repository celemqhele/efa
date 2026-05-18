'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const TROPHY_TYPE_OPTIONS = [
  { value: 'league', label: '🏆 Premier League' },
  { value: 'ucl', label: '⭐ UCL' },
  { value: 'europa', label: '🌍 Europa League' },
  { value: 'super_cup', label: '🏅 Super Cup' },
]

const TROPHY_LABEL: Record<string, string> = {
  league: '🏆 League',
  ucl: '⭐ UCL',
  europa: '🌍 Europa',
  super_cup: '🏅 Super Cup',
}

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface Season {
  id: string
  name: string
}

interface Tournament {
  id: string
  name: string
  type: string
  season_id: string
}

interface Trophy {
  id: string
  trophy_type: string
  awarded_at: string
  team: Team
  season: Season
  tournament: { id: string; name: string } | null
}

interface Props {
  teams: Team[]
  seasons: Season[]
  tournaments: Tournament[]
  trophies: Trophy[]
}

export default function HallOfFameAdmin({ teams, seasons, tournaments, trophies: initialTrophies }: Props) {
  const supabase = createClient()

  const [trophies, setTrophies] = useState<Trophy[]>(initialTrophies)
  const [seasonId, setSeasonId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [trophyType, setTrophyType] = useState('league')
  const [tournamentId, setTournamentId] = useState('')
  const [awardedAt, setAwardedAt] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const tournamentsForSeason = tournaments.filter((t) => t.season_id === seasonId)

  async function handleAdd() {
    if (!seasonId || !teamId || !trophyType) {
      setError('Season, team, and trophy type are required.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')

    const { data, error: e } = await supabase
      .from('trophies')
      .insert({
        season_id: seasonId,
        team_id: teamId,
        trophy_type: trophyType as 'league' | 'ucl' | 'europa' | 'super_cup',
        tournament_id: tournamentId || undefined,
        awarded_at: awardedAt,
      })
      .select(`
        id, trophy_type, awarded_at,
        team:teams(id, name, logo_league_folder, logo_team_slug),
        season:seasons(id, name),
        tournament:tournaments(id, name)
      `)
      .single()

    setSaving(false)

    if (e || !data) {
      setError(e?.message ?? 'Failed to save.')
      return
    }

    setTrophies((prev) => [data as unknown as Trophy, ...prev])
    setSuccess(`Trophy added for ${teams.find((t) => t.id === teamId)?.name}.`)
    setTeamId('')
    setTournamentId('')
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error: e } = await supabase.from('trophies').delete().eq('id', id)
    setDeleting(null)
    if (e) { setError(e.message); return }
    setTrophies((prev) => prev.filter((t) => t.id !== id))
  }

  // Group existing trophies by season
  const bySeasonMap: Record<string, Trophy[]> = {}
  for (const t of trophies) {
    const key = t.season?.name ?? 'Unknown'
    if (!bySeasonMap[key]) bySeasonMap[key] = []
    bySeasonMap[key].push(t)
  }
  const bySeason = Object.entries(bySeasonMap).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="space-y-8">
      {/* Add trophy form */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-bold text-white">Award a Trophy</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Season</label>
            <select
              className="input-field"
              value={seasonId}
              onChange={(e) => { setSeasonId(e.target.value); setTournamentId('') }}
            >
              <option value="">Select season…</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Trophy Type</label>
            <select
              className="input-field"
              value={trophyType}
              onChange={(e) => setTrophyType(e.target.value)}
            >
              {TROPHY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Winning Team</label>
            <select
              className="input-field"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Tournament (optional)</label>
            <select
              className="input-field"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              disabled={!seasonId}
            >
              <option value="">None / not linked</option>
              {tournamentsForSeason.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Award Date</label>
            <input
              type="date"
              className="input-field"
              value={awardedAt}
              onChange={(e) => setAwardedAt(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{success}</p>
        )}

        <button
          onClick={handleAdd}
          disabled={saving || !seasonId || !teamId}
          className="btn-gold disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Award Trophy'}
        </button>
      </div>

      {/* Existing trophies */}
      <div>
        <h2 className="section-header">Existing Trophies</h2>

        {bySeason.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">No trophies recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {bySeason.map(([seasonName, entries]) => (
              <div key={seasonName} className="card overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-[#c9a84c]/10 to-transparent border-b border-navy-border">
                  <h3 className="font-bold text-white">{seasonName}</h3>
                </div>
                <div className="divide-y divide-navy-border/40">
                  {entries.map((trophy) => (
                    <div
                      key={trophy.id}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      {trophy.team?.logo_league_folder && (
                        <Image
                          src={`/logos/${trophy.team.logo_league_folder}/128x128/${trophy.team.logo_team_slug}.png`}
                          alt={trophy.team.name}
                          width={36}
                          height={36}
                          className="object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{trophy.team?.name}</p>
                        <p className="text-xs text-slate-500">
                          {TROPHY_LABEL[trophy.trophy_type] ?? trophy.trophy_type}
                          {trophy.tournament && ` · ${trophy.tournament.name}`}
                          {' · '}{trophy.awarded_at?.slice(0, 10)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(trophy.id)}
                        disabled={deleting === trophy.id}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 px-3 py-1 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                      >
                        {deleting === trophy.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
