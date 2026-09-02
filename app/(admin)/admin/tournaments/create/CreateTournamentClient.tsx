'use client'

// File encoding: UTF-8
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TeamLogo from '@/components/ui/TeamLogo'
import { Loader2, CheckCircle } from 'lucide-react'
import ModalPortal from '@/components/ui/ModalPortal'

interface Season {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

interface UserWithClub {
  id: string
  username: string
  club: {
    id: string
    name: string
    logo_league_folder: string
    logo_team_slug: string
  }
}

interface Props {
  seasons: Season[]
  users: UserWithClub[]
}

const TOURNAMENT_NAMES: Record<string, string> = {
  league: 'EFA Premier League',
  tournament_club: 'EFA Tournaments Cup',
  tournament_international: 'EFA International Cup',
  friendlies: '',
}

const FIXTURE_MODE: Record<string, string> = {
  league: 'round_robin',
  tournament_club: 'groups',
  tournament_international: 'groups',
  friendlies: 'exhibition',
}

export default function CreateTournamentClient({ seasons, users }: Props) {
  const router = useRouter()

  // Season
  const [seasonMode, setSeasonMode] = useState<'existing' | 'new'>('existing')
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    seasons.find((s) => s.status === 'active')?.id ?? seasons[0]?.id ?? ''
  )
  const [newSeasonName, setNewSeasonName] = useState('')
  const [newSeasonLeague, setNewSeasonLeague] = useState('')

  // Tournament
  const [type, setType] = useState<'league' | 'tournament_club' | 'tournament_international' | 'friendlies'>('league')
  const [name, setName] = useState(TOURNAMENT_NAMES.league)

  // Participant selection — user-owned slots (each user's current club)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [successId, setSuccessId] = useState<string | null>(null)

  const isFriendlies = type === 'friendlies'

