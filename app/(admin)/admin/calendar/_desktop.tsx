'use client'

import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format } from 'date-fns'

const TOURNAMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  league: { bg: 'bg-accent/20', text: 'text-accent', label: 'PL' },
  ucl:    { bg: 'bg-blue-500/20',   text: 'text-blue-400',  label: 'UCL' },
  europa: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'UEL' },
  super_cup: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'SC' },
}

export default function Desktop({ data }: { data: any }) {
  const now = new Date(data.now)
  const breakDates = new Set(data.breakDates)
  const byDate = data.byDate as Record<string, any[]>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-foreground-primary">{data.monthLabel}</h1>
          
          {/* Scope Toggle */}
          <div className="flex items-center gap-2 bg-bg-elevated px-3 py-1.5 rounded-full border border-border shadow-sm">
            <span className={`text-xs font-medium ${data.scope === 'mine' ? 'text-foreground-primary' : 'text-text-muted'}`}>
              My Team
            </span>
            <Link
              href={`?month=${data.currentMonth}&scope=${data.scope === 'mine' ? 'all' : 'mine'}`}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${data.scope === 'all' ? 'bg-accent' : 'bg-slate-300'}`}
              scroll={false}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-surface transition-transform ${data.scope === 'all' ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </Link>
            <span className={`text-xs font-medium ${data.scope === 'all' ? 'text-foreground-primary' : 'text-text-muted'}`}>
              All Teams
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`?month=${data.prevMonth}&scope=${data.scope}`} className="btn-outline text-xs px-3 py-2">← Prev</Link>
          <Link href={`?month=${format(now, 'yyyy-MM')}&scope=${data.scope}`} className="text-xs text-accent px-3 py-2">Today</Link>
          <Link href={`?month=${data.nextMonth}&scope=${data.scope}`} className="btn-outline text-xs px-3 py-2">Next →</Link>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TOURNAMENT_COLORS).map(([type, c]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded ${c.bg} ${c.text} font-bold`}>
            {c.label}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-muted font-bold">Break</span>
      </div>

      {/* Calendar grid */}
      <div className="card p-2 overflow-x-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs text-text-muted font-medium py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-bg-elevated">
          {/* Padding */}
          {Array.from({ length: data.startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="bg-bg-surface min-h-[80px]" />
          ))}

          {data.days.map((day: any) => {
            const dateStr = day.dateStr
            const isBreak = breakDates.has(dateStr)
            const dayFixtures = byDate[dateStr] ?? []
            const isToday = dateStr === data.todayStr

            return (
              <div
                key={dateStr}
                className={`bg-bg-surface min-h-[80px] p-1.5 ${
                  isBreak ? 'opacity-40' : ''
                } ${isToday ? 'ring-1 ring-accent ring-inset' : ''}`}
              >
                <div className={`text-xs font-bold mb-1 ${
                  isToday ? 'text-accent' : 'text-text-muted'
                }`}>
                  {day.dayNum}
                </div>

                {isBreak && (
                  <div className="text-[9px] text-foreground-muted bg-bg-elevated rounded px-1 py-0.5">
                    Break
                  </div>
                )}

                <div className="space-y-0.5">
                  {dayFixtures.slice(0, 4).map((f: any) => {
                    const colors = TOURNAMENT_COLORS[f.tournament?.type] ?? TOURNAMENT_COLORS.league
                    const result = f.results?.[0]
                    return (
                      <Link
                        key={f.id}
                        href={result ? `/results` : `/admin/results/submit?fixture=${f.id}`}
                        className={`block rounded px-1 py-0.5 ${colors.bg} hover:opacity-80 transition-opacity`}
                      >
                        <div className="flex items-center gap-0.5">
                          {f.home_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')}
                              alt=""
                              width={12} height={12}
                              className="object-contain"
                            />
                          )}
                          <span className={`text-[9px] font-bold ${colors.text}`}>
                            {result
                              ? `${result.home_score}-${result.away_score}`
                              : 'vs'
                            }
                          </span>
                          {f.away_team?.logo_league_folder && (
                            <Image
                              src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')}
                              alt=""
                              width={12} height={12}
                              className="object-contain"
                            />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {dayFixtures.length > 4 && (
                    <div className="text-[9px] text-text-muted px-1">
                      +{dayFixtures.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* List view for today */}
      {byDate[data.todayStr]?.length ? (
        <div className="card p-4">
          <h2 className="section-header">Today's Fixtures</h2>
          <div className="space-y-2">
            {(byDate[data.todayStr] ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {f.home_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                  )}
                  <span className="text-sm text-foreground-primary">{f.home_team?.name}</span>
                </div>
                <div className="text-center px-3">
                  {f.results?.[0]
                    ? <span className="text-foreground-primary font-bold">{f.results[0].home_score}–{f.results[0].away_score}</span>
                    : <span className="text-xs text-accent">vs</span>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground-primary">{f.away_team?.name}</span>
                  {f.away_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain" />
                  )}
                </div>
                <Link href={`/results/submit?fixture=${f.id}`} className="btn-gold text-xs px-3 py-1.5 ml-2">
                  Submit
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
