import { addDays, format, parseISO } from 'date-fns'

/**
 * Season calendar: the single source of truth for WHEN things are played.
 *
 * A season is a run of consecutive days. Every day belongs to exactly one
 * owner:
 *   - a LEAGUE day  -> every league plays one round that day,
 *   - a CUP day     -> one competition family (CAF, Nedbank, ...) plays that
 *                      day and the leagues are paused.
 *
 * Leagues therefore never share a day with a cup, and two different cup
 * families never share a day. CAF Champions League and CAF Confederations
 * League are the one approved exception: they share the `caf` window because
 * they are the same competition family and use disjoint team pools.
 *
 * One league round = one calendar day (a 16-team division plays its 8 fixtures
 * on that day), which is why a 2 x 16-team season is
 *   30 league days + 19 cup days = 49 days
 * for the `full` preset.
 */

export type CalendarKey = 'caf' | 'nedbank' | 'mtn8' | 'international' | 'super_cup'

export type SeasonPresetId = 'compact' | 'standard' | 'full'

export interface CupWindow {
  key: CalendarKey
  /** First day of the window (inclusive), yyyy-MM-dd. */
  start: string
  /** Last day of the window (inclusive), yyyy-MM-dd. */
  end: string
  /** Every day in the window, in order. */
  days: string[]
}

export interface SeasonCalendar {
  preset: SeasonPresetId
  startDate: string
  endDate: string
  /** Total calendar days the season spans (league days + cup days). */
  totalDays: number
  /** Number of league rounds the calendar was sized for. */
  leagueRounds: number
  /** One date per league round: leagueDays[n - 1] is the date of round n. */
  leagueDays: string[]
  windows: CupWindow[]
  /** Flattened, de-duplicated window days per competition key. */
  windowsByKey: Record<string, string[]>
}

interface BreakSpec {
  key: CalendarKey
  /** Position in the league calendar, as a fraction of the total rounds. */
  at: number
  days: number
}

// Break placement is expressed as a fraction of the league calendar so the same
// preset works for any division size. For a 30-round season the `full` preset
// resolves to breaks after rounds 5, 9, 14, 18, 24 and 27:
//   international 2 days, CAF 4, Nedbank 3, CAF 4, Nedbank 3, CAF 3
//   = 19 cup days -> 30 + 19 = 49.
const PRESET_BREAKS: Record<SeasonPresetId, BreakSpec[]> = {
  // League + international breaks only, no domestic or continental cups.
  compact: [
    { key: 'international', at: 0.18, days: 2 },
    { key: 'international', at: 0.62, days: 2 },
  ],
  // League, internationals and one window per cup family.
  standard: [
    { key: 'international', at: 0.18, days: 2 },
    { key: 'caf', at: 0.32, days: 3 },
    { key: 'nedbank', at: 0.48, days: 3 },
    { key: 'caf', at: 0.66, days: 3 },
    { key: 'nedbank', at: 0.88, days: 3 },
  ],
  // Full domestic + continental calendar (the approved 49-day season).
  full: [
    { key: 'international', at: 0.18, days: 2 },
    { key: 'caf', at: 0.3, days: 4 },
    { key: 'nedbank', at: 0.47, days: 3 },
    { key: 'caf', at: 0.6, days: 4 },
    { key: 'nedbank', at: 0.8, days: 3 },
    { key: 'caf', at: 0.9, days: 3 },
  ],
}

export const SEASON_PRESET_IDS: SeasonPresetId[] = ['compact', 'standard', 'full']

export function isSeasonPresetId(value: unknown): value is SeasonPresetId {
  return typeof value === 'string' && (SEASON_PRESET_IDS as string[]).includes(value)
}

/** Total days a preset needs for a given number of league rounds. */
export function presetTotalDays(preset: SeasonPresetId, leagueRounds: number): number {
  return leagueRounds + presetBreakDays(preset)
}

function presetBreakDays(preset: SeasonPresetId): number {
  return (PRESET_BREAKS[preset] ?? PRESET_BREAKS.full).reduce((sum, b) => sum + b.days, 0)
}

function dayString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Build the whole season calendar from a start date, the number of league
 * rounds and a preset.
 */
export function buildSeasonCalendar(
  startDate: string,
  leagueRounds: number,
  preset: SeasonPresetId = 'full'
): SeasonCalendar {
  const rounds = Math.max(1, Math.floor(leagueRounds))
  const spec = PRESET_BREAKS[preset] ?? PRESET_BREAKS.full

  // Resolve fractional anchors to actual rounds, clamp into range and group by
  // round. Two breaks after the same round run back to back.
  const byRound = new Map<number, BreakSpec[]>()
  for (const b of spec) {
    const afterRound = Math.min(rounds, Math.max(1, Math.round(b.at * rounds)))
    const list = byRound.get(afterRound) ?? []
    list.push(b)
    byRound.set(afterRound, list)
  }

  const leagueDays: string[] = []
  const windows: CupWindow[] = []
  const windowsByKey: Record<string, string[]> = {}

  let cursor = parseISO(startDate)

  for (let round = 1; round <= rounds; round++) {
    leagueDays.push(dayString(cursor))
    cursor = addDays(cursor, 1)

    for (const b of byRound.get(round) ?? []) {
      const days: string[] = []
      for (let d = 0; d < b.days; d++) {
        days.push(dayString(cursor))
        cursor = addDays(cursor, 1)
      }
      if (days.length === 0) continue
      windows.push({ key: b.key, start: days[0], end: days[days.length - 1], days })
      const bucket = windowsByKey[b.key] ?? []
      for (const day of days) if (!bucket.includes(day)) bucket.push(day)
      windowsByKey[b.key] = bucket.sort()
    }
  }

  const endDate = dayString(addDays(cursor, -1))
  const totalDays =
    Math.round((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / 86_400_000) + 1

  return {
    preset,
    startDate,
    endDate,
    totalDays,
    leagueRounds: rounds,
    leagueDays,
    windows,
    windowsByKey,
  }
}

/**
 * Which calendar window a tournament belongs to, inferred from its name.
 * Returns null for tournaments that are not part of the season calendar.
 */
export function inferCalendarKey(name: string | null | undefined): CalendarKey | null {
  const n = String(name ?? '').toLowerCase()
  if (!n) return null
  if (n.includes('caf')) return 'caf'
  if (n.includes('nedbank')) return 'nedbank'
  if (n.includes('mtn')) return 'mtn8'
  if (n.includes('international') || n.includes('world cup') || n.includes('afcon')) {
    return 'international'
  }
  if (n.includes('super cup')) return 'super_cup'
  return null
}

/** Read a stored calendar out of a `seasons.settings` value. */
export function readSeasonCalendar(settings: unknown): SeasonCalendar | null {
  const calendar = (settings as any)?.calendar
  if (!calendar || !Array.isArray(calendar.leagueDays)) return null
  return calendar as SeasonCalendar
}

/**
 * The days a cup may use, given its competition key and the season calendar.
 * Empty when the season has no calendar or the key has no window.
 */
export function calendarDaysFor(calendar: SeasonCalendar | null, key: CalendarKey | null): string[] {
  if (!calendar || !key) return []
  return calendar.windowsByKey[key] ?? []
}
