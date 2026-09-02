'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import TeamLogo from '@/components/ui/TeamLogo'
import { Check, X, ShieldQuestion } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { isPast } from 'date-fns'

type App = {
  id: string
  season_id: string
  applicant_id: string
  team_id: string
  poll_id: string | null
  expires_at: string | null
  created_at: string
  season: { id: string; name: string } | null
  applicant: { id: string; username: string | null; avatar_url: string | null; sacked_at: string | null } | null
  team: { id: string; name: string | null; logo_league_folder: string | null; logo_team_slug: string | null } | null
  poll: { id: string; title: string } | null
}

type OpenSeason = { season_id: string; season_name: string; vacant_seats: number }

export default function ReviewShell({ applications, openSeasons }: { applications: App[]; openSeasons: OpenSeason[] }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ title: string; body: string; type: 'success' | 'error' } | null>(null)

  function pushToast(t: { title: string; body: string; type: 'success' | 'error' }) {
    setToast(t)
    window.setTimeout(() => setToast(null), 4000)
  }

  async function approve(app: App) {
    if (busyId) return
    setBusyId(app.id)
    let res = await fetch('/api/admin/tournament-applications/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: app.id }),
    })
    let data = await res.json()

    if (data.code === 'SACK_COOLDOWN') {
      const ok = globalThis.confirm?.(
        '@' + (app.applicant?.username ?? 'user') + ' was recently sacked and is in cooldown.\nApprove anyway?'
      )
      if (ok) {
        res = await fetch('/api/admin/tournament-applications/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ application_id: app.id, override: true }),
        })
        data = await res.json()
      } else {
        setBusyId(null)
        return
      }
    }

    if (res.ok) {
      pushToast({ title: 'Approved', body: data?.message ?? 'Application approved.', type: 'success' })
      window.setTimeout(() => window.location.reload(), 900)
    } else {
      pushToast({ title: 'Could not approve', body: data?.error ?? 'Something went wrong.', type: 'error' })
      setBusyId(null)
    }
  }

  async function deny(app: App) {
    if (busyId) return
    const reason = globalThis.prompt?.('Reason for declining (optional):') ?? null
    if (reason === null) return
    setBusyId(app.id)
    const res = await fetch('/api/admin/tournament-applications/deny', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: app.id, reason: reason || undefined }),
    })
    const data = await res.json()
    if (res.ok) {
      pushToast({ title: 'Declined', body: 'Application declined.', type: 'success' })
      window.setTimeout(() => window.location.reload(), 900)
    } else {
      pushToast({ title: 'Could not decline', body: data?.error ?? 'Something went wrong.', type: 'error' })
    }
    setBusyId(null)
  }

  const vacancyBySeason = new Map(openSeasons.map((s) => [s.season_id, s.vacant_seats]))

  return (
    <div className="space-y-space-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-black text-text-primary">Tournament Applications</h1>
        <p className="text-xs text-text-muted">
          Seasonal self-service seat applications. Approving adds the manager to the first vacant seat.
        </p>
      </div>

      {toast && (
        <div className={`rounded-lg px-3 py-2 text-xs ${toast.type === 'success' ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-400'}`}>
          <span className="font-bold">{toast.title}.</span> {toast.body}
        </div>
      )}

      {applications.length === 0 ? (
        <Card className="p-space-8 text-center">
          <ShieldQuestion className="w-8 h-8 text-text-muted mx-auto mb-space-3" />
          <p className="text-sm text-text-muted">No pending applications.</p>
        </Card>
      ) : (
        applications.map((app) => {
          const vacancyLeft = vacancyBySeason.get(app.season_id) ?? 0
          const expired = app.expires_at ? isPast(parseISO(app.expires_at)) : false
          return (
            <Card key={app.id} className="p-space-5 space-y-space-4">
              <div className="flex items-center gap-space-3">
                <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center overflow-hidden shrink-0">
                  {app.applicant?.avatar_url
                    ? <img src={app.applicant.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-accent">@{(app.applicant?.username ?? '?')[0]?.toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary truncate">@{app.applicant?.username ?? 'unknown'}</p>
                  <p className="text-xs text-text-muted">
                    {format(parseISO(app.created_at), 'd MMM yyyy, HH:mm')}
                    {expired && <span className="text-red-400"> · expired</span>}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md ${
                  vacancyLeft > 0 ? 'bg-accent/10 text-accent' : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {vacancyLeft > 0 ? `${vacancyLeft} seat${vacancyLeft === 1 ? '' : 's'} open` : 'Season full'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-space-6 gap-y-space-2 text-sm">
                <div className="flex items-center gap-space-2">
                  <span className="text-xs text-text-muted">Applying for</span>
                  <Link href={`/admin/season/${app.season?.name ?? ''}`} className="font-semibold text-text-primary hover:text-accent">
                    {app.season?.name ?? 'Season'}
                  </Link>
                </div>
                {app.poll && (
                  <div className="flex items-center gap-space-2">
                    <span className="text-xs text-text-muted">via</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/30">
                      {app.poll.title}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-space-2">
                  <span className="text-xs text-text-muted">Club</span>
                  {app.team?.logo_league_folder && app.team?.logo_team_slug ? (
                    <TeamLogo leagueFolder={app.team.logo_league_folder} teamSlug={app.team.logo_team_slug} context="standings_row" alt={app.team.name ?? ''} className="w-5 h-5" />
                  ) : null}
                  <span className="font-semibold text-text-primary">{app.team?.name ?? 'Vacant'}</span>
                </div>
              </div>

              <div className="flex gap-space-3">
                <button
                  onClick={() => approve(app)}
                  disabled={busyId === app.id}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-accent text-bg-base rounded-lg py-2 hover:bg-accent/90 transition-colors disabled:opacity-40"
                >
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => deny(app)}
                  disabled={busyId === app.id}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg py-2 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <X className="w-4 h-4" /> Decline
                </button>
              </div>
            </Card>
          )
        })
      )}
    </div>
  )
}