'use client'
import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import ForfeitBadge from '@/components/ui/ForfeitBadge'
import { AlertTriangle, BarChart3, Camera, ArrowLeft, ChevronRight } from 'lucide-react'

export default function Desktop({ data }: { data: any }) {
  const { result, stats, fixture, home, away, tournament, tournamentColor } = data

  const statDefs = [
    { key: 'possession', label: 'Possession %', h: stats?.home_possession, a: stats?.away_possession, unit: '%' },
    { key: 'shots', label: 'Shots', h: stats?.home_shots, a: stats?.away_shots, unit: '' },
    { key: 'shots_on_target', label: 'Shots on Target', h: stats?.home_shots_on_target, a: stats?.away_shots_on_target, unit: '' },
    { key: 'passes', label: 'Passes', h: stats?.home_passes, a: stats?.away_passes, unit: '' },
    { key: 'successful_passes', label: 'Successful Passes', h: stats?.home_successful_passes, a: stats?.away_successful_passes, unit: '' },
    { key: 'corners', label: 'Corners', h: stats?.home_corners, a: stats?.away_corners, unit: '' },
    { key: 'fouls', label: 'Fouls', h: stats?.home_fouls, a: stats?.away_fouls, unit: '' },
    { key: 'tackles', label: 'Tackles', h: stats?.home_tackles, a: stats?.away_tackles, unit: '' },
    { key: 'saves', label: 'Saves', h: stats?.home_saves, a: stats?.away_saves, unit: '' },
    { key: 'interceptions', label: 'Interceptions', h: stats?.home_interceptions, a: stats?.away_interceptions, unit: '' },
  ].filter(s => s.h != null)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link href="/results" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        Results
      </Link>

      {/* ── Hero Score Card ────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-24 relative" />
        <div className="px-10 py-8 -mt-8 relative">
          <div className="relative flex items-center justify-between gap-8">
            {/* Home team */}
            <div className="flex items-center gap-5 flex-1 justify-end">
              <div className="text-right">
                <Link href={`/teams/${home?.id}`} className="text-lg font-bold text-text-primary hover:text-accent transition-colors block">{home?.name}</Link>
                <p className="text-xs text-text-muted">{home?.manager?.username ?? 'NO MANAGER'}</p>
              </div>
              {home?.logo_league_folder && (
                <Image src={getTeamLogo(home.logo_league_folder, home.logo_team_slug, 'match_detail_hero')} alt={home.name} width={64} height={64} className="object-contain w-16 h-16" />
              )}
            </div>

            {/* Score */}
            <div className="text-center shrink-0">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-widest ${tournamentColor}`}>{tournament?.name}</span>
                {fixture?.matchday && <span className="text-xs text-text-muted">· Matchday {fixture.matchday}</span>}
              </div>
              <div className="text-6xl font-black text-text-primary tabular-nums tracking-tight">
                {result.home_score}<span className="text-text-muted mx-3">–</span>{result.away_score}
              </div>
              <div className="text-xs text-green-400 mt-1 font-semibold uppercase tracking-wider">Full Time</div>
              {fixture?.scheduled_date && (
                <div className="text-xs text-text-muted mt-1">
                  {new Date(fixture.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-5 flex-1">
              {away?.logo_league_folder && (
                <Image src={getTeamLogo(away.logo_league_folder, away.logo_team_slug, 'match_detail_hero')} alt={away.name} width={64} height={64} className="object-contain w-16 h-16" />
              )}
              <div>
                <Link href={`/teams/${away?.id}`} className="text-lg font-bold text-text-primary hover:text-accent transition-colors block">{away?.name}</Link>
                <p className="text-xs text-text-muted">{away?.manager?.username ?? 'NO MANAGER'}</p>
              </div>
            </div>
          </div>

          {result.is_abandoned && (
            <div className="mt-4 flex items-center gap-3 justify-center">
              <div className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Abandoned ({result.abandoned_type === 'both' ? 'Mutual' : `${result.abandoned_type} team`})
              </div>
              <ForfeitBadge note={`Forfeit: ${result.abandoned_type === 'home' || result.abandoned_type === 'both' ? home?.name : ''}${result.abandoned_type === 'both' ? ' & ' : ''}${result.abandoned_type === 'away' || result.abandoned_type === 'both' ? away?.name : ''} forfeited. Score at time: ${result.home_score}-${result.away_score}. This penalty was applied to the aggregate.`} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* ── Stats Table ──────────────────────────────────────────────── */}
        <div className="col-span-3 card p-6">
          <h2 className="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-accent" /> Match Statistics
          </h2>

          {statDefs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-right py-3 pr-6 text-[10px] font-bold text-text-muted uppercase tracking-widest w-[80px]">{home?.name}</th>
                    <th className="text-left py-3 px-6 text-[10px] font-bold text-text-muted uppercase tracking-widest">Statistic</th>
                    <th className="text-left py-3 pl-6 text-[10px] font-bold text-text-muted uppercase tracking-widest w-[80px]">{away?.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {statDefs.map((s) => (
                    <tr key={s.key} className="border-b border-border/20 hover:bg-black/[0.02] transition-colors">
                      <td className="text-right py-3 pr-6 font-semibold text-text-primary tabular-nums">{s.h}{s.unit}</td>
                      <td className="py-3 px-6 text-xs text-text-muted font-medium">{s.label}</td>
                      <td className="py-3 pl-6 font-semibold text-text-primary tabular-nums">{s.a}{s.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No statistics available for this match.</p>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-6">
          {result.screenshot_url && (
            <div className="card p-6">
              <h2 className="text-sm font-black text-text-primary uppercase tracking-widest flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-accent" /> Match Screenshot
              </h2>
              <img src={result.screenshot_url} alt="Match screenshot" className="w-full rounded-lg border border-border" />
            </div>
          )}

          {fixture?.id && (
            <Link href={`/fixtures/${fixture.id}`} className="btn-outline w-full text-center py-3 block text-sm font-semibold flex items-center justify-center gap-1.5">
              View Full Fixture Details <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
