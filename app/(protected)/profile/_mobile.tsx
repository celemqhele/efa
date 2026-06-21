'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format, parseISO, differenceInDays } from 'date-fns'
import TeamChangeModal from './TeamChangeModal'
import ProfileActions from './ProfileActions'
import { Card } from '@/components/ui/Card'
import AvatarUpload from '@/components/ui/AvatarUpload'
import ThemeSettings from '@/components/ui/ThemeSettings'
import { Star, Shirt, Shield, RefreshCw, Calendar, Gamepad2, Phone } from 'lucide-react'

const PLAYSTYLE_OPTIONS = [
  'Tactical adaptive',
  'Elite Dominators',
  'Tiki-Taka',
  'Gegenpressing',
  'Disciplined Pressers',
  'Quick Counter',
  'Long Ball Counter',
  'The Grinders',
  'Out Wide',
  'Set-Piece Specialists',
  'Shoot-on-Sight',
]

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = differenceInDays(parseISO(dateStr), new Date())
  return d
}

export default function Mobile({ data }: { data: any }) {
  const {
    user,
    profile,
    team,
    teamIds,
    changeRequests,
    pendingRequest,
    tenures,
    stats,
    winRate,
    next3,
  } = data

  const [playstyle, setPlaystyle] = useState(profile?.playstyle ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)

  async function savePlaystyle() {
    setSaving(true)
    try {
      await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playstyle }),
      })
    } catch {}
    setSaving(false)
  }

  async function savePhone() {
    setSavingPhone(true)
    try {
      await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { title: 'Saved', message: 'Phone number updated', type: 'success' },
      }))
    } catch {}
    setSavingPhone(false)
  }

  return (
    <div className="space-y-space-8 max-w-3xl mx-auto">

      {/* -- Profile Card --------------------------------------------------- */}
      <Card className="p-space-6 flex flex-col sm:flex-row items-center sm:items-start gap-space-6">
        {/* Avatar */}
        <div className="shrink-0">
          <AvatarUpload avatarUrl={profile?.avatar_url} username={profile?.username ?? 'User'} />
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left space-y-space-2 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-space-2 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary">
              @{profile?.username ?? user.email}
            </h1>
            {profile?.role === 'admin' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent/15 text-accent text-xs font-semibold tracking-wide">
                <Star className="w-3.5 h-3.5 fill-accent/30" /> Admin
              </span>
            )}
          </div>

          {team ? (
            <Link
              href={`/teams/${team.id}`}
              className="inline-flex items-center gap-space-2 text-text-secondary hover:text-accent transition-colors group"
            >
              {team.logo_league_folder && (
                <Image
                  src={getTeamLogo(team.logo_league_folder, team.logo_team_slug, 'standings_row')}
                  alt={team.name}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              )}
              <span className="text-sm font-semibold group-hover:underline">{team.name}</span>
              <span className="text-text-muted text-xs">→</span>
            </Link>
          ) : (
            <Link
              href="/select-team"
              className="inline-flex items-center gap-space-1.5 text-sm text-text-muted hover:text-accent transition-colors"
            >
              <span className="text-accent">+</span>
              No team selected — select one
            </Link>
          )}

          <p className="text-xs text-text-muted">{user.email}</p>

          {/* Playstyle selector */}
          <div className="flex items-center gap-2 pt-space-1">
            <Gamepad2 className="w-4 h-4 text-accent shrink-0" />
            <select
              value={playstyle}
              onChange={(e) => setPlaystyle(e.target.value)}
              className="flex-1 text-xs bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-accent/50"
            >
              <option value="">Select playstyle…</option>
              {PLAYSTYLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {playstyle !== (profile?.playstyle ?? '') && (
              <button
                onClick={savePlaystyle}
                disabled={saving}
                className="text-[10px] font-semibold bg-accent text-bg-base rounded-lg px-2.5 py-1.5 hover:bg-accent/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {saving ? '…' : 'Save'}
              </button>
            )}
          </div>

          {/* Phone number */}
          <div className="flex items-center gap-2 pt-space-1">
            <Phone className="w-4 h-4 text-accent shrink-0" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+27 12 345 6789"
              className="flex-1 text-xs bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-text-primary outline-none focus:border-accent/50"
            />
            {phone !== (profile?.phone ?? '') && (
              <button
                onClick={savePhone}
                disabled={savingPhone}
                className="text-[10px] font-semibold bg-accent text-bg-base rounded-lg px-2.5 py-1.5 hover:bg-accent/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {savingPhone ? '…' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Quick Career Stats */}
        <div className="flex gap-space-4 sm:flex-col justify-center sm:justify-start pt-space-4 sm:pt-0">
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-text-primary">{stats.played}</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Matches</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-accent">{winRate}%</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
          </div>
        </div>
      </Card>

      {/* -- Career History Section ------------------------------------------ */}
      <Card className="p-space-5 space-y-space-4">
        <h2 className="section-header">
          <Shirt className="w-5 h-5 text-gold" /> Management History
        </h2>

        {(tenures ?? []).length === 0 ? (
          <p className="text-text-muted text-sm text-center py-space-4">No management history found.</p>
        ) : (
          <div className="space-y-space-3">
            {tenures.map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0

              return (
                <div key={tenure.id} className={`p-space-4 rounded-xl border flex items-center gap-space-4 ${
                  isCurrent
                    ? 'bg-accent/5 border-accent/20'
                    : 'bg-bg-elevated border-border'
                }`}>
                  <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    {tenure.team?.logo_team_slug ? (
                      <Image
                        src={getTeamLogo(tenure.team.logo_league_folder, tenure.team.logo_team_slug, 'standings_row')}
                        alt={tenure.team.name} width={28} height={28} className="object-contain"
                      />
                    ) : <Shield className="w-5 h-5 text-text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/teams/${tenure.team_id}`} className="font-bold text-text-primary hover:text-accent transition-colors truncate block text-sm">
                      {tenure.team?.name || 'Unknown Club'}
                    </Link>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                      {format(new Date(tenure.started_at), 'MMM yyyy')} — {tenure.ended_at ? format(new Date(tenure.ended_at), 'MMM yyyy') : 'Present'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-text-primary">{played} <span className="text-[9px] text-text-muted font-bold">P</span></p>
                    <p className="text-xs font-black text-accent">{tWinRate}% <span className="text-[9px] text-text-muted font-bold">WR</span></p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* -- Team Change Request --------------------------------------------- */}
      <Card className="p-space-5 space-y-space-3">
        <h2 className="section-header">
          <RefreshCw className="w-5 h-5 text-gold" /> Team Management
        </h2>
        <TeamChangeModal
          currentTeamId={team?.id ?? null}
          hasPendingRequest={!!pendingRequest}
          pendingRequestedTeamName={(pendingRequest as any)?.requested_team?.name ?? null}
        />

        {/* Past requests */}
        {changeRequests && changeRequests.length > 0 && (
          <div className="mt-space-3 space-y-space-1.5">
            {changeRequests.slice(0, 3).map((req: any) => {
              const statusStyle =
                req.status === 'approved'
                  ? 'text-feedback-success bg-feedback-success/10 border-feedback-success/20'
                  : req.status === 'denied'
                  ? 'text-feedback-error bg-feedback-error/10 border-feedback-error/20'
                  : 'text-feedback-warning bg-feedback-warning/10 border-feedback-warning/20'
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between text-xs px-space-3 py-space-2 rounded-lg border border-border bg-bg-base"
                >
                  <span className="text-text-secondary">
                    {req.requested_team?.name ?? 'Unknown team'}
                  </span>
                  <span className={`px-space-2 py-0.5 rounded border font-semibold capitalize ${statusStyle}`}>
                    {req.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* -- Upcoming Fixtures ----------------------------------------------- */}
      {team && (
        <Card className="p-space-5 space-y-space-4">
          <h2 className="section-header">
            <Calendar className="w-5 h-5 text-gold" /> Upcoming Fixtures
          </h2>

          {next3.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-space-4">No upcoming fixtures scheduled.</p>
          ) : (
            <div className="space-y-space-3">
              {next3.map((f: any) => {
                const isHome = teamIds.includes(f.home_team?.id)
                const opponent = isHome ? f.away_team : f.home_team
                const days = daysUntil(f.scheduled_date)
                const dateStr = f.scheduled_date
                  ? format(parseISO(f.scheduled_date), 'EEE d MMM')
                  : 'TBD'

                return (
                  <Link
                    key={f.id}
                    href={`/fixtures/${f.id}`}
                    className="flex items-center gap-space-4 p-space-4 rounded-xl border border-border hover:border-accent/40 hover:bg-bg-base transition-all group"
                  >
                    {opponent?.logo_league_folder && (
                      <Image
                        src={getTeamLogo(opponent.logo_league_folder, opponent.logo_team_slug, 'standings_row')}
                        alt={opponent.name}
                        width={40}
                        height={40}
                        className="object-contain shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {isHome ? 'vs' : '@'}{' '}
                        <span>{opponent?.name ?? 'TBD'}</span>
                      </p>
                      <p className="text-xs text-text-muted mt-space-0.5">
                        {f.tournament?.name} · {dateStr}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {days != null && days >= 0 ? (
                        days === 0 ? (
                          <span className="text-xs font-bold text-accent bg-accent/10 px-space-2 py-space-1 rounded-lg">
                            Today
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">
                            in <span className="font-bold text-text-primary">{days}d</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-text-secondary">Past</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* -- Theme Settings ------------------------------------------------- */}
      <ThemeSettings />

      {/* -- Account Security ----------------------------------------------- */}
      <ProfileActions userEmail={user.email ?? ''} />

    </div>
  )
}
