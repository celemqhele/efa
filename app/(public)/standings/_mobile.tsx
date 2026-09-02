'use client'

import { useState } from 'react'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { goalDifference, normalizeStandingsZones, rowZone, ZONE_BORDER_CLASS, zoneLegend, type StandingsZones } from '@/lib/standings-core'
import { ListCollapse, List } from 'lucide-react'

const ZONE_SWATCH_CLASS: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
}

function formatGroupTitle(groupName: string) {
  const clean = String(groupName ?? '').trim()
  if (!clean) return 'Group A'
  return /^group\s+/i.test(clean) ? clean : `Group ${clean}`
}

function StandingsCard({ rows, mode, qualifiersPerGroup = 2, extended, zones }: { rows: any[]; mode: 'league' | 'group'; qualifiersPerGroup?: number; extended: boolean; zones?: StandingsZones | null }) {
  if (extended) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-base">
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">#</th>
              <th className="text-left text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5">Team</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">P</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">W</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">D</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">L</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-6">A</th>
              <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-8">GD</th>
              <th className="text-center text-accent font-bold uppercase tracking-wider text-[10px] px-1.5 py-1.5 w-8 bg-accent/5">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, index: number) => {
              const gd = goalDifference(row)
              const qualifies = mode === 'group' && index < qualifiersPerGroup
              const isTopThree = mode === 'league' && index < 3
              const zone = mode === 'league' ? rowZone(zones, index, rows.length) : null
              const borderColor = mode === 'league'
                ? (zone ? ZONE_BORDER_CLASS[zone] : 'border-l-transparent')
                : qualifies ? 'border-l-accent' : 'border-l-transparent'

              return (
                <tr
                  key={row.id ?? `${row.team_id}-${index}`}
                  className={`border-l-4 ${borderColor} ${index % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base'}`}
                  onClick={() => window.location.href = `/teams/${row.team_id}`}
                >
                  <td className={`text-center font-bold px-1.5 py-1.5 tabular-nums text-xs ${isTopThree ? 'text-accent' : 'text-text-muted'}`}>{index + 1}</td>
                  <td className="px-1.5 py-1.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {row.team?.logo_league_folder && (
                        <TeamLogo
                          leagueFolder={row.team.logo_league_folder}
                          teamSlug={row.team.logo_team_slug}
                          context="standings_row"
                          alt={row.team.name}
                          className="w-5 h-5 shrink-0"
                        />
                      )}
                      <span className="font-semibold text-text-primary truncate text-xs">{row.team?.name ?? 'Unknown team'}</span>
                      {qualifies && (
                        <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded px-1 py-0.5 shrink-0">Q</span>
                      )}
                    </div>
                  </td>
                  <td className="text-center font-medium text-text-secondary px-1.5 py-1.5 tabular-nums text-xs">{row.played ?? 0}</td>
                  <td className="text-center font-medium text-text-secondary px-1.5 py-1.5 tabular-nums text-xs">{row.wins ?? 0}</td>
                  <td className="text-center font-medium text-text-secondary px-1.5 py-1.5 tabular-nums text-xs">{row.draws ?? 0}</td>
                  <td className="text-center font-medium text-text-secondary px-1.5 py-1.5 tabular-nums text-xs">{row.losses ?? 0}</td>
                  <td className={`text-center font-medium px-1.5 py-1.5 tabular-nums text-xs ${(row.absent ?? 0) > 0 ? 'text-orange-400' : 'text-text-secondary'}`}>{row.absent ?? 0}</td>
                  <td className={`text-center font-semibold px-1.5 py-1.5 tabular-nums text-xs ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>{gd > 0 ? `+${gd}` : gd}</td>
                  <td className="text-center font-black text-accent px-1.5 py-1.5 tabular-nums text-xs bg-accent/[0.03]">{row.points ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {rows.map((row: any, index: number) => {
        const qualifies = mode === 'group' && index < qualifiersPerGroup
        const zone = mode === 'league' ? rowZone(zones, index, rows.length) : null
        const qualifierBorder = mode === 'league'
          ? (zone ? ZONE_BORDER_CLASS[zone] : 'border-l-border')
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

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-text-muted font-semibold uppercase">GP</span>
                <span className="text-sm font-bold text-text-primary tabular-nums">{row.played ?? 0}</span>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-text-muted font-semibold uppercase">Pts</span>
                <span className="text-base font-black text-accent tabular-nums">{row.points ?? 0}</span>
              </div>
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
  const [extended, setExtended] = useState(false)

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
                {t.name}{t.division && t.type === 'league' ? ` — Division ${t.division}` : ''}
              </Link>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <button
          onClick={() => setExtended(!extended)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
            extended
              ? 'bg-accent text-bg-base border-accent'
              : 'bg-bg-surface text-text-muted border-border'
          }`}
        >
          {extended ? <ListCollapse className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          {extended ? 'Minimised' : 'Full Table'}
        </button>
      </div>

      {activeTournament?.type === 'league' ? (
        <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
            <h2 className="text-sm font-bold text-text-primary">League Standings</h2>
          </div>
          {leagueStandings.length > 0 ? (
            <>
              <StandingsCard rows={leagueStandings} mode="league" extended={extended} zones={normalizeStandingsZones(activeTournament?.settings)} />
              <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-bg-base/50">
                {zoneLegend(normalizeStandingsZones(activeTournament?.settings)).map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <span className={`w-2.5 h-2.5 rounded-sm ${ZONE_SWATCH_CLASS[item.color]}`} />
                    {item.label}
                  </span>
                ))}
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
                    <StandingsCard rows={rows} mode="group" qualifiersPerGroup={activeTournament?.settings?.qualifiers_per_group ?? 2} extended={extended} />
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
