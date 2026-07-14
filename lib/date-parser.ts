const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function dateToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${padTwo(d.getUTCMonth() + 1)}-${padTwo(d.getUTCDate())}`
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 0 || m > 11) return false
  if (d < 1 || d > 31) return false
  const test = new Date(Date.UTC(y, m, d))
  return test.getUTCFullYear() === y && test.getUTCMonth() === m && test.getUTCDate() === d
}

function currentYear(): number {
  return new Date().getUTCFullYear()
}

/**
 * Parse a user-typed date string into a Date and YYYY-MM-DD key.
 * Supports South African date conventions (DD/MM default).
 *
 * Formats handled:
 *   2026-07-12          (ISO)
 *   12/07/2026          (DD/MM/YYYY)
 *   12/07/26            (DD/MM/YY)
 *   12 Jul              (day + month name)
 *   Jul 12              (month name + day)
 *   12 July 2026        (day + month name + year)
 *   July 12 2026        (month name + day + year)
 *   12th July           (ordinal + month name)
 */
export function parseUserDate(input: string): { date: Date; dateKey: string } | null {
  const raw = input.trim()
  if (!raw) return null

  // Strip ordinals: "12th", "1st", "2nd", "3rd"
  const stripped = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1')
  const low = stripped.toLowerCase()

  // ── 1. ISO format: 2026-07-12 ────────────────────────────────────────────
  const isoMatch = low.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10) - 1
    const d = parseInt(isoMatch[3], 10)
    if (isValidDate(y, m, d)) {
      const date = new Date(Date.UTC(y, m, d))
      return { date, dateKey: dateToKey(date) }
    }
  }

  // ── 2. Slash format: DD/MM/YYYY or DD/MM/YY or MM/DD/YYYY ────────────────
  const slashMatch = stripped.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/)
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10)
    const b = parseInt(slashMatch[2], 10)
    const rawYear = slashMatch[3]

    let year: number
    let day: number
    let month: number

    if (rawYear) {
      year = rawYear.length === 2 ? 2000 + parseInt(rawYear, 10) : parseInt(rawYear, 10)
      // Default to DD/MM (SA convention)
      day = a
      month = b - 1
    } else {
      // No year — assume current year
      year = currentYear()
      day = a
      month = b - 1
      // If day > 31 it's probably MM/DD without year — swap
      if (day > 31) {
        ;[day, month] = [month + 1, day - 1]
      }
    }

    if (isValidDate(year, month, day)) {
      const date = new Date(Date.UTC(year, month, day))
      return { date, dateKey: dateToKey(date) }
    }

    // Try swapping if first attempt failed (MM/DD fallback)
    if (!rawYear) {
      day = b
      month = a - 1
      if (isValidDate(year, month, day)) {
        const date = new Date(Date.UTC(year, month, day))
        return { date, dateKey: dateToKey(date) }
      }
    }
  }

  // ── 3. Month name formats ─────────────────────────────────────────────────
  // "12 Jul", "12 Jul 2026", "Jul 12", "Jul 12 2026", "12 July 2026", etc.
  const monthWordPattern = Object.keys(MONTH_NAMES).join('|')

  // "DD MonthName" or "DD MonthName YYYY"
  const dayFirst = low.match(
    new RegExp(`^(\\d{1,2})\\s+(${monthWordPattern})(?:\\s+(\\d{4}))?$`)
  )
  if (dayFirst) {
    const d = parseInt(dayFirst[1], 10)
    const m = MONTH_NAMES[dayFirst[2]]
    const y = dayFirst[3] ? parseInt(dayFirst[3], 10) : currentYear()
    if (m !== undefined && isValidDate(y, m, d)) {
      const date = new Date(Date.UTC(y, m, d))
      return { date, dateKey: dateToKey(date) }
    }
  }

  // "MonthName DD" or "MonthName DD YYYY"
  const monthFirst = low.match(
    new RegExp(`^(${monthWordPattern})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`)
  )
  if (monthFirst) {
    const m = MONTH_NAMES[monthFirst[1]]
    const d = parseInt(monthFirst[2], 10)
    const y = monthFirst[3] ? parseInt(monthFirst[3], 10) : currentYear()
    if (m !== undefined && isValidDate(y, m, d)) {
      const date = new Date(Date.UTC(y, m, d))
      return { date, dateKey: dateToKey(date) }
    }
  }

  // ── 4. Short numeric with month hint ──────────────────────────────────────
  // "12/7" → DD/MM with no year
  const shortSlash = stripped.match(/^(\d{1,2})[\/\-.](\d{1,2})$/)
  if (shortSlash) {
    const a = parseInt(shortSlash[1], 10)
    const b = parseInt(shortSlash[2], 10)
    const year = currentYear()

    // Try DD/MM first (SA default)
    if (isValidDate(year, b - 1, a)) {
      const date = new Date(Date.UTC(year, b - 1, a))
      return { date, dateKey: dateToKey(date) }
    }
    // Try MM/DD
    if (isValidDate(year, a - 1, b)) {
      const date = new Date(Date.UTC(year, a - 1, b))
      return { date, dateKey: dateToKey(date) }
    }
  }

  return null
}
