'use client'

import { format, parseISO } from 'date-fns'
import FixtureActions from './FixtureActions'
import DateNav from '@/components/ui/DateNav'
import { APP_TIME_ZONE } from '@/lib/app-time'
import ScheduleRoundPanel from './ScheduleRoundPanel'
import { CalendarDays } from 'lucide-react'
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

const ROUND_LABELS: Record<string, string> = {
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'Final',
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

export default function Mobile({ data }: { data: any }) {
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
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Fixture Management</h1>
          <p className="text-text-muted text-xs mt-1">
            {fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} on {format(parseISO(selectedDate), 'EEE d MMM yyyy')}
          </p>
        </div>
      </div>

      <DateNav currentDate={selectedDate} todayKey={todayKey} basePath="/admin/fixtures/manage" />

      <ScheduleRoundPanel />

      {orderedTypes.length === 0 ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center text-text-muted space-y-2">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-sm">No fixtures scheduled for this day.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {orderedTypes.map((type) => {
            const sectionFixtures = grouped[type] ?? []
            return (
              <section key={type} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${TYPE_ACCENT[type] ?? 'text-text-muted border-border'}`}>
                    {TYPE_LABELS[type] ?? type}
                  </h2>
                  <span className="text-xs text-text-muted">
                    {sectionFixtures.length} {sectionFixtures.length === 1 ? 'fixture' : 'fixtures'}
                  </span>
                </div>

                <div className="space-y-2">
                  {sectionFixtures.map((fx: any) => {
                    const result = fx.result?.[0]
                    const statusCls = STATUS_COLOURS[fx.status] ?? STATUS_COLOURS.scheduled
                    const homeTeam = Array.isArray(fx.home_team) ? fx.home_team[0] : fx.home_team
                    const awayTeam = Array.isArray(fx.away_team) ? fx.away_team[0] : fx.away_team
                    const time = fixtureTime(fx.scheduled_date)
                    const round = fx.round_type && fx.round_type !== 'group'
                      ? ROUND_LABELS[fx.round_type] ?? fx.round_type.toUpperCase()
                      : null
                    return (
                      <div key={fx.id} className="bg-bg-surface border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {time && (
                            <span className="text-text-muted text-sm font-bold font-mono">{time}</span>
                          )}
                          {round && (
                            <span className="text-text-muted text-[10px] font-semibold uppercase">{round}</span>
                          )}
                          <span className="text-text-muted text-[10px]">MD{fx.matchday}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusCls}`}>
                            {fx.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="text-text-primary text-base font-semibold">
                          {cleanTeamName(homeTeam?.name) ?? 'TBC'}
                          <span className="text-text-muted font-normal mx-1.5">
                            {result ? `${result.home_score}–${result.away_score}` : 'vs'}
                          </span>
                          {cleanTeamName(awayTeam?.name) ?? 'TBC'}
                        </p>
                        <FixtureActions
                          fixtureId={fx.id}
                          currentDate={fx.scheduled_date}
                          status={fx.status}
                          homeTeamId={homeTeam?.id ?? ''}
                          homeTeamName={cleanTeamName(homeTeam?.name) ?? ''}
                          awayTeamId={awayTeam?.id ?? ''}
                          awayTeamName={cleanTeamName(awayTeam?.name) ?? ''}
                        />
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
