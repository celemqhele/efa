'use client'
import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import { ClipboardList, BarChart3, Shirt, Binoculars, Shield, UserRound } from 'lucide-react'

function formatDate(dateStr: string, fmt: 'full' | 'short'): string {
  if (fmt === 'full') {
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function Desktop({ data }: { data: any }) {
  const { profile, tenures, stats, winRate, currentTeam } = data

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Hero: side-by-side ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-navy-light via-gold/10 to-navy-card h-36 relative" />
        <div className="px-10 py-8 -mt-16 relative flex items-end gap-8">
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full bg-navy-card border-4 border-navy-card shadow-xl overflow-hidden flex items-center justify-center bg-navy">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={112} height={112} className="object-cover w-full h-full" />
              ) : (
                <UserRound className="w-12 h-12 text-gold" />
              )}
            </div>
            {currentTeam?.logo_team_slug && (
              <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-9 h-9 rounded-full bg-navy-card shadow-md flex items-center justify-center overflow-hidden">
                <Image
                  src={getTeamLogo(currentTeam.logo_league_folder, currentTeam.logo_team_slug, 'standings_row')}
                  alt={currentTeam.name}
                  width={22}
                  height={22}
                  className="object-contain"
                />
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-4xl font-black text-foreground-primary">@{profile.username}</h1>
            <p className="text-text-muted font-medium uppercase tracking-widest text-xs mt-1">Professional Manager</p>
          </div>
          <div className="flex gap-8 pb-1">
             <div className="text-center">
                <p className="text-3xl font-black text-foreground-primary">{stats.played}</p>
                <p className="text-xs text-text-muted uppercase font-bold tracking-tighter">Matches</p>
             </div>
             <div className="text-center">
                <p className="text-3xl font-black text-gold">{winRate}%</p>
                <p className="text-xs text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-gold" /> Profile Details
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Playstyle</p>
                <p className="text-sm text-foreground-secondary font-medium">
                  {profile.playstyle || 'Tactical adaptive'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Member Since</p>
                <p className="text-sm text-foreground-secondary font-medium">
                  {formatDate(profile.created_at, 'full')}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gold" /> Career Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Wins</p>
                <p className="text-2xl font-black text-green-400">{stats.wins}</p>
              </div>
              <div className="p-4 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Draws</p>
                <p className="text-2xl font-black text-yellow-400">{stats.draws}</p>
              </div>
              <div className="p-4 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Losses</p>
                <p className="text-2xl font-black text-red-400">{stats.losses}</p>
              </div>
              <div className="p-4 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Goal Diff</p>
                <p className="text-2xl font-black text-foreground-primary">
                  {stats.gf - stats.ga > 0 ? `+${stats.gf - stats.ga}` : stats.gf - stats.ga}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Management History as table ────────────────────────── */}
        <div className="col-span-2">
          <div className="card p-6">
            <h2 className="text-sm font-black text-foreground-primary uppercase tracking-widest flex items-center gap-2 mb-4">
              <Shirt className="w-5 h-5 text-gold" /> Management History
            </h2>

            {(tenures ?? []).length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <Binoculars className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-medium">No management history found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left py-3 pr-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Club</th>
                      <th className="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Period</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">P</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">W</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">D</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">L</th>
                      <th className="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">WR</th>
                      <th className="text-center py-3 pl-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">GD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenures.map((tenure: any) => {
                      const isCurrent = !tenure.ended_at
                      const played = tenure.wins + tenure.draws + tenure.losses
                      const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0

                      return (
                        <tr
                          key={tenure.id}
                          className={`border-b border-border/30 transition-colors hover:bg-black/[0.03] ${
                            isCurrent ? 'bg-gold/[0.03]' : ''
                          }`}
                        >
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                {tenure.team?.logo_team_slug ? (
                                  <Image
                                    src={getTeamLogo(tenure.team.logo_league_folder, tenure.team.logo_team_slug, 'standings_row')}
                                    alt={tenure.team.name} width={30} height={30} className="object-contain"
                                  />
                                ) : <Shield className="w-5 h-5 text-text-muted" />}
                              </div>
                              <div>
                                <Link href={`/teams/${tenure.team_id}`} className="font-bold text-foreground-primary hover:text-gold transition-colors">
                                  {tenure.team?.name || 'Unknown Club'}
                                </Link>
                                {isCurrent && (
                                  <span className="ml-2 text-[9px] bg-gold/20 text-gold border border-gold/30 px-1.5 py-0.5 rounded-full font-black uppercase align-middle">Active</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs text-text-muted whitespace-nowrap">
                            {formatDate(tenure.started_at, 'short')} — {tenure.ended_at ? formatDate(tenure.ended_at, 'short') : 'Present'}
                          </td>
                          <td className="text-center py-4 px-3 font-semibold text-foreground-primary">{played}</td>
                          <td className="text-center py-4 px-3 font-semibold text-green-400">{tenure.wins}</td>
                          <td className="text-center py-4 px-3 font-semibold text-yellow-400">{tenure.draws}</td>
                          <td className="text-center py-4 px-3 font-semibold text-red-400">{tenure.losses}</td>
                          <td className="text-center py-4 px-3 font-semibold text-foreground-primary">{tWinRate}%</td>
                          <td className="text-center py-4 pl-3 font-semibold text-foreground-primary">{tenure.goals_for - tenure.goals_against}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
