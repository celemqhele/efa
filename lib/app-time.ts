// "What day is it" / "what UTC range covers this day" helpers.
//
// We treat a fixture's scheduled_date YYYY-MM-DD prefix (the UTC date) as
// the canonical day a fixture belongs to. The calendar groups by that
// prefix, so admin manage / dashboard need to match.
//
// Today is the UTC date so it lines up with how fixtures are stored.

export const APP_TIME_ZONE = 'Africa/Johannesburg'

/** Format a Date as YYYY-MM-DD using its UTC components. */
export function getDateKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Today as YYYY-MM-DD (UTC). */
export async function getAppTodayKey(_supabase?: unknown): Promise<string> {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Given a YYYY-MM-DD date key, return the UTC ISO range covering that full
 * calendar day in UTC (00:00:00 to 23:59:59.999). This matches the calendar's
 * bucketing of fixtures by their UTC-date prefix.
 */
export function getAppDayUtcRange(dateKey: string): { startIso: string; endIso: string } {
  const startIso = `${dateKey}T00:00:00.000Z`
  const endIso   = `${dateKey}T23:59:59.999Z`
  return { startIso, endIso }
}
