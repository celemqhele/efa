'use client'
import Link from 'next/link'
import TeamLogo from '@/components/ui/TeamLogo'
import ForfeitBadge from '@/components/ui/ForfeitBadge'
import { AlertTriangle, BarChart3, ChevronDown, Camera, ArrowLeft, ChevronRight } from 'lucide-react'

function StatRow({ label, homeVal, awayVal }: { label: string; homeVal: number; awayVal: number }) {
  const total = homeVal + awayVal || 1
  const homePct = Math.round((homeVal / total) * 100)
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="w-8 text-right text-xs font-semibold text-foreground-primary tabular-nums">{homeVal}</span>
      <div className="flex-1">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
          <div className="bg-[#c9a84c] transition-all" style={{ width: `${homePct}%` }} />
          <div className="bg-blue-500 transition-all" style={{ width: `${100 - homePct}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-text-muted font-medium w-16 text-center truncate">{label}</span>
      <div className="flex-1">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
          <div className="bg-blue-500 transition-all" style={{ width: `${100 - homePct}%` }} />
          <div className="bg-[#c9a84c] transition-all" style={{ width: `${homePct}%` }} />
        </div>
      </div>
      <span className="w-8 text-left text-xs font-semibold text-foreground-primary tabular-nums">{awayVal}</span>
    </div>
  )
}

export default function Mobile({ data }: { data: any }) {
  const { result, stats, fixture, home, away, tournament, tournamentColor, aggregateScore, penScore } = data

  return (
    <div className="px-4 pb-8 space-y-5">
      {/* Back */}
      <Link href="/results" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground-secondary transition-colors min-h-[48px]">
        <ArrowLeft className="w-3.5 h-3.5" />
        Results
      </Link>

      {/* Score card */}
      <div className="card p-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.06),transparent_70%)]" />
        <div className="relative">
          {result.is_abandoned && (
            <div className="mb-3 space-y-2">
              <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-[10px] font-medium inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Abandoned ({result.abandoned_type === 'both' ? 'Mutual' : `${result.abandoned_type} team`})
              </div>
              <ForfeitBadge note={`Forfeit: ${result.abandoned_type === 'home' || result.abandoned_type === 'both' ? home?.name : ''}${result.abandoned_type === 'both' ? ' & ' : ''}${result.abandoned_type === 'away' || result.abandoned_type === 'both' ? away?.name : ''} forfeited. Score at time: ${result.home_score}-${result.away_score}. This penalty was applied to the aggregate.`} />
            </div>
          )}

          {/* Tournament badge */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${tournamentColor}`}>{tournament?.name}</span>
            {fixture?.matchday && <span className="text-[10px] text-text-muted">· MD {fixture.matchday}</span>}
          </div>

          {/* Teams row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {home?.logo_league_folder && (
                <TeamLogo leagueFolder={home.logo_league_folder} teamSlug={home.logo_team_slug} context="match_detail_hero" alt={home.name} className="w-11 h-11 shrink-0" />
              )}
              <span className="text-xs font-bold text-foreground-primary text-center leading-tight truncate max-w-[90px]">{home?.name}</span>
            </div>

              <div className="text-center shrink-0">
              <div className="text-3xl font-black text-foreground-primary tabular-nums">
                {result.home_score}<span className="text-text-muted mx-1">–</span>{result.away_score}
              </div>
              {(aggregateScore || penScore) && (
                <div className="text-center space-y-0.5 mt-0.5">
                  {aggregateScore && (
                    <p className="text-[10px] text-text-muted font-semibold">
                      AGG {aggregateScore.home} – {aggregateScore.away}
                    </p>
                  )}
                  {penScore && (
                    <p className="text-[9px] text-text-muted/70 font-medium">
                      pens {penScore.home} – {penScore.away}
                    </p>
                  )}
                </div>
              )}
              <div className="text-[9px] text-green-400 font-semibold uppercase tracking-wider">FT</div>
            </div>

            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {away?.logo_league_folder && (
                <TeamLogo leagueFolder={away.logo_league_folder} teamSlug={away.logo_team_slug} context="match_detail_hero" alt={away.name} className="w-11 h-11 shrink-0" />
              )}
              <span className="text-xs font-bold text-foreground-primary text-center leading-tight truncate max-w-[90px]">{away?.name}</span>
            </div>
          </div>

          {fixture?.scheduled_date && (
            <div className="text-[10px] text-text-muted mt-2">
              {new Date(fixture.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>

      {/* Match Stats — collapsible */}
      {stats && (
        <details className="card p-0 overflow-hidden group">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none min-h-[48px] select-none active:bg-black/[0.02] transition-colors">
            <BarChart3 className="w-4 h-4 text-[#c9a84c] shrink-0" />
            <span className="text-xs font-bold text-foreground-primary flex-1">Match Statistics</span>
            <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <div className="px-4 pb-4 border-t border-border pt-3">
            {stats.home_possession != null && <StatRow label="Possession" homeVal={stats.home_possession} awayVal={stats.away_possession ?? 0} />}
            {stats.home_shots != null && <StatRow label="Shots" homeVal={stats.home_shots} awayVal={stats.away_shots ?? 0} />}
            {stats.home_shots_on_target != null && <StatRow label="SOT" homeVal={stats.home_shots_on_target} awayVal={stats.away_shots_on_target ?? 0} />}
            {stats.home_passes != null && <StatRow label="Passes" homeVal={stats.home_passes} awayVal={stats.away_passes ?? 0} />}
            {stats.home_successful_passes != null && <StatRow label="Succ Pass" homeVal={stats.home_successful_passes} awayVal={stats.away_successful_passes ?? 0} />}
            {stats.home_corners != null && <StatRow label="Corners" homeVal={stats.home_corners} awayVal={stats.away_corners ?? 0} />}
            {stats.home_fouls != null && <StatRow label="Fouls" homeVal={stats.home_fouls} awayVal={stats.away_fouls ?? 0} />}
            {stats.home_tackles != null && <StatRow label="Tackles" homeVal={stats.home_tackles} awayVal={stats.away_tackles ?? 0} />}
            {stats.home_saves != null && <StatRow label="Saves" homeVal={stats.home_saves} awayVal={stats.away_saves ?? 0} />}
            {stats.home_interceptions != null && <StatRow label="Interceptions" homeVal={stats.home_interceptions} awayVal={stats.away_interceptions ?? 0} />}

            <div className="flex justify-between pt-3 mt-2 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-1 rounded-full bg-[#c9a84c]" />
                <span className="text-[10px] text-text-muted">{home?.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-text-muted">{away?.name}</span>
                <div className="w-2.5 h-1 rounded-full bg-blue-500" />
              </div>
            </div>
          </div>
        </details>
      )}

      {/* Screenshot */}
      {result.screenshot_url && (
        <details className="card p-0 overflow-hidden group">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none min-h-[48px] select-none active:bg-black/[0.02] transition-colors">
            <Camera className="w-4 h-4 text-[#c9a84c] shrink-0" />
            <span className="text-xs font-bold text-foreground-primary flex-1">Match Screenshot</span>
            <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <div className="px-4 pb-4 border-t border-border pt-3">
            <img src={result.screenshot_url} alt="Match screenshot" className="w-full rounded-lg border border-border" />
          </div>
        </details>
      )}

      {fixture?.id && (
        <Link href={`/fixtures/${fixture.id}`} className="btn-outline w-full text-center min-h-[48px] flex items-center justify-center gap-1.5 text-xs font-semibold">
          View Fixture Details <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  )
}
