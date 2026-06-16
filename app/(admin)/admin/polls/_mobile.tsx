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
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">Polls</h1>
            <p className="text-xs text-text-muted mt-0.5">Create polls for team selection applications</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary" className="text-sm min-h-[48px] px-5">
          + Create
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center">
          <p className="text-text-muted">Loading...</p>
        </Card>
      ) : polls.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-3xl">∅</p>
          <p className="text-base font-medium text-text-primary">No polls yet</p>
          <p className="text-xs text-text-muted">Create a poll to let users apply for teams.</p>
          <Button onClick={() => setShowCreate(true)} variant="primary">Create Poll</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {polls.map((poll: any) => {
            const creator = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
            const isOpen = poll.status === 'open'
            return (
              <Card key={poll.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-text-primary text-sm truncate">{poll.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${
                          isOpen
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-bg-base border-border text-text-muted'
                        }`}>
                          {isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      {poll.description && (
                        <p className="text-xs text-text-muted">{poll.description}</p>
                      )}
                      <p className="text-[10px] text-text-muted">
                        Share code: <code className="bg-bg-base px-1 rounded">{poll.share_code}</code>
                        {' · '}Created {new Date(poll.created_at).toLocaleDateString()}
                        {creator && ` · by ${creator.username}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => copyLink(poll.share_code)} className="text-sm flex-1 min-h-[48px]">
                      Copy Link
                    </Button>
                    {isOpen && (
                      <Button variant="destructive" onClick={() => handleClose(poll.id)} className="text-sm flex-1 min-h-[48px]">
                        Close
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-border pt-2">
                  <button
                    onClick={() => setExpandedPoll(expandedPoll === poll.id ? null : poll.id)}
                    className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors min-h-[48px] w-full"
                  >
                    <svg className={`w-3 h-3 transition-transform ${expandedPoll === poll.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    Applications ({applications.filter((a: any) => a.poll_id === poll.id).length})
                  </button>

                  {expandedPoll === poll.id && (
                    <div className="mt-2 space-y-1">
                      {applications.filter((a: any) => a.poll_id === poll.id).length === 0 ? (
                        <p className="text-xs text-text-muted py-2">No applications yet.</p>
                      ) : (
                        applications
                          .filter((a: any) => a.poll_id === poll.id)
                          .map((app: any) => (
                            <div key={app.id} className="flex items-center justify-between gap-2 px-3 py-3 rounded-lg bg-bg-base border border-border">
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-text-primary truncate">{app.team_name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-text-muted truncate">{app.team_league}</span>
                                  <span className="text-[10px] text-text-muted">{getApplicantName(app)}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                    app.status === 'pending'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : app.status === 'approved'
                                      ? 'bg-green-500/10 text-green-400'
                                      : 'bg-bg-base text-text-muted'
                                  }`}>
                                    {app.status}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteApplication(app.id)}
                                className="text-red-400 hover:text-red-300 transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
            <div className="px-4 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-text-primary font-bold text-lg">Create Poll</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary p-1 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-4 space-y-5">
              <div>
                <label className="text-sm font-semibold text-text-primary block mb-1">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Season 2 Team Selection" className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-text-primary min-h-[48px]" />
              </div>

              <div>
                <label className="text-sm font-semibold text-text-primary block mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for applicants..." className="w-full bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-text-primary" rows={3} />
              </div>

              <div>
                <label className="text-sm font-semibold text-text-primary block mb-2">Available Leagues</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {LEAGUE_OPTIONS.map((league: any) => {
                    const sel = selectedLeagues.includes(league.value)
                    const allSel = selectedLeagues.length === 0
                    return (
                      <label key={league.value} className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-sm cursor-pointer transition-colors min-h-[48px] ${
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
                  <p className="text-[10px] text-text-muted mt-1">All leagues selected by default</p>
                )}
                {selectedLeagues.length === 0 && allowInternational && (
                  <p className="text-[10px] text-green-400 mt-1">International / national teams only</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer min-h-[48px]">
                  <input type="checkbox" checked={allowInternational} onChange={(e) => { setAllowInternational(e.target.checked); if (e.target.checked) setSelectedLeagues([]) }} className="accent-accent" />
                  <span className="text-sm text-text-primary">Include international / national teams</span>
                </label>
              </div>
            </div>

            <div className="px-4 pb-6 pt-3 border-t border-border flex flex-col gap-3">
              <Button onClick={handleCreate} isLoading={creating} variant="primary" disabled={!title.trim()} className="w-full min-h-[52px] text-sm">
                Create Poll
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="w-full min-h-[52px] text-sm">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
