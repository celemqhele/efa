'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'

interface Poll {
  id: string
  title: string
  description: string | null
  status: string
  share_code: string
  created_at: string
  created_by: { username: string } | { username: string }[]
}

interface Application {
  id: string
  poll_id: string
  applicant_id: string
  team_name: string
  team_slug: string
  team_league: string
  status: string
  created_at: string
  applicant: { username: string } | { username: string }[]
}

export default function AdminPollsPage() {
  const supabase = createClient()
  const [polls, setPolls] = useState<Poll[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([])
  const [allowInternational, setAllowInternational] = useState(false)
  const [creating, setCreating] = useState(false)

  const LEAGUE_OPTIONS = [
    { value: 'english-premier-league-2025-2026.football-logos.cc', label: 'Premier League' },
    { value: 'england-efl-championship-2025-2026.football-logos.cc', label: 'Championship' },
    { value: 'spain-la-liga-2025-2026.football-logos.cc', label: 'La Liga' },
    { value: 'spain-la-liga-2-2025-2026.football-logos.cc', label: 'La Liga 2' },
    { value: 'germany-bundesliga-2025-2026.football-logos.cc', label: 'Bundesliga' },
    { value: 'germany-2-bundesliga-2025-2026.football-logos.cc', label: '2. Bundesliga' },
    { value: 'italy-serie-a-2025-2026.football-logos.cc', label: 'Serie A' },
    { value: 'italy-serie-b-2025-2026.football-logos.cc', label: 'Serie B' },
    { value: 'france-ligue-1-2025-2026.football-logos.cc', label: 'Ligue 1' },
    { value: 'france-ligue-2-2025-2026.football-logos.cc', label: 'Ligue 2' },
    { value: 'netherlands-eredivisie-2025-2026.football-logos.cc', label: 'Eredivisie' },
    { value: 'portugal-primeira-liga-2025-2026.football-logos.cc', label: 'Primeira Liga' },
    { value: 'scotland-premiership-2025-2026.football-logos.cc', label: 'Premiership' },
    { value: 'romania-liga-1-2025-2026.football-logos.cc', label: 'Liga 1' },
    { value: 'argentina-primera-division-2025-2026.football-logos.cc', label: 'Primera División' },
    { value: 'brazil-serie-a-2025-2026.football-logos.cc', label: 'Série A' },
    { value: 'brazil-serie-b-2025-2026.football-logos.cc', label: 'Série B' },
    { value: 'saudi-arabia-pro-league-2025-2026.football-logos.cc', label: 'Saudi Pro League' },
  ]

  function getApplicantName(a: Application): string {
    const a2 = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant
    return a2?.username ?? 'Unknown'
  }

  const loadPolls = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const res = await fetch('/api/admin/polls')
    const data = await res.json()
    if (res.ok) {
      setPolls(data.polls ?? [])
      setApplications(data.applications ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadPolls() }, [loadPolls])

  function toggleLeague(value: string) {
    setSelectedLeagues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleCreate() {
    if (!title.trim()) return
    setCreating(true)
    setError('')

    const res = await fetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        allowed_leagues: selectedLeagues.length > 0 ? selectedLeagues : [],
        allowed_international: allowInternational,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create poll')
      setCreating(false)
      return
    }

    setShowCreate(false)
    setTitle('')
    setDescription('')
    setSelectedLeagues([])
    setAllowInternational(false)
    setCreating(false)
    loadPolls()
  }

  async function handleClose(pollId: string) {
    const res = await fetch(`/api/admin/polls/${pollId}/close`, { method: 'POST' })
    if (res.ok) loadPolls()
  }

  async function handleDeleteApplication(appId: string) {
    const res = await fetch(`/api/admin/polls/applications/${appId}`, { method: 'DELETE' })
    if (res.ok) loadPolls()
  }

  async function copyLink(shareCode: string) {
    const url = `${window.location.origin}/polls/${shareCode}`
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="space-y-space-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Polls</h1>
          <p className="text-text-muted text-sm mt-space-1">
            Create polls for team selection applications
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary" className="self-start sm:self-auto">
          + Create Poll
        </Button>
      </div>

      {error && (
        <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-space-3 text-feedback-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-space-12 text-center">
          <p className="text-text-muted">Loading...</p>
        </Card>
      ) : polls.length === 0 ? (
        <Card className="p-space-12 text-center">
          <p className="text-4xl mb-space-4">∅</p>
          <p className="text-lg font-medium text-text-primary mb-space-2">No polls yet</p>
          <p className="text-sm text-text-muted mb-space-6">
            Create a poll to let users apply for teams.
          </p>
          <Button onClick={() => setShowCreate(true)} variant="primary">
            Create Poll
          </Button>
        </Card>
      ) : (
        <div className="grid gap-space-4">
          {polls.map((poll) => {
            const creator = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
            const isOpen = poll.status === 'open'
            return (
              <Card key={poll.id} className="p-space-4 sm:p-space-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-space-3">
                  <div className="space-y-space-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-space-3">
                      <h3 className="font-semibold text-text-primary text-sm sm:text-base">{poll.title}</h3>
                      <span className={`text-[10px] px-space-1.5 py-space-0.5 rounded-full border font-medium shrink-0 ${
                        isOpen
                          ? 'bg-feedback-success/10 border-feedback-success/30 text-feedback-success'
                          : 'bg-bg-elevated border-border text-text-muted'
                      }`}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    {poll.description && (
                      <p className="text-xs text-text-muted">{poll.description}</p>
                    )}
                    <p className="text-[10px] text-text-muted">
                      Share code: <code className="bg-bg-base px-space-1 rounded">{poll.share_code}</code>
                      {' · '}Created {new Date(poll.created_at).toLocaleDateString()}
                      {creator && ` · by ${creator.username}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-space-2 shrink-0 self-stretch sm:self-auto">
                    <Button variant="secondary" onClick={() => copyLink(poll.share_code)} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                      Copy Link
                    </Button>
                    {isOpen && (
                      <Button variant="destructive" onClick={() => handleClose(poll.id)} className="flex-1 sm:flex-initial text-xs sm:text-sm">
                        Close
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-space-4 border-t border-border pt-space-3">
                  <button
                    onClick={() => setExpandedPoll(expandedPoll === poll.id ? null : poll.id)}
                    className="flex items-center gap-space-2 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedPoll === poll.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Applications ({applications.filter((a) => a.poll_id === poll.id).length})
                  </button>

                  {expandedPoll === poll.id && (
                    <div className="mt-space-2 space-y-space-1">
                      {applications.filter((a) => a.poll_id === poll.id).length === 0 ? (
                        <p className="text-xs text-text-muted py-space-2">No applications yet.</p>
                      ) : (
                        applications
                          .filter((a) => a.poll_id === poll.id)
                          .map((app) => (
                            <div key={app.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-2 px-space-3 py-space-2 rounded-lg bg-bg-elevated/50 border border-border">
                              <div className="flex items-center gap-space-2 min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate">{app.team_name}</span>
                                <span className="text-[10px] text-text-muted truncate hidden sm:inline">{app.team_league}</span>
                              </div>
                              <div className="flex items-center gap-space-2 shrink-0">
                                <span className="text-[10px] text-text-muted truncate sm:hidden max-w-[120px]">{app.team_league}</span>
                                <span className="text-xs text-text-muted">{getApplicantName(app)}</span>
                                <span className={`text-xs px-space-2 py-space-1 rounded-full font-medium ${
                                  app.status === 'pending'
                                    ? 'bg-warning/10 text-warning'
                                    : app.status === 'approved'
                                    ? 'bg-feedback-success/10 text-feedback-success'
                                    : 'bg-bg-elevated text-text-muted'
                                }`}>
                                  {app.status}
                                </span>
                                <button
                                  onClick={() => handleDeleteApplication(app.id)}
                                  className="text-[10px] text-feedback-error hover:text-feedback-error/80 transition-colors"
                                  title="Delete application"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-0 sm:p-space-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-bg-surface border-0 sm:border border-border rounded-none sm:rounded-2xl overflow-hidden min-h-screen sm:min-h-0 my-0 sm:my-space-8">
            <div className="px-space-4 sm:px-space-6 py-space-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-text-primary font-bold text-lg">Create Poll</h2>
                <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary sm:hidden p-space-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-space-4 sm:p-space-6 space-y-space-5">
              <div>
                <label className="form-label">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Season 2 Team Selection" className="input-field" />
              </div>

              <div>
                <label className="form-label">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for applicants..." className="input-field" rows={3} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-space-2">
                  <label className="form-label mb-0">Available Leagues</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-1.5 max-h-48 overflow-y-auto pr-space-1">
                  {LEAGUE_OPTIONS.map((league) => {
                    const sel = selectedLeagues.includes(league.value)
                    const allSel = selectedLeagues.length === 0
                    return (
                      <label key={league.value} className={`flex items-center gap-space-2 px-space-2 py-space-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        sel || allSel
                          ? 'border-accent bg-accent/5 text-text-primary'
                          : 'border-border text-text-muted hover:border-accent/30'
                      }`}>
                        <input type="checkbox" checked={sel || allSel} onChange={() => toggleLeague(league.value)} className="accent-accent" />
                        {league.label}
                      </label>
                    )
                  })}
                </div>
                {selectedLeagues.length === 0 && !allowInternational && (
                  <p className="text-[10px] text-text-muted mt-space-1">All leagues selected by default</p>
                )}
                {selectedLeagues.length === 0 && allowInternational && (
                  <p className="text-[10px] text-feedback-success mt-space-1">International / national teams only</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-space-2 cursor-pointer">
                  <input type="checkbox" checked={allowInternational} onChange={(e) => { setAllowInternational(e.target.checked); if (e.target.checked) setSelectedLeagues([]) }} className="accent-accent" />
                  <span className="text-sm text-text-primary">Include international / national teams</span>
                </label>
              </div>
            </div>

            <div className="px-space-4 sm:px-space-6 pb-space-4 sm:pb-space-6 flex flex-col-reverse sm:flex-row sm:justify-between gap-space-3">
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleCreate} isLoading={creating} variant="primary" disabled={!title.trim()} className="w-full sm:w-auto">
                Create Poll
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
