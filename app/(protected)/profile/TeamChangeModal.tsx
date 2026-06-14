'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '@/components/ui/BottomSheet'

interface Team {
  id: string
  name: string
  logo_league_folder: string
  logo_team_slug: string
}

interface Props {
  currentTeamId: string | null
  hasPendingRequest: boolean
  pendingRequestedTeamName?: string | null
}

export default function TeamChangeModal({
  currentTeamId,
  hasPendingRequest,
  pendingRequestedTeamName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('teams')
        .select('id, name, logo_league_folder, logo_team_slug')
        .is('manager_id', null)
        .ilike('name', `%${q}%`)
        .limit(10)
      setResults(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    search(val)
  }

  const requestTeam = async (teamId: string) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/teams/change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_team_id: teamId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Request failed')
      }
      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setSubmitted(false)
        setQuery('')
        setResults([])
        window.location.reload()
      }, 1500)
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (hasPendingRequest) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
        <span className="text-xl">??</span>
        <div>
          <p className="text-sm font-semibold text-yellow-400">Team change request pending</p>
          {pendingRequestedTeamName && (
            <p className="text-xs text-text-muted mt-0.5">
              Requested: <span className="text-foreground-primary font-medium">{pendingRequestedTeamName}</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-outline flex items-center gap-2"
      >
        <span>??</span>
        {currentTeamId ? 'Request Team Change' : 'Request a Team'}
      </button>

      {open && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Request a Team">
          {submitted ? (
            <div className="text-center py-8">
              <p className="text-text-primary font-semibold text-lg">Request submitted!</p>
              <p className="text-text-muted text-sm mt-1">Awaiting admin review.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-muted mb-4">
                Search for an available team (no current manager). Your request will be reviewed by an admin.
              </p>

              <div className="space-y-1 mb-4">
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search available teams…"
                  className="input-field"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-feedback-error text-sm">
                  {error}
                </div>
              )}

              {loading && (
                <div className="text-center py-4 text-text-muted text-sm">Searching…</div>
              )}

              {!loading && results.length === 0 && query.trim() && (
                <div className="text-center py-4 text-text-muted text-sm">No available teams found.</div>
              )}

              {results.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {results.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 transition-all group"
                    >
                      {team.logo_league_folder ? (
                        <Image
                          src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                          alt={team.name}
                          width={40}
                          height={40}
                          className="object-contain shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-accent font-bold text-sm shrink-0">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      <span className="flex-1 text-sm font-semibold text-text-primary truncate">
                        {team.name}
                      </span>
                      <button
                        onClick={() => requestTeam(team.id)}
                        disabled={submitting}
                        className="btn-gold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? '…' : 'Request'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </BottomSheet>
      )}
    </>
  )
}

