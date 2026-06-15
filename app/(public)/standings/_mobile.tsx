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
    <div className="space-y-1">
      {rows.map((row: any, index: number) => {
        const gd = goalDifference(row)
        const qualifies = mode === 'group' && index < qualifiersPerGroup
        const qualifierBorder = mode === 'league'
          ? index < 12 ? 'border-l-accent' : index < 20 ? 'border-l-blue-500' : 'border-l-transparent'
          : qualifies ? 'border-l-accent' : 'border-l-transparent'

        return (
          <Link
            key={row.id ?? `${row.team_id}-${index}`}
            href={`/teams/${row.team_id}`}
            className={`flex items-center gap-3 px-3 py-2.5 min-h-[48px] border-l-4 ${qualifierBorder} ${index % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'} active:bg-accent/10 transition-colors`}
          >
            <span className="w-5 text-center font-bold text-text-muted text-xs">{index + 1}</span>

            <div className="flex items-center gap-2 flex-1 min-w-0">
              {row.team?.logo_league_folder && (
                <TeamLogo
                  leagueFolder={row.team.logo_league_folder}
                  teamSlug={row.team.logo_team_slug}
                  context="standings_row"
                  alt={row.team.name}
                  className="w-7 h-7 shrink-0"
                />
              )}
              <span className="font-semibold text-text-primary text-sm truncate">{row.team?.name ?? 'Unknown team'}</span>
              {qualifies && (
                <span className="text-[9px] font-black text-accent border border-accent/30 rounded px-1 py-0.5 shrink-0">Q</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <StatBox value={row.played ?? 0} label="P" />
                <StatBox value={row.wins ?? 0} label="W" />
                <StatBox value={row.draws ?? 0} label="D" />
                <StatBox value={row.losses ?? 0} label="L" />
              </div>
              <span className={`text-xs font-semibold w-8 text-right ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>
                {gd > 0 ? `+${gd}` : gd}
              </span>
              <span className="text-sm font-black text-accent w-8 text-right">{row.points ?? 0}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0">
      <span className="text-xs font-bold text-text-primary leading-tight">{value}</span>
      <span className="text-[9px] text-text-muted uppercase leading-tight">{label}</span>
    </span>
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
      <div className="px-4 py-12 text-center">
        <p className="text-text-secondary text-sm">No active tournaments.</p>
      </div>
    )
  }

  return (
    <div className="px-3 pb-6 space-y-4">
      {tournaments && tournaments.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-3 px-3 snap-x snap-mandatory">
          {tournaments.map((t: any) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`snap-start shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border min-h-[44px] flex items-center ${
                  isActive
                    ? 'bg-accent text-bg-base border-accent'
                    : 'bg-transparent text-text-muted border-border'
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
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-bold text-text-primary">League Standings</h2>
          </div>
          {leagueStandings.length > 0 ? (
            <>
              <StandingsCard rows={leagueStandings} mode="league" />
              <div className="flex gap-4 px-3 py-2 text-[10px] text-text-muted border-t border-border">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />UCL</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Europa</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : activeTournament?.type === 'tournament_club' || activeTournament?.type === 'tournament_international' ? (
        <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <h2 className="text-sm font-bold text-text-primary">Group Standings</h2>
          </div>
          {Object.keys(groupStandings).length > 0 ? (
            <div className="divide-y divide-border">
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="px-3 py-3 space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">{formatGroupTitle(groupName)}</h3>
                    <StandingsCard rows={rows} mode="group" qualifiersPerGroup={activeTournament?.settings?.qualifiers_per_group ?? 2} />
                  </div>
                ))}
              <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                Top {activeTournament?.settings?.qualifiers_per_group ?? 2} qualify
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
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
