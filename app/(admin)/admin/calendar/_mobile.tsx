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

export default function Mobile({ data }: { data: any }) {
  const now = new Date(data.now)
  const breakDates = new Set(data.breakDates)
  const byDate = data.byDate as Record<string, any[]>

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary">Calendar</h1>
          <p className="text-xs text-text-muted mt-0.5">{data.monthLabel}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`?month=${data.prevMonth}&scope=${data.scope}`} className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-text-secondary min-h-[48px]">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Link href={`?month=${format(now, 'yyyy-MM')}&scope=${data.scope}`} className="text-sm font-semibold px-4 py-3 rounded-lg border border-border text-text-secondary min-h-[48px] flex items-center">
            Today
          </Link>
          <Link href={`?month=${data.nextMonth}&scope=${data.scope}`} className="flex items-center justify-center w-12 h-12 rounded-lg border border-border text-text-secondary min-h-[48px]">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 bg-bg-surface border border-border rounded-full px-3 py-1.5">
          <span className={`text-xs font-medium ${data.scope === 'mine' ? 'text-text-primary' : 'text-text-muted'}`}>Mine</span>
          <Link
            href={`?month=${data.currentMonth}&scope=${data.scope === 'mine' ? 'all' : 'mine'}`}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${data.scope === 'all' ? 'bg-accent' : 'bg-border'}`}
            scroll={false}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg-surface transition-transform ${data.scope === 'all' ? 'translate-x-4' : 'translate-x-1'}`}
            />
          </Link>
          <span className={`text-xs font-medium ${data.scope === 'all' ? 'text-text-primary' : 'text-text-muted'}`}>All</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TOURNAMENT_COLORS).map(([type, c]) => (
          <span key={type} className={`text-[10px] px-2 py-0.5 rounded ${c.bg} ${c.text} font-bold`}>
            {c.label}
          </span>
        ))}
        <span className="text-[10px] px-2 py-0.5 rounded bg-bg-surface text-text-muted font-bold">Break</span>
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-2 overflow-x-auto">
        <div className="grid grid-cols-7 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="text-center text-[10px] text-text-muted font-semibold py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-border">
          {Array.from({ length: data.startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="bg-bg-surface min-h-[72px]" />
          ))}

          {data.days.map((day: any) => {
            const dateStr = day.dateStr
            const isBreak = breakDates.has(dateStr)
            const dayFixtures = byDate[dateStr] ?? []
            const isToday = dateStr === data.todayStr

            return (
              <div
                key={dateStr}
                className={`bg-bg-surface min-h-[72px] p-1 ${
                  isBreak ? 'opacity-40' : ''
                } ${isToday ? 'ring-1 ring-accent ring-inset' : ''}`}
              >
                <div className={`text-xs font-bold mb-0.5 ${
                  isToday ? 'text-accent' : 'text-text-muted'
                }`}>
                  {day.dayNum}
                </div>

                {isBreak && (
                  <div className="text-[8px] text-text-muted bg-bg-base rounded px-1 py-0.5">Break</div>
                )}

                <div className="space-y-0.5">
                  {dayFixtures.slice(0, 2).map((f: any) => {
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
                            <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={10} height={10} className="object-contain" />
                          )}
                          <span className={`text-[8px] font-bold ${colors.text}`}>
                            {result ? `${result.home_score}-${result.away_score}` : 'vs'}
                          </span>
                          {f.away_team?.logo_league_folder && (
                            <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={10} height={10} className="object-contain" />
                          )}
                        </div>
                      </Link>
                    )
                  })}
                  {dayFixtures.length > 2 && (
                    <div className="text-[8px] text-text-muted px-1">+{dayFixtures.length - 2} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {byDate[data.todayStr]?.length ? (
        <section>
          <h2 className="text-xs font-black uppercase tracking-wider text-text-muted mb-3">Today's Fixtures</h2>
          <div className="space-y-2">
            {(byDate[data.todayStr] ?? []).map((f: any) => (
              <div key={f.id} className="bg-bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {f.home_team?.logo_league_folder && (
                      <Image src={getTeamLogo(f.home_team.logo_league_folder, f.home_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain shrink-0" />
                    )}
                    <span className="text-sm font-medium text-text-primary truncate">{f.home_team?.name}</span>
                  </div>
                  <div className="text-center px-2 shrink-0">
                    {f.results?.[0]
                      ? <span className="text-text-primary font-bold">{f.results[0].home_score}–{f.results[0].away_score}</span>
                      : <span className="text-xs text-accent font-semibold">vs</span>
                    }
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium text-text-primary truncate">{f.away_team?.name}</span>
                    {f.away_team?.logo_league_folder && (
                      <Image src={getTeamLogo(f.away_team.logo_league_folder, f.away_team.logo_team_slug, 'standings_row')} alt="" width={24} height={24} className="object-contain shrink-0" />
                    )}
                  </div>
                </div>
                <Link href={`/admin/results/submit?fixture=${f.id}`} className="mt-2 block text-center text-sm font-semibold px-4 py-3 rounded-lg bg-accent text-bg-surface min-h-[48px] flex items-center justify-center">
                  Submit Result
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
