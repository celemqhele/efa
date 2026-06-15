import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import { Trophy, Star, Globe, Medal } from 'lucide-react'

const TROPHY_ICONS: Record<string, React.ReactNode> = {
  league: <Trophy className="w-4 h-4 text-accent" />,
  tournament_club: <Star className="w-4 h-4 text-accent" />,
  tournament_international: <Globe className="w-4 h-4 text-accent" />,
  friendlies: <Medal className="w-4 h-4 text-accent" />,
}

export const revalidate = 300

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

export default async function HallOfFamePage() {
  const supabase = await createClient()

  // All trophies with full relations
  const { data: trophiesRaw } = await supabase
    .from('trophies')
    .select(
      `*,
      team:teams(id, name, logo_league_folder, logo_team_slug),
      tournament:tournaments(id, name, type),
      season:seasons(id, name)`
    )
    .order('awarded_at', { ascending: false })

  const trophies = (trophiesRaw ?? []) as unknown as TrophyWithRelations[]

  // Group by season name
  const seasonMap: Record<string, TrophyWithRelations[]> = {}
  for (const t of trophies) {
    const sName = t.season?.name ?? 'Unknown Season'
    if (!seasonMap[sName]) seasonMap[sName] = []
    seasonMap[sName].push(t)
  }
  const seasons = Object.entries(seasonMap).sort((a, b) =>
    b[0].localeCompare(a[0])
  )

  // All-time stats: trophy counts per team
  const teamTrophyMap: Record<
    string,
    {
      team: TrophyWithRelations['team']
      total: number
      byType: Record<string, number>
    }
  > = {}
  for (const t of trophies) {
    const tid = t.team_id
    if (!teamTrophyMap[tid]) {
      teamTrophyMap[tid] = { team: t.team, total: 0, byType: {} }
    }
    teamTrophyMap[tid].total++
    teamTrophyMap[tid].byType[t.trophy_type] =
      (teamTrophyMap[tid].byType[t.trophy_type] ?? 0) + 1
  }

  const allTimeRecords = Object.entries(teamTrophyMap)
    .sort((a, b) => b[1].total - a[1].total)

  const mostPL = allTimeRecords.find(([, d]) => (d.byType['league'] ?? 0) > 0)
  const mostUCL = allTimeRecords.find(([, d]) => (d.byType['tournament_club'] ?? 0) > 0)
  const mostTotal = allTimeRecords[0]

  return (
    <div className="space-y-10">
      {/* -- Page Header ---------------------------------------------------- */}
      <div className="text-center py-6">
        <p className="text-gold text-sm font-semibold uppercase tracking-widest mb-2">
          EFA Official Records
        </p>
        <h1 className="text-4xl font-black text-foreground-primary">Hall of Fame</h1>
        <p className="text-text-muted text-sm mt-2">
          Champions, records, and legends of the EFA
        </p>
      </div>

      {/* -- All-Time Records ----------------------------------------------- */}
      <div>
        <h2 className="section-header">
          <span className="text-gold">??</span> All-Time Records
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Most Trophies */}
          {mostTotal && (
            <div className="card p-5 border-gold/30 bg-gradient-to-br from-gold/5 to-transparent text-center">
              <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-3">
                Most Trophies Overall
              </p>
              <Image
                src={getTeamLogo(
                  mostTotal[1].team.logo_league_folder,
                  mostTotal[1].team.logo_team_slug,
                  'news_thumb'
                )}
                alt={mostTotal[1].team.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-foreground-primary">{mostTotal[1].team.name}</p>
              <p className="text-3xl font-black text-gold mt-1">
                {mostTotal[1].total}
              </p>
              <p className="text-xs text-text-muted">trophies</p>
            </div>
          )}

          {/* Most PL Wins */}
          {mostPL && (
            <div className="card p-5 border-gold/20 text-center">
              <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-3">
                ?? Most League Titles
              </p>
              <Image
                src={getTeamLogo(
                  mostPL[1].team.logo_league_folder,
                  mostPL[1].team.logo_team_slug,
                  'news_thumb'
                )}
                alt={mostPL[1].team.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-foreground-primary">{mostPL[1].team.name}</p>
              <p className="text-3xl font-black text-gold mt-1">
                {mostPL[1].byType['league']}
              </p>
              <p className="text-xs text-text-muted">league titles</p>
            </div>
          )}

          {/* Most UCL Wins */}
          {mostUCL && (
            <div className="card p-5 border-blue-500/20 text-center">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
                ? Most UCL Wins
              </p>
              <Image
                src={getTeamLogo(
                  mostUCL[1].team.logo_league_folder,
                  mostUCL[1].team.logo_team_slug,
                  'news_thumb'
                )}
                alt={mostUCL[1].team.name}
                width={64}
                height={64}
                className="object-contain mx-auto mb-2"
              />
              <p className="font-bold text-foreground-primary">{mostUCL[1].team.name}</p>
              <p className="text-3xl font-black text-blue-400 mt-1">
                {mostUCL[1].byType['tournament_club']}
              </p>
              <p className="text-xs text-text-muted">UCL titles</p>
            </div>
          )}
        </div>

        {/* Full all-time table */}
        {allTimeRecords.length > 0 && (
          <details className="mt-4 card p-5 group">
            <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-semibold text-foreground-secondary group-open:text-foreground-primary">
              <span>Full Trophy Cabinet Rankings</span>
              <span className="text-text-muted text-xs group-open:hidden">Tap to expand</span>
              <span className="text-text-muted text-xs hidden group-open:inline">Collapse</span>
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-navy-border">
                    <th className="pb-2 pr-4">Team</th>
                    <th className="pb-2 text-center pr-3">Total</th>
                    <th className="pb-2 text-center pr-3">?? PL</th>
                    <th className="pb-2 text-center pr-3">? UCL</th>
                    <th className="pb-2 text-center pr-3">?? UEL</th>
                    <th className="pb-2 text-center">?? SC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-border/40">
                  {allTimeRecords.map(([tid, data], idx) => (
                    <tr
                      key={tid}
                      className="text-foreground-secondary hover:bg-navy-border/20 transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/teams/${tid}`}
                          className="flex items-center gap-2 hover:text-gold transition-colors"
                        >
                          <span className="text-foreground-muted text-xs w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <Image
                            src={getTeamLogo(
                              data.team.logo_league_folder,
                              data.team.logo_team_slug,
                              'standings_row'
                            )}
                            alt={data.team.name}
                            width={28}
                            height={28}
                            className="object-contain shrink-0"
                          />
                          <span className="font-semibold truncate">{data.team.name}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 text-center font-black text-gold">
                        {data.total}
                      </td>
                      <td className="py-2.5 text-center">
                        {data.byType['league'] ?? '—'}
                      </td>
                      <td className="py-2.5 text-center">
                        {data.byType['tournament_club'] ?? '—'}
                      </td>
                      <td className="py-2.5 text-center">
                        {data.byType['tournament_international'] ?? '—'}
                      </td>
                      <td className="py-2.5 text-center">
                        {data.byType['friendlies'] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* -- Season Archives ------------------------------------------------- */}
      <div>
        <h2 className="section-header">
          <span className="text-gold">??</span> Season Archives
        </h2>

        {seasons.length === 0 ? (
          <div className="card p-8 text-center text-text-muted">
            No season results recorded yet. History is being written.
          </div>
        ) : (
          <div className="space-y-6">
            {seasons.map(([seasonName, seasonTrophies]) => {
              // Group by trophy type within this season
              const byType: Record<string, TrophyWithRelations> = {}
              for (const t of seasonTrophies) {
                byType[t.trophy_type] = t
              }

              return (
                <div key={seasonName} className="card overflow-hidden">
                  {/* Season Header */}
                  <div className="px-5 py-3 bg-gradient-to-r from-gold/10 to-transparent border-b border-navy-border flex items-center justify-between">
                    <h3 className="font-black text-foreground-primary text-lg">{seasonName}</h3>
                    <span className="text-xs text-text-muted">
                      {seasonTrophies.length} title{seasonTrophies.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(['league', 'tournament_club', 'tournament_international', 'friendlies'] as const).map((type) => {
                      const winner = byType[type]
                      return (
                        <div
                          key={type}
                          className={`rounded-xl border p-4 text-center ${
                            winner ? TROPHY_COLOR[type] : 'border-navy-border opacity-40'
                          }`}
                        >
                          <p
                            className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                              winner ? TROPHY_TEXT[type] : 'text-foreground-muted'
                            }`}
                          >
                            {TROPHY_ICONS[type]} {TROPHY_LABEL[type]}
                          </p>

                          {winner ? (
                            <>
                              <Link href={`/teams/${winner.team.id}`} className="block hover:opacity-90 transition-opacity">
                                <Image
                                  src={getTeamLogo(
                                    winner.team.logo_league_folder,
                                    winner.team.logo_team_slug,
                                    'profile_avatar'
                                  )}
                                  alt={winner.team.name}
                                  width={64}
                                  height={64}
                                  className="object-contain mx-auto mb-2"
                                />
                                <p className="font-bold text-foreground-primary text-sm leading-snug">
                                  {winner.team.name}
                                </p>
                                <p className="text-xs text-text-muted mt-0.5">
                                  {winner.tournament?.name}
                                </p>
                              </Link>
                            </>
                          ) : (
                            <div className="py-4">
                              <p className="text-foreground-muted text-xs">Not awarded</p>
                            </div>
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

