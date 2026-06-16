'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { goalDifference } from '@/lib/standings-core'

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Tournament (Clubs)',
  tournament_international: 'Tournament (Intl)',
  friendlies: 'Friendly',
}

function formatGroupTitle(groupName: string) {
  const clean = String(groupName ?? '').trim()
  if (!clean) return 'Group A'
  return /^group\s+/i.test(clean) ? clean : `Group ${clean}`
}

function StandingsTable({ rows, mode, qualifiersPerGroup = 2 }: { rows: any[]; mode: 'league' | 'group'; qualifiersPerGroup?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-accent/30 bg-bg-base">
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">#</th>
            <th className="text-left text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5">Team</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">P</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">W</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">D</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">L</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-10">A</th>
            <th className="text-center text-text-muted font-bold uppercase tracking-wider text-[11px] px-3 py-3.5 w-14">GD</th>
            <th className="text-center text-accent font-black uppercase tracking-wider text-[11px] px-3 py-3.5 w-14 bg-accent/5">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, index: number) => {
            const gd = goalDifference(row)
            const qualifies = mode === 'group' && index < qualifiersPerGroup
            const isTopThree = mode === 'league' && index < 3
            const borderColor = mode === 'league'
              ? index < 12 ? 'border-l-accent' : index < 20 ? 'border-l-blue-500' : 'border-l-transparent'
              : qualifies ? 'border-l-accent' : 'border-l-transparent'

            return (
              <tr
                key={row.id ?? `${row.team_id}-${index}`}
                className={`border-l-4 ${borderColor} ${index % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base'} hover:bg-accent/5 transition-colors cursor-pointer`}
                onClick={() => window.location.href = `/teams/${row.team_id}`}
              >
                <td className={`text-center font-bold px-3 py-3.5 ${isTopThree ? 'text-accent' : 'text-text-muted'}`}>{index + 1}</td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    {row.team?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={row.team.logo_league_folder}
                        teamSlug={row.team.logo_team_slug}
                        context="standings_row"
                        alt={row.team.name}
                        className="w-7 h-7 shrink-0"
                      />
                    )}
                    <span className="font-semibold text-text-primary">{row.team?.name ?? 'Unknown team'}</span>
                    {qualifies && (
                      <span className="text-[10px] font-black text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">Q</span>
                    )}
                  </div>
                </td>
                <td className="text-center font-medium text-text-secondary px-3 py-3.5">{row.played ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-3 py-3.5">{row.wins ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-3 py-3.5">{row.draws ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-3 py-3.5">{row.losses ?? 0}</td>
                <td className={`text-center font-medium px-3 py-3.5 ${(row.absent ?? 0) > 0 ? 'text-orange-400' : 'text-text-secondary'}`}>{row.absent ?? 0}</td>
                <td className={`text-center font-semibold px-3 py-3.5 ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>{gd > 0 ? `+${gd}` : gd}</td>
                <td className="text-center font-black text-accent px-3 py-3.5 bg-accent/[0.03]">{row.points ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface DesktopProps {
  data: {
    tournaments: any[]
    activeTournamentId: string | null
    activeTournament: any | null
    leagueStandings: any[]
    groupStandings: Record<string, any[]>
  }
}

export default function Desktop({ data }: DesktopProps) {
  const { tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings } = data

  if (!activeTournamentId || !activeTournament) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary text-sm">No active tournaments.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t: any) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? 'bg-accent text-bg-base border-accent shadow-sm shadow-accent/25'
                    : 'bg-bg-surface text-text-secondary border-border hover:border-accent/40 hover:text-accent'
                }`}
              >
                {TOURNAMENT_TYPE_LABELS[t.type] ?? t.name}
              </Link>
            )
          })}
        </div>
      )}

      {activeTournament?.type === 'league' ? (
        <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <span className="w-1 h-6 rounded-full bg-accent shrink-0" />
            <div>
              <h2 className="text-base font-bold text-text-primary">League Standings</h2>
              {activeTournament?.name && (
                <p className="text-xs text-text-muted mt-0.5">{activeTournament.name}</p>
              )}
            </div>
          </div>
          {leagueStandings.length > 0 ? (
            <div className="p-6 space-y-4">
              <StandingsTable rows={leagueStandings} mode="league" />
              <div className="flex gap-6 text-xs text-text-muted">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent" />UCL places</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" />Europa places</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : activeTournament?.type === 'tournament_club' || activeTournament?.type === 'tournament_international' ? (
        <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <span className="w-1 h-6 rounded-full bg-accent shrink-0" />
            <div>
              <h2 className="text-base font-bold text-text-primary">Group Standings</h2>
              {activeTournament?.name && (
                <p className="text-xs text-text-muted mt-0.5">{activeTournament.name}</p>
              )}
            </div>
          </div>
          {Object.keys(groupStandings).length > 0 ? (
            <div className="p-6 space-y-6">
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-accent flex items-center gap-2">
                      <span className="w-0.5 h-5 rounded-full bg-accent/40" />
                      {formatGroupTitle(groupName)}
                    </h3>
                    <StandingsTable rows={rows} mode="group" qualifiersPerGroup={activeTournament?.settings?.qualifiers_per_group ?? 2} />
                  </div>
                ))}
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-3 h-3 rounded-sm bg-accent" />
                Top {activeTournament?.settings?.qualifiers_per_group ?? 2} qualify
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-text-secondary text-sm">No standings available for this tournament type.</p>
        </div>
      )}
    </div>
  )
}
