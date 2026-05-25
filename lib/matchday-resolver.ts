const APP_TIME_ZONE = 'Africa/Johannesburg'

export type FixtureMatchdayRow = {
  id: string
  matchday: number | null
  scheduled_date: string | null
}

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateKeyFromDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function getDateKey(value: string | null | undefined): string | null {
  const date = toValidDate(value)
  return date ? getDateKeyFromDate(date) : null
}

function getClosestMatchdayOnSameDate(
  fixtures: FixtureMatchdayRow[],
  fixtureId: string,
  newDateTime: Date
): number | null {
  const newDateKey = getDateKeyFromDate(newDateTime)

  const candidates = fixtures
    .filter((fx) =>
      fx.id !== fixtureId &&
      typeof fx.matchday === 'number' &&
      getDateKey(fx.scheduled_date) === newDateKey
    )
    .map((fx) => {
      const d = toValidDate(fx.scheduled_date)
      return {
        matchday: fx.matchday as number,
        distance: d ? Math.abs(d.getTime() - newDateTime.getTime()) : Number.MAX_SAFE_INTEGER,
      }
    })
    .sort((a, b) => a.distance - b.distance || a.matchday - b.matchday)

  return candidates[0]?.matchday ?? null
}

function getTimelineMatchday(
  fixtures: FixtureMatchdayRow[],
  fixtureId: string,
  newDateTime: Date,
  currentMatchday: number | null
): number | null {
  const byMatchday = new Map<number, Date>()

  for (const fx of fixtures) {
    if (fx.id === fixtureId || typeof fx.matchday !== 'number') continue
    const d = toValidDate(fx.scheduled_date)
    if (!d) continue
    const existing = byMatchday.get(fx.matchday)
    if (!existing || d.getTime() < existing.getTime()) {
      byMatchday.set(fx.matchday, d)
    }
  }

  const ordered = Array.from(byMatchday.entries())
    .map(([matchday, date]) => ({ matchday, date }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.matchday - b.matchday)

  if (ordered.length === 0) return currentMatchday

  for (const item of ordered) {
    if (newDateTime.getTime() <= item.date.getTime()) {
      return item.matchday
    }
  }

  const maxMatchday = ordered.reduce((max, item) => Math.max(max, item.matchday), currentMatchday ?? 0)
  return maxMatchday + 1
}

/**
 * Decide which matchday a fixture belongs in given a new scheduled date.
 *
 * Strategy:
 *   1. If another fixture in this tournament already plays on the new calendar
 *      day, slot the postponed fixture into that matchday (closest by time).
 *   2. Otherwise, find the earliest matchday whose first fixture is on or
 *      after the new date and use that. If the new date is past every
 *      existing matchday, return maxMatchday + 1 (a brand new matchday).
 *
 * `currentMatchday` is returned as a no-op fallback when we have no other
 * fixtures to compare against.
 */
export function resolveMatchdayForDate(
  allTournamentFixtures: FixtureMatchdayRow[],
  fixtureId: string,
  newDateTime: Date,
  currentMatchday: number | null
): number | null {
  const sameDay = getClosestMatchdayOnSameDate(allTournamentFixtures, fixtureId, newDateTime)
  if (sameDay !== null) return sameDay
  return getTimelineMatchday(allTournamentFixtures, fixtureId, newDateTime, currentMatchday)
}
