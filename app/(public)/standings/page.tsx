import { createClient } from '@/lib/supabase/server'
import TeamLogo from '@/components/ui/TeamLogo'
import Link from 'next/link'
import { buildLiveStandings, goalDifference } from '@/lib/standings-core'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tournament?: string }>
}

const TOURNAMENT_TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  ucl: 'UCL',
  europa: 'Europa',
  super_cup: 'Super Cup',
}

function formatGroupTitle(groupName: string) {
  const clean = String(groupName ?? '').trim()
  if (!clean) return 'Group A'
  return /^group\s+/i.test(clean) ? clean : `Group ${clean}`
}

function StandingsTable({ rows, mode }: { rows: any[]; mode: 'league' | 'group' }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-surface">
      <div className="grid grid-cols-[28px_1fr_30px_30px_36px_40px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-1 sm:gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-subtle">
        <span className="text-center">#</span>
        <span>Team</span>
        <span className="text-center">P</span>
        <span className="text-center">A</span>
        <span className="hidden sm:block text-center">W</span>
        <span className="hidden sm:block text-center">D</span>
        <span className="hidden sm:block text-center">L</span>
        <span className="text-center">GD</span>
        <span className="text-center text-accent">Pts</span>
      </div>

      {rows.map((row: any, index: number) => {
        const gd = goalDifference(row)
        const qualificationBorder = mode === 'league'
          ? index < 12 ? 'border-l-accent' : index < 20 ? 'border-l-blue-500' : 'border-l-transparent'
          : index < 2 ? 'border-l-accent' : 'border-l-transparent'

        return (
          <Link
            key={row.id ?? `${row.team_id}-${index}`}
            href={`/teams/${row.team_id}`}
            className={`grid grid-cols-[28px_1fr_30px_30px_36px_40px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-1 sm:gap-2 px-3 py-2.5 text-xs border-l-4 ${qualificationBorder} ${index % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'} hover:bg-accent/10 transition-colors cursor-pointer`}
          >
            <span className="text-center font-bold text-text-muted">{index + 1}</span>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {row.team?.logo_league_folder && (
                <TeamLogo
                  leagueFolder={row.team.logo_league_folder}
                  teamSlug={row.team.logo_team_slug}
                  context="standings_row"
                  alt={row.team.name}
                  className="w-6 h-6 sm:w-7 sm:h-7 shrink-0"
                />
              )}
              <span className="font-semibold text-text-primary truncate">{row.team?.name ?? 'Unknown team'}</span>
              {mode === 'group' && index < 2 && (
                <span className="hidden sm:inline text-[9px] font-black text-accent border border-accent/30 rounded px-1 py-0.5">Q</span>
              )}
            </div>

            <span className="text-center text-text-secondary">{row.played ?? 0}</span>
            <span className={`text-center font-medium ${(row.absent ?? 0) > 0 ? 'text-orange-400' : 'text-text-secondary'}`}>{row.absent ?? 0}</span>
            <span className="hidden sm:block text-center text-text-secondary">{row.wins ?? 0}</span>
            <span className="hidden sm:block text-center text-text-secondary">{row.draws ?? 0}</span>
            <span className="hidden sm:block text-center text-text-secondary">{row.losses ?? 0}</span>
            <span className={`text-center font-semibold ${gd >= 0 ? 'text-feedback-success' : 'text-feedback-error'}`}>{gd > 0 ? `+${gd}` : gd}</span>
            <span className="text-center font-black text-accent">{row.points ?? 0}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default async function StandingsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const selectedTournamentId = params.tournament ?? null

  const { data: _tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  const tournaments = (_tournaments ?? []) as any[]

  const requestedTournament = selectedTournamentId
    ? tournaments?.find((t) => t.id === selectedTournamentId)
    : null

  const activeTournamentId = requestedTournament?.id ?? tournaments?.[0]?.id ?? null
  const activeTournament = tournaments?.find((t) => t.id === activeTournamentId)

  if (!activeTournamentId || !activeTournament) {
    return (
      <Card className="p-12 text-center">
        <p className="text-text-secondary text-sm">No active tournaments.</p>
      </Card>
    )
  }

  const { leagueStandings, groupStandings } = await buildLiveStandings(supabase, activeTournamentId, activeTournament.type)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Standings</h1>
        {activeTournament && <p className="text-sm text-accent mt-0.5">{activeTournament.name}</p>}
      </div>

      {tournaments && tournaments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => {
            const isActive = t.id === activeTournamentId
            return (
              <Link
                key={t.id}
                href={`/standings?tournament=${t.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  isActive
                    ? 'bg-accent text-bg-base border-accent'
                    : 'bg-transparent text-text-muted border-border hover:border-accent/50 hover:text-accent'
                }`}
              >
                {TOURNAMENT_TYPE_LABELS[t.type] ?? t.name}
              </Link>
            )
          })}
        </div>
      )}

      {!activeTournamentId ? (
        <Card className="p-12 text-center">
          <p className="text-text-secondary text-sm">No active tournaments.</p>
        </Card>
      ) : activeTournament?.type === 'league' ? (
        <Card className="p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">League Standings</h2>
          </div>

          {leagueStandings.length > 0 ? (
            <>
              <StandingsTable rows={leagueStandings} mode="league" />
              <div className="flex flex-wrap gap-4 text-[10px] text-text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />UCL places</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Europa places</span>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-bg-base p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </Card>
      ) : activeTournament?.type === 'ucl' || activeTournament?.type === 'europa' ? (
        <Card className="p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Group Standings</h2>
          </div>

          {Object.keys(groupStandings).length > 0 ? (
            <>
              {Object.entries(groupStandings)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupName, rows]) => (
                  <div key={groupName} className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-accent">{formatGroupTitle(groupName)}</h3>
                    <StandingsTable rows={rows} mode="group" />
                  </div>
                ))}

              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <span className="w-2.5 h-2.5 rounded-sm bg-accent" />
                Top 2 qualify
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-bg-base p-8 text-center text-sm text-text-muted">No teams found for this tournament.</div>
          )}
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-text-secondary text-sm">No standings available for this tournament type.</p>
        </Card>
      )}
    </div>
  )
}

