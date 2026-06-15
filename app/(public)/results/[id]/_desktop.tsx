'use client'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import ForfeitBadge from '@/components/ui/ForfeitBadge'
import { AlertTriangle, BarChart3, ChevronDown, Camera, ArrowLeft, ChevronRight } from 'lucide-react'

function StatBar({ label, homeVal, awayVal }: { label: string; homeVal: number; awayVal: number }) {
  const total = homeVal + awayVal || 1
  const homePct = Math.round((homeVal / total) * 100)
  const awayPct = 100 - homePct
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span className="font-semibold text-foreground-primary">{homeVal}</span>
        <span>{label}</span>
        <span className="font-semibold text-foreground-primary">{awayVal}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-bg-elevated">
        <div className="bg-[#c9a84c] transition-all" style={{ width: `${homePct}%` }} />
        <div className="bg-blue-500 transition-all" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  )
}

export default function Desktop({ data }: { data: any }) {
  const { result, stats, fixture, home, away, tournament, tournamentColor } = data

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Back */}
      <Link href="/results" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-foreground-secondary transition-colors py-2">
        <ArrowLeft className="w-3.5 h-3.5" />
        Results
      </Link>

      {/* Score card */}
      <div className="card p-4 sm:p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,168,76,0.06),transparent_70%)]" />
        <div className="relative">
          {/* Tournament + matchday */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className={`text-xs font-bold uppercase tracking-widest ${tournamentColor}`}>
              {tournament?.name}
            </span>
            {fixture?.matchday && (
              <span className="text-xs text-foreground-muted">· Matchday {fixture.matchday}</span>
            )}
          </div>

          {result.is_abandoned && (
            <div className="mb-4 flex flex-col sm:flex-row items-center gap-2 justify-center">
              <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Abandoned ({result.abandoned_type === 'both' ? 'Mutual' : `${result.abandoned_type} team`})
              </div>
              <ForfeitBadge note={`Forfeit: ${result.abandoned_type === 'home' || result.abandoned_type === 'both' ? home?.name : ''}${result.abandoned_type === 'both' ? ' & ' : ''}${result.abandoned_type === 'away' || result.abandoned_type === 'both' ? away?.name : ''} forfeited. Score at time: ${result.home_score}-${result.away_score}. This penalty was applied to the aggregate.`} />
            </div>
          )}

          {/* Teams + score — mobile: stacked, sm: side-by-side */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-4">
            {/* Score (mobile: show on top between teams) */}
            <div className="order-1 sm:order-none text-center mb-3 sm:mb-0 w-full sm:w-auto">
              <div className="text-5xl sm:text-5xl font-black text-foreground-primary tabular-nums">
                {result.home_score}
                <span className="text-text-muted mx-2">–</span>
                {result.away_score}
              </div>
              {fixture?.scheduled_date && (
                <div className="text-xs text-text-muted mt-1.5">
                  {new Date(fixture.scheduled_date).toLocaleDateString('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </div>
              )}
              <div className="text-[10px] text-green-400 mt-1 font-semibold uppercase tracking-wider">Full Time</div>
            </div>

            {/* Teams row */}
            <div className="flex items-center justify-between gap-4 w-full sm:w-auto order-2 sm:order-none">
              {/* Home */}
              <Link href={`/teams/${home?.id}`} className="flex flex-col items-center gap-1.5 flex-1 sm:flex-initial hover:opacity-80 transition-opacity min-w-0">
                {home?.logo_league_folder && (
                  <Image
                    src={getTeamLogo(home.logo_league_folder, home.logo_team_slug, 'match_detail_hero')}
                    alt={home.name}
                    width={56} height={56}
                    className="object-contain w-14 h-14 sm:w-20 sm:h-20"
                  />
                )}
                <span className="text-xs sm:text-sm font-bold text-foreground-primary text-center leading-tight truncate max-w-[100px] sm:max-w-[160px]">{home?.name}</span>
                <span className="text-[10px] sm:text-xs text-text-muted truncate max-w-[100px] sm:max-w-[160px]">{home?.manager?.username ?? 'NO MANAGER'}</span>
              </Link>

              {/* VS divider (mobile only) */}
              <span className="text-text-muted text-lg font-black sm:hidden">:</span>

              {/* Away */}
              <Link href={`/teams/${away?.id}`} className="flex flex-col items-center gap-1.5 flex-1 sm:flex-initial hover:opacity-80 transition-opacity min-w-0">
                {away?.logo_league_folder && (
                  <Image
                    src={getTeamLogo(away.logo_league_folder, away.logo_team_slug, 'match_detail_hero')}
                    alt={away.name}
                    width={56} height={56}
                    className="object-contain w-14 h-14 sm:w-20 sm:h-20"
                  />
                )}
                <span className="text-xs sm:text-sm font-bold text-foreground-primary text-center leading-tight truncate max-w-[100px] sm:max-w-[160px]">{away?.name}</span>
                <span className="text-[10px] sm:text-xs text-text-muted truncate max-w-[100px] sm:max-w-[160px]">{away?.manager?.username ?? 'NO MANAGER'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Match Stats — collapsible on mobile, open on desktop */}
      {stats && (
        <details className="card p-0 overflow-hidden group" open>
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none active:bg-black/[0.02] transition-colors lg:pointer-events-none">
            <BarChart3 className="w-4 h-4 text-[#c9a84c] shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Match Statistics</span>
            <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {stats.home_possession != null && (
              <StatBar label="Possession %" homeVal={stats.home_possession} awayVal={stats.away_possession ?? 0} />
            )}
            {stats.home_shots != null && (
              <StatBar label="Shots" homeVal={stats.home_shots} awayVal={stats.away_shots ?? 0} />
            )}
            {stats.home_shots_on_target != null && (
              <StatBar label="Shots on Target" homeVal={stats.home_shots_on_target} awayVal={stats.away_shots_on_target ?? 0} />
            )}
            {stats.home_passes != null && (
              <StatBar label="Passes" homeVal={stats.home_passes} awayVal={stats.away_passes ?? 0} />
            )}
            {stats.home_successful_passes != null && (
              <StatBar label="Successful Passes" homeVal={stats.home_successful_passes} awayVal={stats.away_successful_passes ?? 0} />
            )}
            {stats.home_corners != null && (
              <StatBar label="Corners" homeVal={stats.home_corners} awayVal={stats.away_corners ?? 0} />
            )}
            {stats.home_fouls != null && (
              <StatBar label="Fouls" homeVal={stats.home_fouls} awayVal={stats.away_fouls ?? 0} />
            )}
            {stats.home_tackles != null && (
              <StatBar label="Tackles" homeVal={stats.home_tackles} awayVal={stats.away_tackles ?? 0} />
            )}
            {stats.home_saves != null && (
              <StatBar label="Saves" homeVal={stats.home_saves} awayVal={stats.away_saves ?? 0} />
            )}
            {stats.home_interceptions != null && (
              <StatBar label="Interceptions" homeVal={stats.home_interceptions} awayVal={stats.away_interceptions ?? 0} />
            )}

            {/* Key: home=gold, away=blue */}
            <div className="flex justify-between pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full bg-[#c9a84c]" />
                <span className="text-xs text-text-muted">{home?.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted">{away?.name}</span>
                <div className="w-3 h-1.5 rounded-full bg-blue-500" />
              </div>
            </div>
          </div>
        </details>
      )}

      {/* Screenshot */}
      {result.screenshot_url && (
        <details className="card p-0 overflow-hidden group" open>
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none select-none lg:pointer-events-none">
            <Camera className="w-4 h-4 text-[#c9a84c] shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Match Screenshot</span>
            <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180 lg:hidden shrink-0" />
          </summary>
          <div className="px-4 pb-4 border-t border-border pt-3">
            <img
              src={result.screenshot_url}
              alt="Match screenshot"
              className="w-full rounded-lg border border-border"
            />
          </div>
        </details>
      )}

      {/* View fixture */}
      {fixture?.id && (
        <Link
          href={`/fixtures/${fixture.id}`}
          className="btn-outline w-full text-center py-3 block text-sm font-semibold flex items-center justify-center gap-1.5"
        >
          View Fixture Details
          <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
