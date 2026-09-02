'use client'

import TeamLogo from '@/components/ui/TeamLogo'
import { useRouter } from 'next/navigation'
import { goalDifference, normalizeStandingsZones, rowZone, ZONE_BORDER_CLASS, zoneLegend, type StandingsZones } from '@/lib/standings-core'

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

function StandingsTable({ rows, mode, qualifiersPerGroup = 2, zones }: { rows: any[]; mode: 'league' | 'group'; qualifiersPerGroup?: number; zones?: StandingsZones | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-base">
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">#</th>
            <th className="text-left text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2">Team</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">P</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">W</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">D</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">L</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-8">A</th>
            <th className="text-center text-text-muted font-semibold uppercase tracking-wider text-[11px] px-2 py-2 w-12">GD</th>
            <th className="text-center text-accent font-bold uppercase tracking-wider text-[11px] px-2 py-2 w-12 bg-accent/5">Pts</th>
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
                className={`border-l-4 ${borderColor} ${index % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base'} hover:bg-accent/5 transition-colors cursor-pointer`}
                onClick={() => window.location.href = `/teams/${row.team_id}`}
              >
                <td className={`text-center font-bold px-2 py-2 tabular-nums ${isTopThree ? 'text-accent' : 'text-text-muted'}`}>{index + 1}</td>
                <td className="px-2 py-2 min-w-0">
                  <div className="flex items-center gap-2">
                    {row.team?.logo_league_folder && (
                      <TeamLogo
                        leagueFolder={row.team.logo_league_folder}
                        teamSlug={row.team.logo_team_slug}
                        context="standings_row"
                        alt={row.team.name}
                        className="w-6 h-6 shrink-0"
                      />
                    )}
                    <span className="font-semibold text-text-primary truncate text-sm">{row.team?.name ?? 'Unknown team'}</span>
                    {qualifies && (
                      <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-md px-1.5 py-0.5 shrink-0">Q</span>
                    )}
                  </div>
                </td>
                <td className="text-center font-medium text-text-secondary px-2 py-2 tabular-nums text-sm">{row.played ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-2 py-2 tabular-nums text-sm">{row.wins ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-2 py-2 tabular-nums text-sm">{row.draws ?? 0}</td>
                <td className="text-center font-medium text-text-secondary px-2 py-2 tabular-nums text-sm">{row.losses ?? 0}</td>
                <td className={`text-center font-medium px-2 py-2 tabular-nums text-sm ${(row.absent ?? 0) > 0 ? 'text-orange-400' : 'text-text-secondary'}`}>{row.absent ?? 0}</td>
                <td className={`text-center font-semibold px-2 py-2 tabular-nums text-sm ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>{gd > 0 ? `+${gd}` : gd}</td>
                <td className="text-center font-black text-accent px-2 py-2 tabular-nums text-sm bg-accent/[0.03]">{row.points ?? 0}</td>
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
  const router = useRouter()
  const { tournaments, activeTournamentId, activeTournament, leagueStandings, groupStandings } = data

  if (!activeTournamentId || !activeTournament) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary text-sm">No active tournaments.</p>
      </div>
    )
  }

  return (
    <div className="max-w-[760px] mx-auto space-y-3">
      {tournaments && tournaments.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider shrink-0">Tournament</label>
          <select
            value={activeTournamentId}
            onChange={(e) => router.push(`/standings?tournament=${e.target.value}`)}
            className="bg-bg-surface border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 cursor-pointer"
          >
            {tournaments.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.division && t.type === 'league' ? ` — Division ${t.division}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTournament?.type === 'league' ? (
        <div className="bg-bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
            {activeTournament?.name && (
              <p className="text-xs text-text-muted font-medium">{activeTournament.name}</p>
            )}
          </div>
          {leagueStandings.length > 0 ? (
            <div className="p-4 space-y-3">
              <StandingsTable rows={leagueStandings} mode="league" zones={normalizeStandingsZones(activeTournament?.settings)} />
              <div className="flex gap-5 text-[11px] text-text-muted">
                {zoneLegend(normalizeStandingsZones(activeTournament?.settings)).map((item) => (
                  <span key={item.label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${ZONE_SWATCH_CLASS[item.color]}`} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </div>
      ) : activeTournament?.type === 'tournament_club' || activeTournament?.type === 'tournament_international' ? (
        <div className="bg-bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
            {activeTournament?.name && (
              <p className="text-xs text-text-muted font-medium">{activeTournament.name}</p>
            )}
          </div>
          {Object.keys(groupStandings).length > 0 ? (
            <div className="p-4 space-y-5">
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-2">
                      <span className="w-0.5 h-3 rounded-full bg-accent/40" />
                      {formatGroupTitle(groupName)}
                    </h3>
                    <StandingsTable rows={rows} mode="group" qualifiersPerGroup={activeTournament?.settings?.qualifiers_per_group ?? 2} />
                  </div>
                ))}
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                Top {activeTournament?.settings?.qualifiers_per_group ?? 2} qualify
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-text-muted">No teams found for this tournament.</div>
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
