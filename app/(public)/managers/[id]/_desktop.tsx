'use client'
import Image from 'next/image'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import { Card } from '@/components/ui/Card'
import { ClipboardList, BarChart3, Shirt, Binoculars, Shield, UserRound, Trophy } from 'lucide-react'

function formatDate(dateStr: string, fmt: 'full' | 'short'): string {
  if (fmt === 'full') {
    return new Date(dateStr).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function Desktop({ data }: { data: any }) {
  const { profile, tenures, stats, winRate, currentTeam, trophies } = data

  const TROPHY_LABEL: Record<string, string> = {
    league: 'PL League',
    tournament_club: 'Tournament (Clubs)',
    tournament_international: 'Tournament (Intl)',
    friendlies: 'Friendly',
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card>
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-36 relative rounded-t-2xl overflow-hidden" />
        <div className="px-10 py-8 -mt-16 relative flex items-end gap-8">
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full bg-bg-surface border-4 border-bg-surface shadow-xl overflow-hidden flex items-center justify-center bg-bg-base">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={112} height={112} className="object-cover w-full h-full" />
              ) : (
                <UserRound className="w-12 h-12 text-accent" />
              )}
            </div>
            {currentTeam?.logo_team_slug && (
              <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-9 h-9 rounded-full bg-bg-surface ring-2 ring-bg-surface shadow-md flex items-center justify-center overflow-hidden">
                <TeamLogo
                  leagueFolder={currentTeam.logo_league_folder}
                  teamSlug={currentTeam.logo_team_slug}
                  context="standings_row"
                  alt={currentTeam.name}
                  className="w-[22px] h-[22px]"
                />
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-4xl font-black text-text-primary">@{profile.username}</h1>
            <p className="text-text-muted font-medium uppercase tracking-widest text-xs mt-1">Professional Manager</p>
          </div>
          <div className="flex gap-8 pb-1">
             <div className="text-center">
                <p className="text-3xl font-black text-text-primary tabular-nums">{stats.played}</p>
                <p className="text-xs text-text-muted uppercase font-bold tracking-tighter">Matches</p>
             </div>
             <div className="text-center">
                <p className="text-3xl font-black text-accent tabular-nums">{winRate}%</p>
                <p className="text-xs text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
             </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Profile Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Playstyle</p>
                <p className="text-sm text-text-secondary font-medium">
                  {profile.playstyle || 'Tactical adaptive'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Member Since</p>
                <p className="text-sm text-text-secondary font-medium">
                  {formatDate(profile.created_at, 'full')}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Career Statistics</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Wins</p>
                <p className="text-2xl font-black text-feedback-success tabular-nums">{stats.wins}</p>
              </div>
              <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Draws</p>
                <p className="text-2xl font-black text-feedback-warning tabular-nums">{stats.draws}</p>
              </div>
              <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Losses</p>
                <p className="text-2xl font-black text-feedback-error tabular-nums">{stats.losses}</p>
              </div>
              <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border/50">
                <p className="text-xs text-text-muted mb-1 font-bold">Goal Diff</p>
                <p className="text-2xl font-black text-text-primary tabular-nums">
                  {stats.gf - stats.ga > 0 ? `+${stats.gf - stats.ga}` : stats.gf - stats.ga}
                </p>
              </div>
            </div>
          </Card>

          {(trophies ?? []).length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Hall of Fame</h2>
              </div>
              <div className="space-y-2">
                {trophies.map((trophy: any) => (
                  <div key={trophy.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      {trophy.team?.logo_team_slug ? (
                        <Image
                          src={`/logos/${trophy.team.logo_league_folder}/1280x1280/${trophy.team.logo_team_slug}.png`}
                          alt={trophy.team.name}
                          width={28} height={28}
                          className="object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                        />
                      ) : (
                        <Shield className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{TROPHY_LABEL[trophy.trophy_type] ?? trophy.trophy_type}</p>
                      <p className="text-[10px] text-text-muted">{trophy.team?.name} — {trophy.awarded_at?.slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shirt className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Management History</h2>
            </div>

            {(tenures ?? []).length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <Binoculars className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-medium">No management history found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-base">
                      <th className="text-left py-3.5 pr-4 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Club</th>
                      <th className="text-left py-3.5 px-4 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Period</th>
                      <th className="text-center py-3.5 px-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">P</th>
                      <th className="text-center py-3.5 px-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">W</th>
                      <th className="text-center py-3.5 px-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">D</th>
                      <th className="text-center py-3.5 px-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">L</th>
                      <th className="text-center py-3.5 px-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">WR</th>
                      <th className="text-center py-3.5 pl-3 text-[11px] font-semibold text-text-muted uppercase tracking-wider">GD</th>
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
                          className={`border-b border-border/30 transition-colors hover:bg-accent/5 ${
                            isCurrent ? 'bg-accent/5' : ''
                          }`}
                        >
                          <td className="py-4 pr-4 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                {tenure.team?.logo_team_slug ? (
                                  <TeamLogo
                                    leagueFolder={tenure.team.logo_league_folder}
                                    teamSlug={tenure.team.logo_team_slug}
                                    context="standings_row"
                                    alt={tenure.team.name}
                                    className="w-[30px] h-[30px]"
                                  />
                                ) : <Shield className="w-5 h-5 text-text-muted" />}
                              </div>
                              <div className="min-w-0">
                                <Link href={`/teams/${tenure.team_id}`} className="font-bold text-text-primary hover:text-accent transition-colors truncate block">
                                  {tenure.team?.name || 'Unknown Club'}
                                </Link>
                                {isCurrent && (
                                  <span className="ml-2 text-[9px] bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded-full font-semibold uppercase align-middle shrink-0">Active</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-xs text-text-muted whitespace-nowrap">
                            {formatDate(tenure.started_at, 'short')} — {tenure.ended_at ? formatDate(tenure.ended_at, 'short') : 'Present'}
                          </td>
                          <td className="text-center py-4 px-3 font-semibold text-text-primary tabular-nums">{played}</td>
                          <td className="text-center py-4 px-3 font-semibold text-feedback-success tabular-nums">{tenure.wins}</td>
                          <td className="text-center py-4 px-3 font-semibold text-feedback-warning tabular-nums">{tenure.draws}</td>
                          <td className="text-center py-4 px-3 font-semibold text-feedback-error tabular-nums">{tenure.losses}</td>
                          <td className="text-center py-4 px-3 font-semibold text-text-primary tabular-nums">{tWinRate}%</td>
                          <td className="text-center py-4 pl-3 font-semibold text-text-primary tabular-nums">{tenure.goals_for - tenure.goals_against}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
