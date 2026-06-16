'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getTeamLogo } from '@/lib/logo-resolver'
import { Trophy, Star, Globe, Medal } from 'lucide-react'

const TROPHY_ICONS: Record<string, React.ReactNode> = {
  league: <Trophy className="w-4 h-4 text-accent" />,
  tournament_club: <Star className="w-4 h-4 text-accent" />,
  tournament_international: <Globe className="w-4 h-4 text-accent" />,
  friendlies: <Medal className="w-4 h-4 text-accent" />,
}

const TROPHY_LABEL: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Tournament (Clubs)',
  tournament_international: 'Tournament (Intl)',
  friendlies: 'Friendly',
}

const TROPHY_COLOR: Record<string, string> = {
  league: 'border-gold/40 bg-gold/10',
  tournament_club: 'border-blue-500/40 bg-blue-500/10',
  tournament_international: 'border-green-500/40 bg-green-500/10',
  friendlies: 'border-purple-500/40 bg-purple-500/10',
}

const TROPHY_TEXT: Record<string, string> = {
  league: 'text-gold',
  tournament_club: 'text-blue-400',
  tournament_international: 'text-green-400',
  friendlies: 'text-purple-400',
}

interface TrophyWithRelations {
  id: string
  team_id: string
  tournament_id: string
  season_id: string
  trophy_type: 'league' | 'tournament_club' | 'tournament_international' | 'friendlies'
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

interface MobileProps {
  data: {
    seasons: [string, TrophyWithRelations[]][]
    allTimeRecords: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }][]
    mostPL: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
    mostUCL: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
    mostTotal: [string, { team: TrophyWithRelations['team']; total: number; byType: Record<string, number> }] | undefined
  }
}

export default function Mobile({ data }: MobileProps) {
  const { seasons, allTimeRecords, mostPL, mostUCL, mostTotal } = data

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="text-center py-4 bg-bg-elevated border border-border rounded-xl">
        <p className="text-gold text-xs font-semibold uppercase tracking-widest mb-1">
          EFA Official Records
        </p>
        <h1 className="text-2xl font-black text-text-primary">Hall of Fame</h1>
        <p className="text-text-muted text-xs mt-1">
          Champions, records, and legends of the EFA
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gold" />
          All-Time Records
        </h2>
        <div className="space-y-3">
          {mostTotal && (
            <div className="bg-bg-elevated border border-gold/30 rounded-xl p-4 text-center">
              <p className="text-[10px] font-semibold text-gold uppercase tracking-widest mb-3">
                Most Trophies Overall
              </p>
              <Image
                src={getTeamLogo(mostTotal[1].team.logo_league_folder, mostTotal[1].team.logo_team_slug, 'news_thumb')}
                alt={mostTotal[1].team.name}
                width={48} height={48}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-text-primary text-sm">{mostTotal[1].team.name}</p>
              <p className="text-2xl font-black text-gold mt-1">{mostTotal[1].total}</p>
              <p className="text-[10px] text-text-muted">trophies</p>
            </div>
          )}

          {mostPL && (
            <div className="bg-bg-elevated border border-gold/20 rounded-xl p-4 text-center">
              <p className="text-[10px] font-semibold text-gold uppercase tracking-widest mb-3">
                Most League Titles
              </p>
              <Image
                src={getTeamLogo(mostPL[1].team.logo_league_folder, mostPL[1].team.logo_team_slug, 'news_thumb')}
                alt={mostPL[1].team.name}
                width={48} height={48}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-text-primary text-sm">{mostPL[1].team.name}</p>
              <p className="text-2xl font-black text-gold mt-1">{mostPL[1].byType['league']}</p>
              <p className="text-[10px] text-text-muted">league titles</p>
            </div>
          )}

          {mostUCL && (
            <div className="bg-bg-elevated border border-blue-500/20 rounded-xl p-4 text-center">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mb-3">
                Most UCL Wins
              </p>
              <Image
                src={getTeamLogo(mostUCL[1].team.logo_league_folder, mostUCL[1].team.logo_team_slug, 'news_thumb')}
                alt={mostUCL[1].team.name}
                width={48} height={48}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-text-primary text-sm">{mostUCL[1].team.name}</p>
              <p className="text-2xl font-black text-blue-400 mt-1">{mostUCL[1].byType['tournament_club']}</p>
              <p className="text-[10px] text-text-muted">UCL titles</p>
            </div>
          )}
        </div>

        {allTimeRecords.length > 0 && (
          <details className="bg-bg-elevated border border-border rounded-xl group">
            <summary className="cursor-pointer list-none flex items-center justify-between p-4 text-sm font-semibold text-text-secondary group-open:text-text-primary min-h-[48px]">
              <span>Full Trophy Cabinet Rankings</span>
              <span className="text-text-muted text-xs group-open:hidden">Tap to expand</span>
              <span className="text-text-muted text-xs hidden group-open:inline">Collapse</span>
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {allTimeRecords.map(([tid, data], idx) => (
                <Link key={tid} href={`/teams/${tid}`} className="flex items-center gap-3 bg-bg-surface border border-border rounded-lg p-3 hover:border-gold/40 transition-colors min-h-[48px]">
                  <span className="text-text-muted text-xs w-5 shrink-0 font-bold">#{idx + 1}</span>
                  <Image
                    src={getTeamLogo(data.team.logo_league_folder, data.team.logo_team_slug, 'standings_row')}
                    alt={data.team.name}
                    width={28} height={28}
                    className="object-contain shrink-0"
                  />
                  <span className="font-semibold text-sm text-text-primary flex-1 truncate">{data.team.name}</span>
                  <span className="font-black text-gold text-lg">{data.total}</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gold" />
          Season Archives
        </h2>

        {seasons.length === 0 ? (
          <div className="bg-bg-elevated border border-border rounded-xl p-8 text-center text-text-muted">
            No season results recorded yet. History is being written.
          </div>
        ) : (
          <div className="space-y-4">
            {seasons.map(([seasonName, seasonTrophies]) => {
              const byType: Record<string, TrophyWithRelations> = {}
              for (const t of seasonTrophies) {
                byType[t.trophy_type] = t
              }

              return (
                <div key={seasonName} className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-gold/10 to-transparent border-b border-border flex items-center justify-between">
                    <h3 className="font-black text-text-primary text-base">{seasonName}</h3>
                    <span className="text-[10px] text-text-muted">{seasonTrophies.length} title{seasonTrophies.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="p-4 space-y-3">
                    {(['league', 'tournament_club', 'tournament_international', 'friendlies'] as const).map((type) => {
                      const winner = byType[type]
                      return (
                        <div key={type} className={`rounded-xl border p-4 text-center ${winner ? TROPHY_COLOR[type] : 'border-border opacity-40'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${winner ? TROPHY_TEXT[type] : 'text-text-muted'}`}>
                            {TROPHY_ICONS[type]} {TROPHY_LABEL[type]}
                          </p>
                          {winner ? (
                            <Link href={`/teams/${winner.team.id}`} className="block">
                              <Image src={getTeamLogo(winner.team.logo_league_folder, winner.team.logo_team_slug, 'profile_avatar')} alt={winner.team.name} width={48} height={48} className="object-contain mx-auto mb-2" />
                              <p className="font-bold text-text-primary text-sm leading-snug">{winner.team.name}</p>
                              <p className="text-[10px] text-text-muted mt-0.5">{winner.tournament?.name}</p>
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
