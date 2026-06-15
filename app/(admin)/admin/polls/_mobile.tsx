'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function getApplicantName(a: any): string {
  const a2 = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant
  return a2?.username ?? 'Unknown'
}

export default function Mobile({ data }: { data: any }) {
  const {
    polls, applications, loading, error, expandedPoll,
    showCreate, title, description, selectedLeagues, allowInternational, creating,
    LEAGUE_OPTIONS,
    setShowCreate, setTitle, setDescription, toggleLeague, setAllowInternational, setExpandedPoll, setSelectedLeagues,
    handleCreate, handleClose, handleDeleteApplication, copyLink,
  } = data

  return (
    <div className="space-y-space-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Polls</h1>
          <p className="text-text-muted text-xs mt-space-1">
            Create polls for team selection applications
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary" className="text-sm min-h-10">
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
        <Card className="p-space-8 text-center">
          <p className="text-3xl mb-space-3">∅</p>
          <p className="text-base font-medium text-text-primary mb-space-2">No polls yet</p>
          <p className="text-xs text-text-muted mb-space-5">
            Create a poll to let users apply for teams.
          </p>
          <Button onClick={() => setShowCreate(true)} variant="primary">
            Create Poll
          </Button>
        </Card>
      ) : (
        <div className="space-y-space-3">
          {polls.map((poll: any) => {
            const creator = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
            const isOpen = poll.status === 'open'
            return (
              <Card key={poll.id} className="p-space-3">
                <div className="space-y-space-2">
                  <div className="flex items-start justify-between gap-space-2">
                    <div className="space-y-space-1 min-w-0 flex-1">
                      <div className="flex items-center gap-space-2">
                        <h3 className="font-semibold text-text-primary text-sm truncate">{poll.title}</h3>
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
                  </div>
                  <div className="flex items-center gap-space-2">
                    <Button variant="secondary" onClick={() => copyLink(poll.share_code)} className="text-xs flex-1 min-h-10">
                      Copy Link
                    </Button>
                    {isOpen && (
                      <Button variant="destructive" onClick={() => handleClose(poll.id)} className="text-xs flex-1 min-h-10">
                        Close
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-space-3 border-t border-border pt-space-2">
                  <button
                    onClick={() => setExpandedPoll(expandedPoll === poll.id ? null : poll.id)}
                    className="flex items-center gap-space-2 text-xs text-text-muted hover:text-text-primary transition-colors min-h-10 w-full"
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedPoll === poll.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Applications ({applications.filter((a: any) => a.poll_id === poll.id).length})
                  </button>

                  {expandedPoll === poll.id && (
                    <div className="mt-space-2 space-y-space-1">
                      {applications.filter((a: any) => a.poll_id === poll.id).length === 0 ? (
                        <p className="text-xs text-text-muted py-space-2">No applications yet.</p>
                      ) : (
                        applications
                          .filter((a: any) => a.poll_id === poll.id)
                          .map((app: any) => (
                            <div key={app.id} className="flex items-center justify-between gap-space-2 px-space-3 py-space-2 rounded-lg bg-bg-elevated/50 border border-border">
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate">{app.team_name}</span>
                                <div className="flex items-center gap-space-2">
                                  <span className="text-[10px] text-text-muted truncate">{app.team_league}</span>
                                  <span className="text-[10px] text-text-muted">{getApplicantName(app)}</span>
                                  <span className={`text-[10px] px-space-1.5 py-0.5 rounded-full font-medium ${
                                    app.status === 'pending'
                                      ? 'bg-warning/10 text-warning'
                                      : app.status === 'approved'
                                      ? 'bg-feedback-success/10 text-feedback-success'
                                      : 'bg-bg-elevated text-text-muted'
                                  }`}>
                                    {app.status}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteApplication(app.id)}
                                className="text-feedback-error hover:text-feedback-error/80 transition-colors p-space-1"
                                title="Delete application"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
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
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col bg-bg-surface">
            <div className="px-space-4 py-space-4 border-b border-border flex items-center justify-between">
              <h2 className="text-text-primary font-bold text-lg">Create Poll</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary p-space-1">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-space-4 space-y-space-5">
              <div>
                <label className="form-label">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Season 2 Team Selection" className="input-field" />
              </div>

              <div>
                <label className="form-label">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for applicants..." className="input-field" rows={3} />
              </div>

              <div>
                <label className="form-label mb-space-2 block">Available Leagues</label>
                <div className="space-y-space-1 max-h-48 overflow-y-auto">
                  {LEAGUE_OPTIONS.map((league: any) => {
                    const sel = selectedLeagues.includes(league.value)
                    const allSel = selectedLeagues.length === 0
                    return (
                      <label key={league.value} className={`flex items-center gap-space-2 px-space-3 py-space-2 rounded-lg border text-sm cursor-pointer transition-colors min-h-11 ${
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
                <label className="flex items-center gap-space-2 cursor-pointer min-h-11">
                  <input type="checkbox" checked={allowInternational} onChange={(e) => { setAllowInternational(e.target.checked); if (e.target.checked) setSelectedLeagues([]) }} className="accent-accent" />
                  <span className="text-sm text-text-primary">Include international / national teams</span>
                </label>
              </div>
            </div>

            <div className="px-space-4 pb-space-6 pt-space-3 border-t border-border flex flex-col gap-space-3">
              <Button onClick={handleCreate} isLoading={creating} variant="primary" disabled={!title.trim()} className="w-full min-h-12">
                Create Poll
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="w-full min-h-12">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