  function switchType(next: typeof type) {
    setType(next)
    setName(TOURNAMENT_NAMES[next] ?? next)
    setSelectedUserIds([])
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase()
    if (!q) return true
    return (
      u.username.toLowerCase().includes(q) ||
      u.club.name.toLowerCase().includes(q) ||
      u.club.logo_team_slug.toLowerCase().includes(q)
    )
  })

  // Submission
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((s) => s !== userId) : [...prev, userId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) return setError('Tournament name is required.')
    if (selectedUserIds.length < 2) return setError('Select at least 2 participants (managers).')
    if (isFriendlies && selectedUserIds.length > 2) return setError('Friendlies can only have 2 participants.')

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

      const res = await fetch('/api/admin/create-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId || null,
          name,
          type,
          users: selectedUserIds,
          settings: {
            fixture_mode: FIXTURE_MODE[type] ?? 'round_robin'
          }
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create tournament')

      setSuccessId(data.tournament_id)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Type</label>
            <select
              value={type}
              onChange={(e) => switchType(e.target.value as any)}
              className="input-field"
            >
              <option value="league">League</option>
              <option value="tournament_club">Tournament (Clubs)</option>
              <option value="tournament_international">Tournament (International)</option>
              <option value="friendlies">Friendly</option>
            </select>
          </div>

          <div>
            <label className="form-label">Tournament Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>
        <p className="text-text-muted text-xs mt-3">
          Participants are manager-owned seats — each selected manager brings their
          current club into the tournament.
        </p>
      </div>

      {!isFriendlies && (
      <div className="card p-5">
        <h2 className="section-header">
          Participants
          <span className="ml-auto text-xs font-normal text-text-muted flex items-center gap-2">
            {!isFriendlies && <ImportFromPollButton users={users} onSelect={setSelectedUserIds} />}
            {selectedUserIds.length} selected
          </span>
        </h2>

          <input
            type="text"
            placeholder="Search managers or clubs..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="input-field mb-4"
          />

          {filteredUsers.length === 0 ? (
            <p className="text-text-muted text-sm py-6 text-center">
              No managers with a club found yet. Managers are added when they join a team.
            </p>
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            {filteredUsers.map((user) => {
              const isSelected = selectedUserIds.includes(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-foreground-primary'
                      : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-gold/20'
                  }`}
                >
                  <TeamLogo
                    leagueFolder={user.club.logo_league_folder}
                    teamSlug={user.club.logo_team_slug}
                    context="standings_row"
                    alt={user.club.name}
                    className="w-6 h-6 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium truncate">
                      <span className="text-foreground-primary">{user.username}</span>
                    </span>
                    <span className="block text-[10px] text-text-muted truncate">{user.club.name}</span>
                  </span>
                  {isSelected && (
                    <span className="ml-auto text-green-400 text-xs shrink-0">✓</span>
                  )}
                </button>
              )
            })}
          </div>
          )}

          {selectedUserIds.length > 0 && (
            <div className="mt-4 pt-4 border-t border-navy-border">
              <p className="text-xs text-text-muted mb-2">Selected Participants</p>
              <div className="flex flex-wrap gap-2">
                {selectedUserIds.map((uid) => {
                  const user = users.find((u) => u.id === uid)
                  if (!user) return null
                  return (
                    <div key={uid} className="flex items-center gap-1.5 bg-gold/10 border border-gold/30 rounded-full pl-1.5 pr-2.5 py-0.5">
                      <TeamLogo
                        leagueFolder={user.club.logo_league_folder}
                        teamSlug={user.club.logo_team_slug}
                        context="standings_row"
                        alt={user.club.name}
                        className="w-[18px] h-[18px]"
                      />
                      <span className="text-xs text-foreground-primary">{user.club.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleUser(user.id)}
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

      {isFriendlies && (
        <div className="card p-5">
          <h2 className="section-header">Choose Participants</h2>
          <p className="text-text-muted text-sm mb-4">Select exactly 2 managers for the friendly.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {users.map((user) => {
              const isSelected = selectedUserIds.includes(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      toggleUser(user.id)
                    } else if (selectedUserIds.length < 2) {
                      toggleUser(user.id)
                    }
                  }}
                  disabled={!isSelected && selectedUserIds.length >= 2}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'bg-gold/10 border-gold/40 text-foreground-primary'
                      : selectedUserIds.length >= 2
                        ? 'bg-navy-light border-navy-border text-foreground-muted cursor-not-allowed'
                        : 'bg-navy-light border-navy-border text-foreground-secondary hover:border-gold/20'
                  }`}
                >
                  <TeamLogo
                    leagueFolder={user.club.logo_league_folder}
                    teamSlug={user.club.logo_team_slug}
                    context="standings_row"
                    alt={user.club.name}
                    className="w-6 h-6 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium truncate text-foreground-primary">{user.username}</span>
                    <span className="block text-[10px] text-text-muted truncate">{user.club.name}</span>
                  </span>
                  {isSelected && <span className="ml-auto text-green-400 text-xs shrink-0">✓</span>}
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
        <Link href="/admin/tournaments" className="btn-outline">Cancel</Link>
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
            'Create Tournament'
          )}
        </button>
      </div>
    </form>

      {successId && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10 w-full max-w-sm bg-bg-surface border border-border rounded-2xl shadow-2xl p-8 animate-scale-in text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <h3 className="text-xl font-bold text-foreground-primary">Tournament Created</h3>
              <p className="text-sm text-text-muted">The tournament has been created successfully.</p>
              <button
                onClick={() => { setSuccessId(null); router.push('/admin/tournaments') }}
                className="btn-gold px-6 py-2.5 text-sm font-bold"
              >
                Manage Tournaments
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  )
}

function ImportFromPollButton({ users, onSelect }: { users: UserWithClub[]; onSelect: (userIds: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [polls, setPolls] = useState<any[]>([])
  const [apps, setApps] = useState<any[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [done, setDone] = useState(0)

  const userByApplicantId = new Map<string, UserWithClub>(users.map((u) => [u.id, u]))

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
        const user = app.applicant_id ? userByApplicantId.get(app.applicant_id) : null
        if (user) matched.push(user.id)
      }
      if (matched.length > 0) {
        onSelect(matched)
        setDone(matched.length)
        setTimeout(() => setDone(0), 2500)
      } else {
        setImportError('No poll applicants currently manage a club.')
      }
    } catch (e: any) {
      setImportError(e.message ?? 'Import failed')
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