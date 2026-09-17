// "What day is it" / "what UTC range covers this day" helpers.
//
// Fixtures carry a plain DATE column (scheduled_date) that holds the matchday a
// manager sees, so the day key must roll over at SAST midnight, not UTC. SAST is
// UTC+2 year-round (no DST), so a fixed offset is exact and avoids Intl/instance
// timezone variance.

export const APP_TIME_ZONE = 'Africa/Johannesburg'

// SAST = UTC+2, year-round.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

/**
 * SAST YYYY-MM-DD for a moment in time (default: now), optionally shifted by a
 * whole number of days. This is the canonical "which matchday" key used when
 * filtering/comparing against `fixtures.scheduled_date`.
 */
export function getSastDateKey(date: Date = new Date(), offsetDays = 0): string {
  const shifted = new Date(date.getTime() + SAST_OFFSET_MS + offsetDays * 24 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

/** Format a Date as YYYY-MM-DD (SAST). */
export function getDateKeyFromDate(date: Date): string {
  return getSastDateKey(date)
}

/** Today as YYYY-MM-DD (SAST). Async wrapper kept for call compatibility. */
export async function getAppTodayKey(_supabase?: unknown): Promise<string> {
  return getSastDateKey()
}

/**
 * Given a YYYY-MM-DD date key, return the UTC ISO range covering that full
 * calendar day (00:00:00 to 23:59:59.999). `scheduled_date` is a date column,
 * so comparisons against either bound behave as that date's day boundary.
 */
export function getAppDayUtcRange(dateKey: string): { startIso: string; endIso: string } {
  const startIso = `${dateKey}T00:00:00.000Z`
  const endIso   = `${dateKey}T23:59:59.999Z`
  return { startIso, endIso }
}