'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { Trophy, Star, Globe, Medal, Award, Crown } from 'lucide-react'

const TROPHY_ICONS: Record<string, React.ReactNode> = {
  league: <Trophy className="w-4 h-4 text-accent" />,
  tournament_club: <Star className="w-4 h-4 text-accent" />,
  tournament_international: <Globe className="w-4 h-4 text-accent" />,
  ucl: <Globe className="w-4 h-4 text-blue-400" />,
  europa: <Globe className="w-4 h-4 text-orange-400" />,
  super_cup: <Medal className="w-4 h-4 text-purple-400" />,
  friendlies: <Medal className="w-4 h-4 text-accent" />,
}

const TROPHY_LABEL: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Tournament (Clubs)',
  tournament_international: 'Tournament (Intl)',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
  friendlies: 'Friendly',
}

const TROPHY_COLOR: Record<string, string> = {
  league: 'border-accent/40 bg-accent/10',
  tournament_club: 'border-blue-500/40 bg-blue-500/10',
  tournament_international: 'border-green-500/40 bg-green-500/10',
  ucl: 'border-blue-500/40 bg-blue-500/10',
  europa: 'border-orange-500/40 bg-orange-500/10',
  super_cup: 'border-purple-500/40 bg-purple-500/10',
  friendlies: 'border-purple-500/40 bg-purple-500/10',
}

const TROPHY_TEXT: Record<string, string> = {
  league: 'text-accent',
  tournament_club: 'text-blue-400',
  tournament_international: 'text-green-400',
  ucl: 'text-blue-400',
  europa: 'text-orange-400',
  super_cup: 'text-purple-400',
  friendlies: 'text-purple-400',
}

interface TrophyWithRelations {
  id: string
  team_id: string
  tournament_id: string
  season_id: string
  trophy_type: 'league' | 'tournament_club' | 'tournament_international' | 'ucl' | 'europa' | 'super_cup' | 'friendlies'
  awarded_at: string
  team: {
    id: string
    name: string
    logo_league_folder: string
    logo_team_slug: string
  }
  tournament: {
    id: string
    name: string
    type: string
  }
  season: {
    id: string
    name: string
  }
}

interface DesktopProps {
  data: {
    seasons: [string, TrophyWithRelations[]][]
    allTimeRecords: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }][]
    mostPL: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
    mostUCL: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
    mostTotal: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
  }
}

