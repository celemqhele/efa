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

function StandingsCard({ rows, mode, qualifiersPerGroup = 2 }: { rows: any[]; mode: 'league' | 'group'; qualifiersPerGroup?: number }) {
  return (
    <div className="divide-y divide-border/50">
      {rows.map((row: any, index: number) => {
        const gd = goalDifference(row)
        const qualifies = mode === 'group' && index < qualifiersPerGroup
        const qualifierBorder = mode === 'league'
          ? index < 12 ? 'border-l-accent' : index < 20 ? 'border-l-blue-500' : 'border-l-border'
          : qualifies ? 'border-l-accent' : 'border-l-border'

        const rankBadge = mode === 'league' && index < 3
          ? 'bg-accent/15 text-accent border-accent/30'
          : 'bg-bg-base text-text-muted border-border'

        return (
          <Link
            key={row.id ?? `${row.team_id}-${index}`}
            href={`/teams/${row.team_id}`}
            className={`flex items-center gap-3 px-4 py-3 min-h-[52px] border-l-4 ${qualifierBorder} bg-bg-surface active:bg-accent/10 transition-colors`}
          >
            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border ${rankBadge}`}>
              {index + 1}
            </span>

            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {row.team?.logo_league_folder && (
                <TeamLogo
                  leagueFolder={row.team.logo_league_folder}
                  teamSlug={row.team.logo_team_slug}
                  context="standings_row"
                  alt={row.team.name}
                  className="w-8 h-8 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary text-sm leading-tight truncate">{row.team?.name ?? 'Unknown team'}</span>
                  {qualifies && (
                    <span className="text-[10px] font-black text-accent border border-accent/30 rounded px-1.5 py-0.5 shrink-0">Q</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-bg-base">
                <span className="text-[11px] font-bold text-text-primary">{row.wins ?? 0}</span>
                <span className="text-[9px] text-text-muted">W</span>
                <span className="text-[11px] text-text-primary">{row.draws ?? 0}</span>
                <span className="text-[9px] text-text-muted">D</span>
                <span className="text-[11px] text-text-primary">{row.losses ?? 0}</span>
                <span className="text-[9px] text-text-muted">L</span>
              </div>
              <span className={`text-xs font-semibold w-7 text-right ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </span>
              <span className="text-base font-black text-accent w-8 text-right tabular-nums">{row.points ?? 0}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

interface MobileProps {
  data: {
    tournaments: any[]
    activeTournamentId: string | null
    activeTournament: any | null
    leagueStandings: any[]
    groupStandings: Record<string, any[]>
  }
}

export default function Mobile({ data }: MobileProps) {
  const { tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings } = data

  if (!activeTournamentId || !activeTournament) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-text-secondary text-sm">No active tournaments.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-8 space-y-5">
      {tournaments && tournaments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 snap-x snap-mandatory">
          {tournaments.map((t: any) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`snap-start shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border min-h-[44px] flex items-center ${
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
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
            <h2 className="text-sm font-bold text-text-primary">League Standings</h2>
          </div>
          {leagueStandings.length > 0 ? (
            <>
              <StandingsCard rows={leagueStandings} mode="league" />
              <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-bg-base/50">
                <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                  UCL
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  Europa
                </span>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : activeTournament?.type === 'tournament_club' || activeTournament?.type === 'tournament_international' ? (
        <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
            <h2 className="text-sm font-bold text-text-primary">Group Standings</h2>
          </div>
          {Object.keys(groupStandings).length > 0 ? (
            <div className="divide-y divide-border/50">
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="px-4 py-4 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                      <span className="w-0.5 h-4 rounded-full bg-accent/40" />
                      {formatGroupTitle(groupName)}
                    </h3>
                    <StandingsCard rows={rows} mode="group" qualifiersPerGroup={activeTournament?.settings?.qualifiers_per_group ?? 2} />
                  </div>
                ))}
              <div className="flex items-center gap-1.5 px-4 py-3 text-[11px] text-text-muted bg-bg-base/50">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent shrink-0" />
                Top {activeTournament?.settings?.qualifiers_per_group ?? 2} qualify
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center">
          <p className="text-text-secondary text-sm">No standings available for this tournament type.</p>
        </div>
      )}
    </div>
  )
}
