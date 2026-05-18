import { addDays, format, parseISO, isBefore } from 'date-fns'

export interface PhaseFixture {
  home_team_id: string
  away_team_id: string
  matchday: number
  scheduled_date: string
  deadline: string
  round_type: 'league' | 'group' | 'sf' | 'final'
  leg: number
  group_name?: string
}

export interface PhaseConfig {
  leagueTeamIds: string[]
  uclGroups: { A: string[]; B: string[] }
  europaGroups: { A: string[]; B: string[] }
  startDate: string
  endDate: string
}

const SA_HOLIDAYS = new Set([
  '2025-01-01', '2025-03-21', '2025-04-18', '2025-04-21',
  '2025-04-27', '2025-05-01', '2025-06-16', '2025-08-09',
  '2025-09-24', '2025-12-16', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06',
  '2026-04-27', '2026-05-01', '2026-06-16', '2026-08-09',
  '2026-09-24', '2026-12-16', '2026-12-25', '2026-12-26',
])

function getSlotsPerDay(dateStr: string): number {
  const dow = parseISO(dateStr).getDay()
  return dow === 0 || dow === 6 || SA_HOLIDAYS.has(dateStr) ? 3 : 2
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Circle method round-robin for n teams (n must be even).
// Returns fixture pairs as slot-index references, two legs included.
function circleRoundRobin(n: number): Array<{
  matchday: number
  homeSlot: number
  awaySlot: number
  leg: number
}> {
  const rotating = Array.from({ length: n - 1 }, (_, i) => i + 1)
  const firstLeg: Array<{ matchday: number; homeSlot: number; awaySlot: number; leg: number }> = []

  for (let round = 0; round < n - 1; round++) {
    const circle = [0, ...rotating]
    const matchday = round + 1
    for (let i = 0; i < n / 2; i++) {
      firstLeg.push({
        matchday,
        homeSlot: circle[i],
        awaySlot: circle[n - 1 - i],
        leg: 1,
      })
    }
    // Rotate: last element moves to front of rotating array
    rotating.unshift(rotating.pop()!)
  }

  // Second leg: swap home/away, offset matchday
  const offset = n - 1
  const secondLeg = firstLeg.map((f) => ({
    matchday: f.matchday + offset,
    homeSlot: f.awaySlot,
    awaySlot: f.homeSlot,
    leg: 2,
  }))

  return [...firstLeg, ...secondLeg]
}

// Build an ordered list of date strings, one entry per available round slot.
// A weekday produces 2 entries, a weekend/holiday produces 3 entries.
function buildDateSlots(startDate: string, endDate: string): string[] {
  const slots: string[] = []
  let current = parseISO(startDate)
  const end = parseISO(endDate)

  while (!isBefore(end, current)) {
    const dateStr = format(current, 'yyyy-MM-dd')
    const n = getSlotsPerDay(dateStr)
    for (let i = 0; i < n; i++) slots.push(dateStr)
    current = addDays(current, 1)
  }

  return slots
}

// Distribute competition matchdays across available slots.
// UCL (10 matchdays) and Europa (6 matchdays) are spread evenly throughout.
// League (38 matchdays) fills the remaining slots in order.
function buildSchedule(startDate: string, endDate: string) {
  const slots = buildDateSlots(startDate, endDate)
  const N = slots.length

  const leagueMap = new Map<number, string>()
  const uclMap = new Map<number, string>()
  const europaMap = new Map<number, string>()
  const occupied = new Set<number>()

  function placeEvenly(count: number, map: Map<number, string>) {
    for (let md = 1; md <= count; md++) {
      let idx = Math.floor((md - 0.5) * N / count)
      while (idx < N && occupied.has(idx)) idx++
      if (idx < N) {
        occupied.add(idx)
        map.set(md, slots[idx])
      }
    }
  }

  placeEvenly(10, uclMap)
  placeEvenly(6, europaMap)

  // League fills the first 38 unoccupied slots
  let lmd = 1
  for (let i = 0; i < N && lmd <= 38; i++) {
    if (!occupied.has(i)) {
      leagueMap.set(lmd++, slots[i])
    }
  }

  return { league: leagueMap, ucl: uclMap, europa: europaMap }
}

export function generatePhaseFixtures(config: PhaseConfig): {
  leagueFixtures: PhaseFixture[]
  uclFixtures: PhaseFixture[]
  europaFixtures: PhaseFixture[]
} {
  const { leagueTeamIds, uclGroups, europaGroups, startDate, endDate } = config

  // Randomly assign real team IDs to circle-method slot positions
  const leagueSlots = shuffle(leagueTeamIds)
  const uclASlots = shuffle(uclGroups.A)
  const uclBSlots = shuffle(uclGroups.B)
  const euroASlots = shuffle(europaGroups.A)
  const euroBSlots = shuffle(europaGroups.B)

  const schedule = buildSchedule(startDate, endDate)

  function makeFixture(
    dateStr: string,
    home: string,
    away: string,
    matchday: number,
    roundType: PhaseFixture['round_type'],
    leg: number,
    groupName?: string,
  ): PhaseFixture {
    return {
      home_team_id: home,
      away_team_id: away,
      matchday,
      scheduled_date: dateStr,
      deadline: `${dateStr}T12:00:00Z`,
      round_type: roundType,
      leg,
      group_name: groupName,
    }
  }

  // League: 20 teams → 38 matchdays × 10 fixtures
  const leagueTemplate = circleRoundRobin(20)
  const leagueFixtures: PhaseFixture[] = leagueTemplate.map(({ matchday, homeSlot, awaySlot, leg }) =>
    makeFixture(
      schedule.league.get(matchday) ?? startDate,
      leagueSlots[homeSlot],
      leagueSlots[awaySlot],
      matchday,
      'league',
      leg,
    )
  )

  // UCL: 2 groups of 6 → 10 matchdays × 6 fixtures
  const uclTemplate = circleRoundRobin(6)
  const uclFixtures: PhaseFixture[] = [
    ...uclTemplate.map(({ matchday, homeSlot, awaySlot, leg }) =>
      makeFixture(
        schedule.ucl.get(matchday) ?? startDate,
        uclASlots[homeSlot],
        uclASlots[awaySlot],
        matchday,
        'group',
        leg,
        'A',
      )
    ),
    ...uclTemplate.map(({ matchday, homeSlot, awaySlot, leg }) =>
      makeFixture(
        schedule.ucl.get(matchday) ?? startDate,
        uclBSlots[homeSlot],
        uclBSlots[awaySlot],
        matchday,
        'group',
        leg,
        'B',
      )
    ),
  ]

  // Europa: 2 groups of 4 → 6 matchdays × 4 fixtures
  const europaTemplate = circleRoundRobin(4)
  const europaFixtures: PhaseFixture[] = [
    ...europaTemplate.map(({ matchday, homeSlot, awaySlot, leg }) =>
      makeFixture(
        schedule.europa.get(matchday) ?? startDate,
        euroASlots[homeSlot],
        euroASlots[awaySlot],
        matchday,
        'group',
        leg,
        'A',
      )
    ),
    ...europaTemplate.map(({ matchday, homeSlot, awaySlot, leg }) =>
      makeFixture(
        schedule.europa.get(matchday) ?? startDate,
        euroBSlots[homeSlot],
        euroBSlots[awaySlot],
        matchday,
        'group',
        leg,
        'B',
      )
    ),
  ]

  return { leagueFixtures, uclFixtures, europaFixtures }
}
