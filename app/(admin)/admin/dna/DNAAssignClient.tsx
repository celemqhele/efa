'use client'

import { useState } from 'react'

interface TeamInfo {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface ProfileInfo {
  label: string
  iconName: string
  color: string
}

interface DnaRow {
  id: string
  team_id: string
  primary_profile: string
  primary_level: string
  primary_score: number
  secondary_profile: string | null
  secondary_level: string | null
  secondary_score: number | null
  tertiary_profile: string | null
  tertiary_level: string | null
  tertiary_score: number | null
  notes: string | null
  updated_at: string | null
}

interface Props {
  teams: TeamInfo[]
  dnaMap: Record<string, DnaRow>
  profiles: ProfileInfo[]
}

const LEVELS = [
  { value: '+++', label: '+++ (Elite Mastery)' },
  { value: '++', label: '++ (Strong)' },
  { value: '+', label: '+ (Competent)' },
  { value: '-', label: '- (Developing)' },
]

export default function DNAAssignClient({ teams, dnaMap, profiles }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ teamId: string; text: string; ok: boolean } | null>(null)

  async function handleSave(teamId: string) {
    const form = document.getElementById(`dna-form-${teamId}`) as HTMLFormElement
    if (!form) return
    const data = new FormData(form)

    const primary = data.get('primary') as string
    const primaryLevel = data.get('primary_level') as string
    if (!primary) return

    const secondary = data.get('secondary') as string
    const tertiary = data.get('tertiary') as string

    const payload = {
      team_id: teamId,
      primary: {
        profile: primary,
        level: primaryLevel,
        score: primaryLevel === '+++' ? 0.9 : primaryLevel === '++' ? 0.7 : primaryLevel === '+' ? 0.5 : 0.3,
      },
      secondary: secondary ? {
        profile: secondary,
        level: data.get('secondary_level') as string,
        score: 0,
      } : null,
      tertiary: tertiary ? {
        profile: tertiary,
        level: data.get('tertiary_level') as string,
        score: 0,
      } : null,
    }

    setSaving(teamId)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/assign-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save')
      setMessage({ teamId, text: 'Saved', ok: true })
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage({ teamId, text: 'Error saving', ok: false })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground-primary">DNA Playstyle Assignment</h1>
        <span className="text-xs text-text-muted">{teams.length} teams</span>
      </div>

      {teams.length === 0 && (
        <p className="text-text-muted text-sm">No teams found.</p>
      )}

      <div className="grid gap-3">
        {teams.map((team) => {
          const existing = dnaMap[team.id]
          return (
            <form
              key={team.id}
              id={`dna-form-${team.id}`}
              onSubmit={(e) => { e.preventDefault(); handleSave(team.id) }}
              className="card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground-primary text-sm">{team.name}</h2>
                {message?.teamId === team.id && (
                  <span className={`text-xs font-semibold ${message.ok ? 'text-green-500' : 'text-red-500'}`}>
                    {message.text}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Primary */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Primary</label>
                  <select
                    name="primary"
                    defaultValue={existing?.primary_profile ?? ''}
                    className="w-full text-xs px-2 py-1.5 rounded bg-bg-surface border border-border text-foreground-primary"
                  >
                    <option value="">-- None --</option>
                    {profiles.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    name="primary_level"
                    defaultValue={existing?.primary_level ?? '++'}
                    className="w-full text-xs px-2 py-1 rounded bg-bg-surface border border-border text-foreground-primary mt-1"
                  >
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Secondary */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Secondary</label>
                  <select
                    name="secondary"
                    defaultValue={existing?.secondary_profile ?? ''}
                    className="w-full text-xs px-2 py-1.5 rounded bg-bg-surface border border-border text-foreground-primary"
                  >
                    <option value="">-- None --</option>
                    {profiles.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    name="secondary_level"
                    defaultValue={existing?.secondary_level ?? '-'}
                    className="w-full text-xs px-2 py-1 rounded bg-bg-surface border border-border text-foreground-primary mt-1"
                  >
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>

                {/* Tertiary */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Tertiary</label>
                  <select
                    name="tertiary"
                    defaultValue={existing?.tertiary_profile ?? ''}
                    className="w-full text-xs px-2 py-1.5 rounded bg-bg-surface border border-border text-foreground-primary"
                  >
                    <option value="">-- None --</option>
                    {profiles.map((p) => (
                      <option key={p.label} value={p.label}>{p.label}</option>
                    ))}
                  </select>
                  <select
                    name="tertiary_level"
                    defaultValue={existing?.tertiary_level ?? '-'}
                    className="w-full text-xs px-2 py-1 rounded bg-bg-surface border border-border text-foreground-primary mt-1"
                  >
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving === team.id}
                  className="btn-gold text-xs px-4 py-1.5 disabled:opacity-50"
                >
                  {saving === team.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )
        })}
      </div>
    </div>
  )
}
