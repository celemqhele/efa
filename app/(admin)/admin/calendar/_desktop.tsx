'use client'

import Link from 'next/link'
import Image from 'next/image'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-text-primary">Calendar</h1>
          <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-full px-4 py-2">
            <span className={`text-sm font-medium ${data.scope === 'mine' ? 'text-text-primary' : 'text-text-muted'}`}>My Team</span>
            <Link
              href={`?month=${data.currentMonth}&scope=${data.scope === 'mine' ? 'all' : 'mine'}`}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${data.scope === 'all' ? 'bg-accent' : 'bg-border'}`}
              scroll={false}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-surface transition-transform ${data.scope === 'all' ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </Link>
            <span className={`text-sm font-medium ${data.scope === 'all' ? 'text-text-primary' : 'text-text-muted'}`}>All Teams</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`?month=${data.prevMonth}&scope=${data.scope}`} className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors text-sm">
            <ChevronLeft className="w-4 h-4" /> Prev
          </Link>
          <Link href={`?month=${format(now, 'yyyy-MM')}&scope=${data.scope}`} className="text-sm font-semibold px-4 py-2 rounded-lg border border-accent text-accent hover:bg-accent/5 transition-colors">
            Today
          </Link>
          <Link href={`?month=${data.nextMonth}&scope=${data.scope}`} className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent transition-colors text-sm">
            Next <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold text-text-primary">{data.monthLabel}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(TOURNAMENT_COLORS).map(([type, c]) => (
          <span key={type} className={`text-xs px-2 py-0.5 rounded ${c.bg} ${c.text} font-bold`}>
            {c.label}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded bg-bg-surface text-text-muted font-bold border border-border">Break</span>
      </div>

      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-xs text-text-muted font-semibold py-3 border-r border-border last:border-r-0">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: data.startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[120px] border-r border-b border-border last:border-r-0" />
          ))}

          {data.days.map((day: any, idx: number) => {
            const dateStr = day.dateStr
            const isBreak = breakDates.has(dateStr)
            const dayFixtures = byDate[dateStr] ?? []
            const isToday = dateStr === data.todayStr
            const isLastRow = idx >= data.days.length - 7

            return (
              <div
                key={dateStr}
                className={`p-2 min-h-[120px] border-r border-b border-border last:border-r-0 ${
                  isBreak ? 'opacity-40' : ''
                } ${isToday ? 'ring-1 ring-accent ring-inset bg-accent/5' : ''} ${isLastRow ? 'border-b-0' : ''}`}
              >
                <div className={`text-sm font-bold mb-1.5 ${
                  isToday ? 'text-accent' : 'text-text-muted'
                }`}>
                  {day.dayNum}
                </div>

                {isBreak && (
                  <div className="text-[10px] text-text-muted bg-bg-base rounded px-1.5 py-0.5 mb-1">Break</div>
                )}

                <div className="space-y-1">
                  {dayFixtures.map((f: any) => {
                    const colors = TOURNAMENT_COLORS[f.tournament?.type] ?? TOURNAMENT_COLORS.league
                    const result = f.results?.[0]
                    return (
                      <Link
                        key={f.id}
                        href={result ? `/results` : `/admin/results/submit?fixture=${f.id}`}
                        className={`block rounded px-1.5 py-1 ${colors.bg} hover:opacity-80 transition-opacity`}
                      >
                        <div className="flex items-center gap-1">
                          {f.home_team?.logo_league_folder && (
                            <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={12} height={12} className="object-contain" />
                          )}
                          <span className={`text-[10px] font-bold ${colors.text}`}>
                            {result ? `${result.home_score}-${result.away_score}` : 'vs'}
                          </span>
                          {f.away_team?.logo_league_folder && (
                            <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={12} height={12} className="object-contain" />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {byDate[data.todayStr]?.length ? (
        <div className="bg-bg-surface border border-border rounded-xl">
          <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
            <h2 className="text-base font-bold text-text-primary">Today's Fixtures</h2>
          </div>
          <div className="p-5 space-y-3">
            {(byDate[data.todayStr] ?? []).map((f: any) => (
              <div key={f.id} className="flex items-center justify-between gap-4 py-3 px-4 bg-bg-base border border-border rounded-xl">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {f.home_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={28} height={28} className="object-contain shrink-0" />
                  )}
                  <span className="text-sm font-medium text-text-primary">{f.home_team?.name}</span>
                </div>
                <div className="text-center px-4 shrink-0">
                  {f.results?.[0]
                    ? <span className="text-text-primary font-bold text-lg">{f.results[0].home_score}–{f.results[0].away_score}</span>
                    : <span className="text-sm text-accent font-semibold">vs</span>
                  }
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  <span className="text-sm font-medium text-text-primary">{f.away_team?.name}</span>
                  {f.away_team?.logo_league_folder && (
                    <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={28} height={28} className="object-contain shrink-0" />
                  )}
                </div>
                <Link href={`/admin/results/submit?fixture=${f.id}`} className="text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-bg-surface hover:bg-accent-hover transition-colors shrink-0">
                  Submit Result
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
