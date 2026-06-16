'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function getApplicantName(a: any): string {
  const a2 = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant
  return a2?.username ?? 'Unknown'
}

export default function Desktop({ data }: { data: any }) {
  const {
    polls, applications, loading, error, expandedPoll,
    showCreate, title, description, selectedLeagues, allowInternational, creating,
    LEAGUE_OPTIONS,
    setShowCreate, setTitle, setDescription, toggleLeague, setAllowInternational, setExpandedPoll, setSelectedLeagues,
    handleCreate, handleClose, handleDeleteApplication, copyLink,
  } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Polls</h1>
          <p className="text-sm text-text-muted mt-1">Create polls for team selection applications</p>
        </div>
        <Button onClick={() => setShowCreate(true)} variant="primary" className="text-sm px-5 py-2.5">
          + Create Poll
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
        <Card className="p-12 text-center space-y-4">
          <p className="text-4xl">∅</p>
          <p className="text-lg font-medium text-text-primary">No polls yet</p>
          <p className="text-sm text-text-muted">Create a poll to let users apply for teams.</p>
          <Button onClick={() => setShowCreate(true)} variant="primary">Create Poll</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((poll: any) => {
            const creator = Array.isArray(poll.created_by) ? poll.created_by[0] : poll.created_by
            const isOpen = poll.status === 'open'
            const pollApplications = applications.filter((a: any) => a.poll_id === poll.id)
            return (
              <Card key={poll.id} className="overflow-hidden">
                <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-text-primary text-base">{poll.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        isOpen
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : 'bg-bg-base border-border text-text-muted'
                      }`}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                      <span className="text-xs text-text-muted">{pollApplications.length} applications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => copyLink(poll.share_code)} className="text-sm">
                        Copy Link
                      </Button>
                      {isOpen && (
                        <Button variant="destructive" onClick={() => handleClose(poll.id)} className="text-sm">
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                  {poll.description && (
                    <p className="text-sm text-text-muted mt-1">{poll.description}</p>
                  )}
                  <p className="text-xs text-text-muted mt-1">
                    Share code: <code className="bg-bg-base px-1 rounded">{poll.share_code}</code>
                    {' · '}Created {new Date(poll.created_at).toLocaleDateString()}
                    {creator && ` · by ${creator.username}`}
                  </p>
                </div>

                {pollApplications.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-bg-base border-b-2 border-accent/20">
                          <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Team</th>
                          <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">League</th>
                          <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Applicant</th>
                          <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Status</th>
                          <th className="text-right text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pollApplications.map((app: any) => (
                          <tr key={app.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                            <td className="px-5 py-4 font-medium text-text-primary">{app.team_name}</td>
                            <td className="px-5 py-4 text-text-muted text-xs">{app.team_league}</td>
                            <td className="px-5 py-4 text-text-muted text-xs">{getApplicantName(app)}</td>
                            <td className="px-5 py-4 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                app.status === 'pending'
                                  ? 'bg-yellow-500/10 text-yellow-400'
                                  : app.status === 'approved'
                                  ? 'bg-green-500/10 text-green-400'
                                  : 'bg-bg-base text-text-muted'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                onClick={() => handleDeleteApplication(app.id)}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                                title="Delete application"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pollApplications.length === 0 && (
                  <div className="p-5 text-sm text-text-muted">No applications yet.</div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-lg bg-bg-surface border border-border rounded-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-text-primary font-bold text-lg">Create Poll</h2>
                <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-text-primary block mb-1">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Season 2 Team Selection" className="w-full bg-bg-base border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary" />
              </div>

              <div>
                <label className="text-sm font-semibold text-text-primary block mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for applicants..." className="w-full bg-bg-base border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary" rows={3} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-text-primary">Available Leagues</label>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {LEAGUE_OPTIONS.map((league: any) => {
                    const sel = selectedLeagues.includes(league.value)
                    const allSel = selectedLeagues.length === 0
                    return (
                      <label key={league.value} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={allowInternational} onChange={(e) => { setAllowInternational(e.target.checked); if (e.target.checked) setSelectedLeagues([]) }} className="accent-accent" />
                  <span className="text-sm text-text-primary">Include international / national teams</span>
                </label>
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setShowCreate(false)} className="text-sm">Cancel</Button>
              <Button onClick={handleCreate} isLoading={creating} variant="primary" disabled={!title.trim()} className="text-sm">
                Create Poll
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
