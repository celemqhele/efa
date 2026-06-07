import { addDays, format, isWeekend, parseISO, isBefore, isEqual } from 'date-fns'

export interface FixtureSlot {
  date: string
  roundsAvailable: number
}

export interface GeneratedFixture {
  home_team_id: string
  away_team_id: string
  matchday: number
  scheduled_date: string
  deadline: string
  round_type: 'league' | 'group' | 'qf' | 'sf' | 'final' | 'super_cup'
  leg: number
}

// South African public holidays 2025
const SA_PUBLIC_HOLIDAYS_2025 = new Set([
  '2025-01-01', '2025-03-21', '2025-04-18', '2025-04-21',
  '2025-04-27', '2025-05-01', '2025-06-16', '2025-08-09',
  '2025-09-24', '2025-12-16', '2025-12-25', '2025-12-26',
])

const SA_PUBLIC_HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06',
  '2026-04-27', '2026-05-01', '2026-06-16', '2026-08-09',
  '2026-09-24', '2026-12-16', '2026-12-25', '2026-12-26',
])

function isPublicHoliday(dateStr: string): boolean {
  return SA_PUBLIC_HOLIDAYS_2025.has(dateStr) || SA_PUBLIC_HOLIDAYS_2026.has(dateStr)
}

function getSlotsPerDay(dateStr: string): number {
  const date = parseISO(dateStr)
  const dow = date.getDay()
  const weekend = dow === 0 || dow === 6
  const holiday = isPublicHoliday(dateStr)
  if (weekend || holiday) return 3
  return 2
}

function isBreak(dateStr: string, breaks: Array<{ break_start: string; break_end: string }>): boolean {
  return breaks.some((b) => {
    const d = parseISO(dateStr)
    const start = parseISO(b.break_start)
    const end = parseISO(b.break_end)
    return (isEqual(d, start) || isBefore(start, d) || isEqual(d, start)) &&
      (isBefore(d, end) || isEqual(d, end))
  })
}

function generateRoundRobin(teamIds: string[], numRounds: number = 2): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  
  // Round 1: Everyone plays everyone once
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]])
    }
  }

  // Round 2 (and more): Mirror the pairs for H&A or just repeat
  for (let r = 2; r <= numRounds; r++) {
    const roundPairs: Array<[string, string]> = []
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        // If even round, flip home/away for H&A effect
        if (r % 2 === 0) {
          roundPairs.push([teamIds[j], teamIds[i]])
        } else {
          roundPairs.push([teamIds[i], teamIds[j]])
        }
      }
    }
    pairs.push(...roundPairs)
  }

  return pairs
}

// Shuffle array
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateLeagueFixtures(
  teamIds: string[],
  startDate: string,
  endDate: string,
  breaks: Array<{ break_start: string; break_end: string }>,
  tournamentId: string,
  numRounds: number = 2
): GeneratedFixture[] {
  const allPairs = shuffle(generateRoundRobin(teamIds, numRounds))
  const fixtures: GeneratedFixture[] = []

  let currentDate = parseISO(startDate)
  const end = parseISO(endDate)
  let matchday = 1
  let pairIdx = 0

  while (pairIdx < allPairs.length && !isBefore(end, currentDate)) {
    const dateStr = format(currentDate, 'yyyy-MM-dd')

    if (isBreak(dateStr, breaks)) {
      currentDate = addDays(currentDate, 1)
      continue
    }

    const slotsToday = getSlotsPerDay(dateStr)
    const usedTeamsToday = new Set<string>()
    let slotsFilled = 0

    while (slotsFilled < slotsToday && pairIdx < allPairs.length) {
      const [home, away] = allPairs[pairIdx]
      if (usedTeamsToday.has(home) || usedTeamsToday.has(away)) {
        // Try next pair
        const remaining = allPairs.slice(pairIdx).find(
          ([h, a]) => !usedTeamsToday.has(h) && !usedTeamsToday.has(a)
        )
        if (!remaining) break
        const remIdx = allPairs.indexOf(remaining, pairIdx)
        // Swap to front
        ;[allPairs[pairIdx], allPairs[remIdx]] = [allPairs[remIdx], allPairs[pairIdx]]
        continue
      }

      // Deadline: 14:00 SAST = 12:00 UTC
      const deadline = `${dateStr}T12:00:00Z`

      fixtures.push({
        home_team_id: home,
        away_team_id: away,
        matchday,
        scheduled_date: dateStr,
        deadline,
        round_type: 'league',
        leg: 1,
      })

      usedTeamsToday.add(home)
      usedTeamsToday.add(away)
      slotsFilled++
      pairIdx++
      matchday++
    }

    currentDate = addDays(currentDate, 1)
  }

  return fixtures
}

export function generateGroupFixtures(
  groups: Record<string, string[]>,
  startDate: string,
  endDate: string,
  breaks: Array<{ break_start: string; break_end: string }>,
  numRounds: number = 2
): GeneratedFixture[] {
  const allPairs: Array<[string, string]> = []

  for (const teamIds of Object.values(groups)) {
    allPairs.push(...generateRoundRobin(teamIds, numRounds))
  }

  const shuffled = shuffle(allPairs)
  const fixtures: GeneratedFixture[] = []

  let currentDate = parseISO(startDate)
  const end = parseISO(endDate)
  let matchday = 1
  let pairIdx = 0

  while (pairIdx < shuffled.length && !isBefore(end, currentDate)) {
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    if (isBreak(dateStr, breaks)) { currentDate = addDays(currentDate, 1); continue }

    const slotsToday = getSlotsPerDay(dateStr)
    const usedTeamsToday = new Set<string>()
    let slotsFilled = 0

    while (slotsFilled < slotsToday && pairIdx < shuffled.length) {
      const [home, away] = shuffled[pairIdx]
      if (usedTeamsToday.has(home) || usedTeamsToday.has(away)) { pairIdx++; continue }

      fixtures.push({
        home_team_id: home,
        away_team_id: away,
        matchday,
        scheduled_date: dateStr,
        deadline: `${dateStr}T12:00:00Z`,
        round_type: 'group',
        leg: 1,
      })

      usedTeamsToday.add(home)
      usedTeamsToday.add(away)
      slotsFilled++
      pairIdx++
      matchday++
    }

    currentDate = addDays(currentDate, 1)
  }

  return fixtures
}

export function findNextAvailableSlot(
  afterDate: string,
  occupiedDates: Record<string, Set<string>>,
  teamA: string,
  teamB: string,
  breaks: Array<{ break_start: string; break_end: string }>
): string {
  let current = parseISO(afterDate)

  for (let i = 0; i < 365; i++) {
    const dateStr = format(current, 'yyyy-MM-dd')
    if (!isBreak(dateStr, breaks)) {
      const occupied = occupiedDates[dateStr] ?? new Set()
      if (!occupied.has(teamA) && !occupied.has(teamB)) {
        return dateStr
      }
    }
    current = addDays(current, 1)
  }

  return format(addDays(parseISO(afterDate), 7), 'yyyy-MM-dd')
}
