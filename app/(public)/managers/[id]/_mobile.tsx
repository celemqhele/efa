'use client'
import Image from 'next/image'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { ClipboardList, BarChart3, Shirt, Binoculars, Shield, UserRound } from 'lucide-react'

function formatDate(dateStr: string, fmt: 'full' | 'short'): string {
  if (fmt === 'full') {
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function Mobile({ data }: { data: any }) {
  const { profile, tenures, stats, winRate, currentTeam } = data

  return (
    <div className="px-4 pb-8 space-y-5">
      {/* ── Hero: stacked vertical ──────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-navy-light via-gold/10 to-navy-card h-24 relative" />
        <div className="px-5 pt-0 pb-5 -mt-12 relative flex flex-col items-center text-center">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-navy-card border-4 border-navy-card shadow-xl overflow-hidden flex items-center justify-center bg-navy">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <UserRound className="w-8 h-8 text-gold" />
              )}
            </div>
            {currentTeam?.logo_team_slug && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-navy-card shadow-md flex items-center justify-center overflow-hidden">
                <TeamLogo
                  leagueFolder={currentTeam.logo_league_folder}
                  teamSlug={currentTeam.logo_team_slug}
                  context="standings_row"
                  alt={currentTeam.name}
                  className="w-4 h-4"
                />
              </div>
            )}
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-black text-foreground-primary">@{profile.username}</h1>
            <p className="text-text-muted font-medium uppercase tracking-widest text-[10px] mt-0.5">Professional Manager</p>
          </div>
          <div className="flex gap-5 mt-3">
             <div className="text-center">
                <p className="text-xl font-black text-foreground-primary">{stats.played}</p>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Matches</p>
             </div>
             <div className="text-center">
                <p className="text-xl font-black text-gold">{winRate}%</p>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
             </div>
          </div>
        </div>
      </div>

      {/* ── Profile Details ─────────────────────────────────────────────── */}
      <div className="card p-4">
        <h2 className="text-xs font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-gold" /> Profile Details
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/50">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Playstyle</p>
            <p className="text-xs text-foreground-secondary font-medium">{profile.playstyle || 'Tactical adaptive'}</p>
          </div>
          <div className="flex justify-between items-center py-1">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Member Since</p>
            <p className="text-xs text-foreground-secondary font-medium">{formatDate(profile.created_at, 'full')}</p>
          </div>
        </div>
      </div>

      {/* ── Career Statistics: horizontal snap scroll ───────────────────── */}
      <div className="card p-4">
        <h2 className="text-xs font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gold" /> Career Statistics
        </h2>
        <div className="overflow-x-auto -mx-4 px-4 snap-x snap-mandatory flex gap-3 scrollbar-none">
          <div className="snap-start shrink-0 w-[110px] p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
            <p className="text-[10px] text-text-muted mb-1 font-bold uppercase tracking-wider">Wins</p>
            <p className="text-lg font-black text-green-400">{stats.wins}</p>
          </div>
          <div className="snap-start shrink-0 w-[110px] p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
            <p className="text-[10px] text-text-muted mb-1 font-bold uppercase tracking-wider">Draws</p>
            <p className="text-lg font-black text-yellow-400">{stats.draws}</p>
          </div>
          <div className="snap-start shrink-0 w-[110px] p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
            <p className="text-[10px] text-text-muted mb-1 font-bold uppercase tracking-wider">Losses</p>
            <p className="text-lg font-black text-red-400">{stats.losses}</p>
          </div>
          <div className="snap-start shrink-0 w-[110px] p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
            <p className="text-[10px] text-text-muted mb-1 font-bold uppercase tracking-wider">Goal Diff</p>
            <p className="text-lg font-black text-foreground-primary">
              {stats.gf - stats.ga > 0 ? `+${stats.gf - stats.ga}` : stats.gf - stats.ga}
            </p>
          </div>
        </div>
      </div>

      {/* ── Management History ──────────────────────────────────────────── */}
      <div className="card p-4">
        <h2 className="text-xs font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-3">
          <Shirt className="w-4 h-4 text-gold" /> Management History
        </h2>

        {(tenures ?? []).length === 0 ? (
          <div className="py-10 text-center text-text-muted">
            <Binoculars className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-xs font-medium">No management history found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tenures.map((tenure: any) => {
              const isCurrent = !tenure.ended_at
              const played = tenure.wins + tenure.draws + tenure.losses
              const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0

              return (
                <details key={tenure.id} className={`rounded-2xl border overflow-hidden ${
                  isCurrent
                    ? 'bg-gold/5 border-gold/30'
                    : 'bg-navy-light/20 border-navy-border'
                }`}>
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none min-h-[48px] active:bg-black/[0.03]">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      {tenure.team?.logo_team_slug ? (
                        <TeamLogo
                          leagueFolder={tenure.team.logo_league_folder}
                          teamSlug={tenure.team.logo_team_slug}
                          context="standings_row"
                          alt={tenure.team.name}
                          className="w-7 h-7"
                        />
                      ) : <Shield className="w-5 h-5 text-text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/teams/${tenure.team_id}`} className="text-sm font-bold text-foreground-primary hover:text-gold transition-colors truncate block">
                        {tenure.team?.name || 'Unknown Club'}
                      </Link>
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                        {formatDate(tenure.started_at, 'short')} — {tenure.ended_at ? formatDate(tenure.ended_at, 'short') : 'Present'}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] bg-gold/20 text-gold border border-gold/30 px-2 py-0.5 rounded-full font-black uppercase shrink-0">Active</span>
                    )}
                  </summary>
                  <div className="px-4 pb-4 border-t border-border/50 pt-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-navy-card/50 rounded-lg p-2 border border-navy-border/50">
                        <p className="text-sm font-black text-foreground-primary">{played}</p>
                        <p className="text-[9px] text-text-muted font-bold uppercase">P</p>
                      </div>
                      <div className="bg-navy-card/50 rounded-lg p-2 border border-navy-border/50">
                        <p className="text-sm font-black text-green-400">{tenure.wins}</p>
                        <p className="text-[9px] text-text-muted font-bold uppercase">W</p>
                      </div>
                      <div className="bg-navy-card/50 rounded-lg p-2 border border-navy-border/50">
                        <p className="text-sm font-black text-foreground-primary">{tWinRate}%</p>
                        <p className="text-[9px] text-text-muted font-bold uppercase">WR</p>
                      </div>
                      <div className="bg-navy-card/50 rounded-lg p-2 border border-navy-border/50">
                        <p className="text-sm font-black text-foreground-primary">{tenure.goals_for - tenure.goals_against}</p>
                        <p className="text-[9px] text-text-muted font-bold uppercase">GD</p>
                      </div>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
