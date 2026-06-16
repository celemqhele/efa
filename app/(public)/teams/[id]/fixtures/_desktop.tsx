'use client'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'

const STATUS_STYLES: Record<string, { label: string; pill: string }> = {
  scheduled: { label: 'Scheduled', pill: 'bg-text-muted/20 text-text-muted border-text-muted/30' },
  awaiting_confirmation: { label: 'Awaiting', pill: 'bg-feedback-warning/20 text-feedback-warning border-feedback-warning/30' },
  confirmed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  completed: { label: 'FT', pill: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30' },
  abandoned: { label: 'Abandoned', pill: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30' },
}

const TYPE_LABELS: Record<string, string> = {
  league: 'PL',
  tournament_club: 'Tournament',
  tournament_international: 'Intl',
  friendlies: 'Friendly',
}

function formatWhen(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  try {
    const d = new Date(dateStr)
    const datePart = d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
    const timePart = d.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    })
    return `${datePart} · ${timePart}`
  } catch {
    return dateStr
  }
}

export default function Desktop({ data }: { data: any }) {
  const { team, siblingIds, upcoming, past, resultsByFixture } = data

  const allFixtures = [
    ...upcoming.map((f: any) => ({ ...f, _section: 'upcoming' as const })),
    ...past.map((f: any) => ({ ...f, _section: 'past' as const })),
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/teams/${team.id}`}
          className="w-10 h-10 rounded-lg flex items-center justify-center border border-border text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
        >
          ‹
        </Link>
        <div className="flex items-center gap-3">
          {team.logo_league_folder && (
            <TeamLogo
              leagueFolder={team.logo_league_folder}
              teamSlug={team.logo_team_slug}
              context="standings_row"
              alt={team.name}
              className="w-12 h-12"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Fixtures & Results</h1>
            <p className="text-sm text-accent font-medium">{team.name}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent" /> {upcoming.length} Upcoming</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-feedback-success" /> {past.length} Results</span>
        </div>
      </div>

      {/* Unified table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-light/30 border-b border-border/60">
                <th className="text-left py-4 px-6 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Competition</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Opponent</th>
                <th className="text-center py-4 px-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Score</th>
                <th className="text-center py-4 pl-4 pr-6 text-[10px] font-bold text-text-muted uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {allFixtures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-text-muted">No fixtures found for this team.</td>
                </tr>
              ) : (
                allFixtures.map((f: any) => {
                  const homeTeam = Array.isArray(f.home_team) ? f.home_team[0] : f.home_team
                  const awayTeam = Array.isArray(f.away_team) ? f.away_team[0] : f.away_team

                  const isHome = homeTeam ? siblingIds.includes(homeTeam.id) : siblingIds.includes(f.home_team_id)
                  const opponent = isHome ? awayTeam : homeTeam

                  const result = resultsByFixture[f.id]

                  const myScore = isHome ? result?.home_score : result?.away_score
                  const oppScore = isHome ? result?.away_score : result?.home_score

                  const hasResult = result != null && myScore != null && oppScore != null
                  const won = hasResult && myScore > oppScore
                  const lost = hasResult && myScore < oppScore
                  const drew = hasResult && myScore === oppScore

                  const tournament = f.tournament
                  const tournamentType = tournament?.type ?? 'unknown'
                  const tournamentLabel = TYPE_LABELS[tournamentType] ?? tournament?.name ?? '—'
                  const statusInfo = STATUS_STYLES[f.status] ?? STATUS_STYLES['scheduled']

                  let resultBadge: React.ReactNode = null
                  if (won) {
                    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-feedback-success/20 text-feedback-success border border-feedback-success/30">W</span>
                  } else if (lost) {
                    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-feedback-error/20 text-feedback-error border border-feedback-error/30">L</span>
                  } else if (drew) {
                    resultBadge = <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-text-muted/20 text-text-muted border border-text-muted/30">D</span>
                  }

                  return (
                    <tr
                      key={f.id}
                      className="border-b border-border/20 transition-colors hover:bg-black/[0.02] cursor-pointer"
                      onClick={() => window.location.href = result ? `/results/${result.id}` : `/fixtures/${f.id}`}
                    >
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="text-xs text-text-muted font-mono">{formatWhen(f.scheduled_date)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-xs font-semibold text-text-primary">{tournamentLabel}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {opponent?.logo_league_folder ? (
                            <TeamLogo
                              leagueFolder={opponent.logo_league_folder}
                              teamSlug={opponent.logo_team_slug}
                              context="standings_row"
                              alt={opponent.name}
                              className="w-7 h-7 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-bg-base shrink-0 flex items-center justify-center text-[9px] text-text-muted">?</div>
                          )}
                          <span className="text-sm font-semibold text-text-primary">
                            {isHome ? 'vs' : '@'} {opponent?.name ?? 'TBC'}
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-4 px-4">
                        {result ? (
                          <span className={`text-base font-black tabular-nums ${
                            won ? 'text-feedback-success' : lost ? 'text-feedback-error' : 'text-text-primary'
                          }`}>
                            {myScore}–{oppScore}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="text-center py-4 pl-4 pr-6">
                        <div className="flex items-center justify-center gap-2">
                          {resultBadge}
                          {!result && (
                            <span className={`text-[9px] px-2 py-0.5 rounded border font-semibold ${statusInfo.pill}`}>
                              {statusInfo.label}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