export default function Desktop({ data }: DesktopProps) {
  const { seasons, allTimeRecords, mostPL, mostUCL, mostTotal } = data

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="text-center py-6">
        <p className="text-accent text-sm font-semibold uppercase tracking-widest mb-2">
          EFA Official Records
        </p>
        <h1 className="text-4xl font-black text-text-primary">Hall of Fame</h1>
        <p className="text-text-muted text-sm mt-2">
          Champions, records, and legends of the EFA
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">All-Time Records</h2>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {mostTotal && (
            <div className="bg-bg-elevated border border-accent/30 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-200 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">
                Most Trophies Overall
              </p>
              <TeamLogo
                leagueFolder={mostTotal[1].team.logo_league_folder}
                teamSlug={mostTotal[1].team.logo_team_slug}
                context="news_thumb"
                alt={mostTotal[1].team.name}
                className="w-16 h-16 mx-auto mb-2"
              />
              <p className="font-bold text-text-primary">{mostTotal[1].team.name}</p>
              <p className="text-3xl font-black text-accent mt-1">{mostTotal[1].total}</p>
              <p className="text-xs text-text-muted">trophies</p>
            </div>
          )}

          {mostPL && (
            <div className="bg-bg-elevated border border-accent/20 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-200 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">
                <Trophy className="w-3.5 h-3.5 inline-block -mt-0.5" /> Most League Titles
              </p>
              <TeamLogo
                leagueFolder={mostPL[1].team.logo_league_folder}
                teamSlug={mostPL[1].team.logo_team_slug}
                context="news_thumb"
                alt={mostPL[1].team.name}
                className="w-16 h-16 mx-auto mb-2"
              />
              <p className="font-bold text-text-primary">{mostPL[1].team.name}</p>
              <p className="text-3xl font-black text-accent mt-1">{mostPL[1].byType['league']}</p>
              <p className="text-xs text-text-muted">league titles</p>
            </div>
          )}

          {mostUCL && (
            <div className="bg-bg-elevated border border-blue-500/20 rounded-2xl p-6 text-center hover:shadow-lg transition-all duration-200 shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
                <Globe className="w-3.5 h-3.5 inline-block -mt-0.5" /> Most UCL Wins
              </p>
              <TeamLogo
                leagueFolder={mostUCL[1].team.logo_league_folder}
                teamSlug={mostUCL[1].team.logo_team_slug}
                context="news_thumb"
                alt={mostUCL[1].team.name}
                className="w-16 h-16 mx-auto mb-2"
              />
              <p className="font-bold text-text-primary">{mostUCL[1].team.name}</p>
              <p className="text-3xl font-black text-blue-400 mt-1">{mostUCL[1].byType['tournament_club']}</p>
              <p className="text-xs text-text-muted">UCL titles</p>
            </div>
          )}
        </div>

        {allTimeRecords.length > 0 && (
          <div className="mt-6 bg-bg-elevated border border-border rounded-2xl overflow-hidden shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-base">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Team</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Total</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">PL</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">UCL</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">UEL</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">SC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {allTimeRecords.map(([tid, data], idx) => (
                    <tr key={tid} className="hover:bg-accent/5 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/teams/${tid}`} className="flex items-center gap-3 hover:text-accent transition-colors">
                          <span className="text-text-muted text-xs w-5 shrink-0 font-bold tabular-nums">#{idx + 1}</span>
                          <TeamLogo leagueFolder={data.team.logo_league_folder} teamSlug={data.team.logo_team_slug} context="standings_row" alt={data.team.name} className="w-7 h-7 shrink-0" />
                          <span className="font-semibold text-text-primary">{data.team.name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-center font-black text-accent tabular-nums">{data.total}</td>
                      <td className="px-5 py-3 text-center text-text-secondary tabular-nums">{data.byType['league'] ?? '—'}</td>
                      <td className="px-5 py-3 text-center text-text-secondary tabular-nums">{data.byType['tournament_club'] ?? '—'}</td>
                      <td className="px-5 py-3 text-center text-text-secondary tabular-nums">{data.byType['tournament_international'] ?? '—'}</td>
                      <td className="px-5 py-3 text-center text-text-secondary tabular-nums">{data.byType['friendlies'] ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary tracking-wide uppercase">Season Archives</h2>
        </div>

        {seasons.length === 0 ? (
          <div className="bg-bg-elevated border border-border rounded-2xl p-8 text-center text-text-muted text-sm">
            No season results recorded yet. History is being written.
          </div>
        ) : (
          <div className="space-y-6">
            {seasons.map(([seasonName, seasonTrophies]) => {
              const byType: Record<string, TrophyWithRelations> = {}
              for (const t of seasonTrophies) {
                byType[t.trophy_type] = t
              }

              return (
                <div key={seasonName} className="bg-bg-elevated border border-border rounded-2xl overflow-hidden shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]">
                  <div className="px-5 py-3.5 bg-gradient-to-r from-accent/10 to-transparent border-b border-border flex items-center justify-between">
                    <h3 className="font-black text-text-primary text-lg">{seasonName}</h3>
                    <span className="text-xs text-text-muted">{seasonTrophies.length} title{seasonTrophies.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="p-5 grid grid-cols-4 gap-4">
                    {(['league', 'tournament_club', 'tournament_international', 'ucl', 'europa', 'super_cup', 'friendlies'] as const).map((type) => {
                      const winner = byType[type]
                      return (
                        <div key={type} className={`rounded-xl border p-4 text-center transition-all duration-200 ${
                          winner
                            ? `${TROPHY_COLOR[type]} hover:shadow-md`
                            : 'border-border opacity-40'
                        }`}>
                          <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${winner ? TROPHY_TEXT[type] : 'text-text-muted'}`}>
                            {TROPHY_ICONS[type]} {TROPHY_LABEL[type]}
                          </p>

                          {winner ? (
                            <Link href={`/teams/${winner.team.id}`} className="block hover:opacity-90 transition-opacity">
                              <TeamLogo leagueFolder={winner.team.logo_league_folder} teamSlug={winner.team.logo_team_slug} context="profile_avatar" alt={winner.team.name} className="w-16 h-16 mx-auto mb-2" />
                              <p className="font-bold text-text-primary text-sm leading-snug">{winner.team.name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{winner.tournament?.name}</p>
                            </Link>
                          ) : (
                            <div className="py-4"><p className="text-text-muted text-xs">Not awarded</p></div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
