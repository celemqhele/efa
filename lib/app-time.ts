// Single source of truth for "what day is it" in the app's local timezone.
//
// Why this exists: the Vercel server runs in UTC, but the app/users are in
// Africa/Johannesburg (UTC+2, no DST). Naive use of `new Date()` for "today"
// causes the dashboard to flip to "yesterday" during the 22:00-24:00 UTC window
// each day. Use these helpers anywhere we need to filter/display "today".

export const APP_TIME_ZONE = 'Africa/Johannesburg'

/**
 * Format a Date as a YYYY-MM-DD key in the app's local timezone using
 * Intl.DateTimeFormat.formatToParts — robust across Node/ICU builds.
 */
export function getDateKeyFromDate(date: Date): string {
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

/**
 * Get today's date as a YYYY-MM-DD key in the app's local timezone.
 *
 * Tries the Supabase `get_app_time` RPC first (single source of truth — the
 * database's clock + the app's timezone). Falls back to computing locally in
 * Node if the RPC is unavailable or errors out.
 */
export async function getAppTodayKey(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_app_time')
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data
      if (row?.today_local) return String(row.today_local)
    }
  } catch {
    // fall through to local computation
  }
  return getDateKeyFromDate(new Date())
}

/**
 * Given a YYYY-MM-DD date key in app-local time, return the UTC ISO range
 * covering that full day. JHB is UTC+2 year-round (no DST) so the offset is
 * hardcoded — replace this if the app ever moves to a DST-observing TZ.
 */
export function getAppDayUtcRange(dateKey: string): { startIso: string; endIso: string } {
  const startIso = new Date(`${dateKey}T00:00:00+02:00`).toISOString()
  const endIso = new Date(new Date(startIso).getTime() + 24 * 60 * 60 * 1000).toISOString()
  return { startIso, endIso }
}
