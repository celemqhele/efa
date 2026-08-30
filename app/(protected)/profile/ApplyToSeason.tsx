'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import TeamLogo from '@/components/ui/TeamLogo'
import { Trophy } from 'lucide-react'

export type OpenSeason = {
  season_id: string
  season_name: string
  vacant_seats: number
}

export type PickableTeam = {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

type Props = {
  openSeasons: OpenSeason[]
  seasonPickable: Record<string, PickableTeam[]>
  pendingSeasonIds: string[]
  inSeasonIds: string[]
}

export default function ApplyToSeason({ openSeasons, seasonPickable, pendingSeasonIds, inSeasonIds }: Props) {
  const [seasonId, setSeasonId] = useState<string>(openSeasons[0]?.season_id ?? '')
  const [teamId, setTeamId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ title: string; body: string; type: 'success' | 'error' } | null>(null)

  const pickable = seasonId ? (seasonPickable[seasonId] ?? []) : []
  const activeSeason = openSeasons.find((s) => s.season_id === seasonId)
  const cooptsSeasonIds = pendingSeasonIds ?? []
  const isInSeason = inSeasonIds ?? []

  async function submit() {
    if (!seasonId || !teamId) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tournament-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: seasonId, team_id: teamId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ title: 'Application submitted', body: 'The admins will review it — you will be notified.', type: 'success' })
        setTeamId('')
      } else {
        setMessage({ title: 'Could not apply', body: data?.error ?? 'Something went wrong.', type: 'error' })
      }
    } catch {
      setMessage({ title: 'Could not apply', body: 'Network error — try again.', type: 'error' })
    }
    setBusy(false)
  }

  return (
    <Card className="p-space-5 space-y-space-4">
      <h2 className="section-header">
        <Trophy className="w-5 h-5 text-gold" /> Apply to a Tournament
      </h2>

      {openSeasons.length === 0 ? (
        <p className="text-sm text-text-muted">
          No seasons are currently accepting applications. Vacant seats open automatically when a manager leaves a team.
        </p>
      ) : (
        <>
          <div className="space-y-space-3">
            {openSeasons.map((season) => {
              if (isInSeason.includes(season.season_id)) return null
              return (
                <label
                  key={season.season_id}
                  className={`block p-space-4 rounded-xl border cursor-pointer transition-colors ${
                    seasonId === season.season_id ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="season"
                    className="sr-only"
                    checked={seasonId === season.season_id}
                    onChange={() => { setSeasonId(season.season_id); setTeamId('') }}
                  />
                  <div className="flex items-center justify-between gap-space-3">
                    <div className="font-semibold text-text-primary text-sm">{season.season_name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent/10 px-2 py-1 rounded-md shrink-0">
                      {season.vacant_seats} seat{season.vacant_seats === 1 ? '' : 's'} open
                    </div>
                  </div>
                  {cooptsSeasonIds.includes(season.season_id) && (
                    <div className="text-xs text-text-secondary mt-space-1">You have a pending application.</div>
                  )}
                </label>
              )
            })}
          </div>

          {activeSeason && !cooptsSeasonIds.includes(activeSeason.season_id) && !isInSeason.includes(activeSeason.season_id) && (
            <div className="space-y-space-3">
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent/50"
              >
                <option value="">Pick a club from the available leagues…</option>
                {pickable.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                {pickable.slice(0, 8).map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setTeamId(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
                      teamId === t.id ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    {t.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={t.logo_league_folder}
                        teamSlug={t.logo_team_slug}
                        context="standings_row"
                        alt={t.name}
                        className="w-4 h-4"
                      />
                    )}
                    {t.name}
                  </button>
                ))}
                {pickable.length > 8 && (
                  <span className="text-xs text-text-muted self-center">+{pickable.length - 8} more in the list</span>
                )}
              </div>

              <button
                onClick={submit}
                disabled={busy || !teamId}
                className="w-full text-sm font-bold bg-accent text-bg-base rounded-lg py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {busy ? 'Submitting…' : 'Apply for this seat'}
              </button>
            </div>
          )}

          {message && (
            <div className={`text-xs rounded-lg px-3 py-2 ${message.type === 'success' ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-400'}`}>
              <span className="font-bold">{message.title}.</span> {message.body}
            </div>
          )}
        </>
      )}
    </Card>
  )
}