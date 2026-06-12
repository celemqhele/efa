'use client'

import { useState } from 'react'
import DNABadge from '@/components/ui/DNABadge'
import type { DNAProfile } from '@/lib/dna-engine'

interface TeamInfo {
  id: string
  name: string
}

interface Props {
  teams: TeamInfo[]
  dnaMap: Record<string, any>
}

export default function DNAProfilesView({ teams, dnaMap }: Props) {
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { team: string; profiles: DNAProfile[]; gamesAnalyzed: number; error?: string }>>({})

  async function handleAnalyze(teamId: string, teamName: string) {
    setAnalyzing(teamId)
    try {
      const res = await fetch(`/api/admin/analyze-team-dna?team_id=${teamId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResults(prev => ({
        ...prev,
        [teamId]: {
          team: data.team,
          profiles: data.profiles,
          gamesAnalyzed: data.gamesAnalyzed,
        },
      }))
    } catch (err: any) {
      setResults(prev => ({
        ...prev,
        [teamId]: { team: teamName, profiles: [], gamesAnalyzed: 0, error: err.message },
      }))
    } finally {
      setAnalyzing(null)
    }
  }

  function buildProfilesFromRow(row: any): DNAProfile[] {
    if (!row?.primary_profile) return []
    const profiles: DNAProfile[] = [{
      label: row.primary_profile,
      iconName: '',
      color: '',
      level: row.primary_level ?? '-',
      score: row.primary_score ?? 0,
    }]
    if (row.secondary_profile) {
      profiles.push({
        label: row.secondary_profile,
        iconName: '',
        color: '',
        level: row.secondary_level ?? '-',
        score: row.secondary_score ?? 0,
      })
    }
    if (row.tertiary_profile) {
      profiles.push({
        label: row.tertiary_profile,
        iconName: '',
        color: '',
        level: row.tertiary_level ?? '-',
        score: row.tertiary_score ?? 0,
      })
    }
    return profiles
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground-primary">Team DNA Profiles</h1>
          <p className="text-sm text-text-muted mt-1">
            {teams.length} teams &middot; Click &quot;Analyze&quot; to let AI review match stats and suggest playstyle DNA
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {teams.map((team) => {
          const existing = dnaMap[team.id]
          const currentProfiles = buildProfilesFromRow(existing)
          const analysis = results[team.id]

          return (
            <div key={team.id} className="card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-foreground-primary text-sm truncate">{team.name}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentProfiles.length > 0 ? (
                      currentProfiles.map((p, i) => (
                        <DNABadge key={i} {...p} isOwnTeam={false} />
                      ))
                    ) : (
                      <span className="text-xs text-text-muted italic">No DNA assigned</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleAnalyze(team.id, team.name)}
                  disabled={analyzing === team.id}
                  className="btn-outline text-xs px-3 py-1.5 shrink-0 disabled:opacity-50"
                >
                  {analyzing === team.id ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {analysis && (
                <div className="mt-3 pt-3 border-t border-border">
                  {analysis.error ? (
                    <p className="text-xs text-red-400">{analysis.error}</p>
                  ) : analysis.profiles.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">
                        AI Analysis ({analysis.gamesAnalyzed} games): Click &quot;Apply&quot; to save this recommendation.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.profiles.map((p, i) => (
                          <DNABadge key={i} {...p} isOwnTeam={false} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {analysis.gamesAnalyzed === 0 ? 'No data' : 'Insufficient data'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {teams.length === 0 && (
        <div className="card p-12 text-center text-text-muted">
          <p className="text-lg font-medium text-foreground-primary mb-2">No teams</p>
          <p className="text-sm">Teams will appear here once they are created.</p>
        </div>
      )}
    </div>
  )
}
