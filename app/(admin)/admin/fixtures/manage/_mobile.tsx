'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import FixtureActions from './FixtureActions'
import DateNav from '@/components/ui/DateNav'
import { APP_TIME_ZONE } from '@/lib/app-time'
import ScheduleRoundPanel from './ScheduleRoundPanel'
import { CalendarDays } from 'lucide-react'
import { cleanTeamName } from '@/lib/clean-team-name'

const TYPE_LABELS: Record<string, string> = {
  league: 'Premier League',
  tournament_club: 'Club Tournament',
  tournament_international: 'Intl Tournament',
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

export default function Mobile({ data }: { data: any }) {
  const fixtures = data.fixtures ?? []
  const todayKey = data.todayKey
  const selectedDate = data.selectedDate
  const queryError = data.error ?? null
  const filterTournament = data.filterTournament ?? null

  interface TournamentSection {
    id: string
    name: string
    type: string
    fixtures: any[]
  }
  const sections: TournamentSection[] = []
  const byId = new Map<string, TournamentSection>()
  for (const f of fixtures) {
    const t = Array.isArray(f.tournament) ? f.tournament[0] : f.tournament
    const id = t?.id ?? 'unknown'
    let section = byId.get(id)
    if (!section) {
      section = { id, name: t?.name ?? 'Unknown Tournament', type: t?.type ?? 'unknown', fixtures: [] }
      byId.set(id, section)
      sections.push(section)
    }
    section.fixtures.push(f)
  }
  sections.sort((a, b) => {
    const rank = (ty: string) => (ty === 'league' ? 0 : ty === 'friendlies' ? 2 : 1)
    if (rank(a.type) !== rank(b.type)) return rank(a.type) - rank(b.type)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Fixture Management</h1>
          <p className="text-text-muted text-xs mt-1">
            {fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} on {format(parseISO(selectedDate), 'EEE d MMM yyyy')}
          </p>
          {filterTournament && (
            <p className="text-accent text-xs mt-0.5">
              Filtered to <span className="font-bold">{filterTournament.name}</span>
              {' · '}
              <Link href={`/admin/fixtures/manage?date=${selectedDate}`} className="underline">
                Show all
              </Link>
            </p>
          )}
        </div>
      </div>

      <DateNav currentDate={selectedDate} todayKey={todayKey} basePath="/admin/fixtures/manage" />

      <ScheduleRoundPanel />

      {queryError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Error loading fixtures: {queryError}
        </div>
      )}

      {sections.length === 0 && !queryError ? (
        <div className="bg-bg-surface border border-border rounded-xl p-8 text-center text-text-muted space-y-2">
          <CalendarDays className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-sm">No fixtures scheduled for this day.</p>
          <p className="text-xs text-text-muted/70">Use the Schedule Round panel above to assign dates.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => {
            const sectionFixtures = section.fixtures
            return (
              <section key={section.id} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border truncate ${TYPE_ACCENT[section.type] ?? 'text-text-muted border-border'}`}>
                      {section.name}
                    </h2>
                    <span className="text-[9px] text-text-muted uppercase">{TYPE_LABELS[section.type] ?? section.type}</span>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
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
                      ? roundLabel(fx.round_type, fx.leg)
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
                        <div>
                          <p className="text-text-primary text-base font-semibold">
                            {cleanTeamName(homeTeam?.name) ?? 'TBC'}
                            <span className="text-text-muted font-normal mx-1.5">
                              {result ? `${result.home_score}–${result.away_score}` : 'vs'}
                            </span>
                            {cleanTeamName(awayTeam?.name) ?? 'TBC'}
                          </p>
                          {(fx._aggregate || fx._penScore) && (
                            <div className="flex items-center gap-1 mt-1">
                              {fx._aggregate && (
                                <span className="text-[10px] text-text-muted font-semibold px-1 py-0.5 rounded bg-bg-elevated">
                                  AGG {fx._aggregate.home}–{fx._aggregate.away}
                                </span>
                              )}
                              {fx._penScore && (
                                <span className="text-[10px] text-text-muted/70 px-1 py-0.5 rounded bg-bg-elevated">
                                  pens {fx._penScore.home}–{fx._penScore.away}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
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
