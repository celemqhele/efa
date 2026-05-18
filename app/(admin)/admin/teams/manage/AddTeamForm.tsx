'use client'

import { useState } from 'react'
import { getLeagueFolders, getLeagueDisplayName } from '@/lib/logo-resolver'

export default function AddTeamForm() {
  const [open, setOpen] = useState(false)
  const [leagueFolder, setLeagueFolder] = useState('')
  const [teamSlug, setTeamSlug] = useState('')
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const leagues = getLeagueFolders()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!leagueFolder || !teamSlug || !teamName) return setError('All fields required.')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/create-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName, logo_league_folder: leagueFolder, logo_team_slug: teamSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create team')
      setSuccess(true)
      setLeagueFolder('')
      setTeamSlug('')
      setTeamName('')
      setTimeout(() => { setSuccess(false); setOpen(false); window.location.reload() }, 1500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-header mb-0">Add Team</h2>
        <button onClick={() => setOpen(!open)} className="btn-gold text-sm">
          {open ? 'Cancel' : '+ Add Team'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">League</label>
            <select
              value={leagueFolder}
              onChange={(e) => setLeagueFolder(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select league...</option>
              {leagues.map((folder) => (
                <option key={folder} value={folder}>{getLeagueDisplayName(folder)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Arsenal"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="form-label">Team Slug</label>
            <input
              type="text"
              value={teamSlug}
              onChange={(e) => setTeamSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g. arsenal"
              className="input-field"
              required
            />
            <p className="text-slate-500 text-xs mt-1">Used for logo path lookup</p>
          </div>

          {error && (
            <div className="md:col-span-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="md:col-span-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
              Team created successfully!
            </div>
          )}

          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={loading} className="btn-gold">
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
