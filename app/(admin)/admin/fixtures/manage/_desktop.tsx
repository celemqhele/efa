'use client'

import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import FixtureActions from './FixtureActions'
import DateNav from '@/components/ui/DateNav'
import { APP_TIME_ZONE } from '@/lib/app-time'
import ScheduleRoundPanel from './ScheduleRoundPanel'
import { CalendarDays } from 'lucide-react'
import { getTeamLogo } from '@/lib/logo-resolver'
import { cleanTeamName } from '@/lib/clean-team-name'

const TYPE_ORDER = ['league', 'tournament_club', 'tournament_international', 'friendlies'] as const

const TYPE_LABELS: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Tournament (Clubs)',
  tournament_international: 'Tournament (Intl)',
  friendlies: 'Friendly',
}

const TYPE_ACCENT: Record<string, string> = {
  league: 'text-accent border-accent/40 bg-accent/5',
  tournament_club: 'text-blue-500 border-blue-500/40 bg-blue-500/5',
  tournament_international: 'text-orange-500 border-orange-500/40 bg-orange-500/5',
  friendlies: 'text-purple-500 border-purple-500/40 bg-purple-500/5',
}

const STATUS_COLOURS: Record<string, string> = {
  scheduled: 'text-text-muted bg-slate-500/10 border-slate-500/20',
  awaiting_confirmation: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  postponed: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/20',
}

function roundLabel(roundType: string, leg: number): string {
  const base: Record<string, string> = { r16: 'R16', qf: 'QF', sf: 'SF', final: 'Final' }
  const label = base[roundType] ?? roundType.toUpperCase()
  if (leg && roundType !== 'final') return `${label} Leg ${leg}`
  return label
}

function fixtureTime(scheduledDate: string | null): string | null {
  if (!scheduledDate) return null
  try {
    return new Date(scheduledDate).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    })
  } catch {
    return null
  }
}

export default function Desktop({ data }: { data: any }) {
  const fixtures = data.fixtures ?? []
  const todayKey = data.todayKey
  const selectedDate = data.selectedDate

  const grouped: Record<string, any[]> = {}
  for (const f of fixtures) {
    const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
    const key = t?.type ?? 'unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(f)
  }
  const orderedTypes = TYPE_ORDER.filter((t) => (grouped[t]?.length ?? 0) > 0)

  return (
    <div className="max-w-[88rem] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Fixture Management</h1>
        <p className="text-text-muted text-sm mt-1">
          {fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} on {format(parseISO(selectedDate), 'EEE d MMM yyyy')}
        </p>
      </div>

      <DateNav currentDate={selectedDate} todayKey={todayKey} basePath="/admin/fixtures/manage" />

      <ScheduleRoundPanel />

      {orderedTypes.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-muted space-y-3">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-sm">No fixtures scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orderedTypes.map((type) => {
            const sectionFixtures = grouped[type] ?? []
            return (
              <section key={type} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 bg-bg-base border-b-2 border-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded border ${TYPE_ACCENT[type] ?? 'text-text-muted border-border'}`}>
                        {TYPE_LABELS[type] ?? type}
                      </h2>
                      <span className="text-xs text-text-muted">
                        {sectionFixtures.length} {sectionFixtures.length === 1 ? 'fixture' : 'fixtures'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-base border-b-2 border-accent/20">
                        <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Time</th>
                        <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Round</th>
                        <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Home</th>
                        <th className="text-center text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Score</th>
                        <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Away</th>
                        <th className="text-left text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Status</th>
                        <th className="text-right text-text-muted font-semibold text-[10px] uppercase tracking-widest px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionFixtures.map((fx: any) => {
                        const result = fx.result?.[0]
                        const statusCls = STATUS_COLOURS[fx.status] ?? STATUS_COLOURS.scheduled
                        const homeTeam = Array.isArray(fx.home_team) ? fx.home_team[0] : fx.home_team
                        const awayTeam = Array.isArray(fx.away_team) ? fx.away_team[0] : fx.away_team
                        const time = fixtureTime(fx.scheduled_date)
                        const round = fx.round_type && fx.round_type !== 'group'
                          ? roundLabel(fx.round_type, fx.leg)
                          : null
                        return (
                          <tr key={fx.id} className="border-b border-border hover:bg-bg-base/60 transition-colors">
                            <td className="px-5 py-4">
                              <span className="text-text-primary font-bold font-mono text-sm">{time ?? '—'}</span>
                            </td>
                            <td className="px-5 py-4 text-text-muted text-xs uppercase">
                              {round ?? `MD${fx.matchday}`}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {homeTeam?.logo_league_folder && (
                                  <Image
                                    src={getTeamLogo(homeTeam.logo_league_folder, homeTeam.logo_team_slug, 'standings_row')}
                                    alt={homeTeam.name}
                                    width={24} height={24}
                                    className="object-contain shrink-0"
                                  />
                                )}
                                <span className="text-text-primary font-medium whitespace-nowrap">{cleanTeamName(homeTeam?.name) ?? 'TBC'}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {result ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-text-primary font-bold text-base">
                                    {result.home_score} – {result.away_score}
                                  </span>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {fx._aggregate && (
                                      <span className="text-[9px] text-text-muted font-semibold px-1 py-0.5 rounded bg-bg-elevated">
                                        AGG {fx._aggregate.home}–{fx._aggregate.away}
                                      </span>
                                    )}
                                    {fx._penScore && (
                                      <span className="text-[9px] text-text-muted/70 px-1 py-0.5 rounded bg-bg-elevated">
                                        pens {fx._penScore.home}–{fx._penScore.away}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-text-muted">vs</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-text-primary font-medium whitespace-nowrap">{cleanTeamName(awayTeam?.name) ?? 'TBC'}</span>
                                {awayTeam?.logo_league_folder && (
                                  <Image
                                    src={getTeamLogo(awayTeam.logo_league_folder, awayTeam.logo_team_slug, 'standings_row')}
                                    alt={awayTeam.name}
                                    width={24} height={24}
                                    className="object-contain shrink-0"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${statusCls}`}>
                                {fx.status.replaceAll('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <FixtureActions
                                fixtureId={fx.id}
                                currentDate={fx.scheduled_date}
                                status={fx.status}
                                homeTeamId={homeTeam?.id ?? ''}
                                homeTeamName={cleanTeamName(homeTeam?.name) ?? ''}
                                awayTeamId={awayTeam?.id ?? ''}
                                awayTeamName={cleanTeamName(awayTeam?.name) ?? ''}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
