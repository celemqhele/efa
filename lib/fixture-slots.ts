import { addDays, format, parseISO } from 'date-fns'

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

export function getDailyCapacity(dateStr: string): { globalCap: number; teamCap: number } {
  const d = parseISO(dateStr)
  const weekend = d.getDay() === 0 || d.getDay() === 6
  if (weekend || isPublicHoliday(dateStr)) return { globalCap: 60, teamCap: 3 }
  return { globalCap: 30, teamCap: 3 }
}

export async function getSlotStateForDate(
  db: any,
  dateStr: string,
  tournamentId?: string
): Promise<{ globalUsed: number; teamUsed: Record<string, number> }> {
  let q = db
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('scheduled_date', dateStr)

  if (tournamentId) {
    q = q.eq('tournament_id', tournamentId)
  }

  const { data: fixtures } = await q

  const teamUsed: Record<string, number> = {}
  let globalUsed = 0

  for (const f of fixtures ?? []) {
    globalUsed += 2
    teamUsed[f.home_team_id] = (teamUsed[f.home_team_id] ?? 0) + 1
    teamUsed[f.away_team_id] = (teamUsed[f.away_team_id] ?? 0) + 1
  }

  return { globalUsed, teamUsed }
}

export interface SlotAssignment {
  home_team_id: string
  away_team_id: string
  scheduled_date: string
  leg?: number
}

export interface SlotOptions {
  // Total matches the whole tournament is allowed per 7-day window (default 30).
  weeklyMatches?: number
  // Total matches allowed on any single calendar day (default 5).
  dailyMatchCap?: number
}

/**
 * Balanced weekly fixture scheduling.
 *
 * Rules (applies to league, group and friendly generation):
 * - Weekly pool: `weeklyMatches` matches per 7-day window anchored to the start
 *   date. Each team plays `q` or `q+1` games per window where
 *   q = floor(2 * weeklyMatches / N). The leftover games go to the teams with
 *   the fewest total games so far, which rotates each week so every team stays
 *   level ("almost the same amount of games every week").
 * - Daily: at most `dailyMatchCap` matches per day tournament-wide, and at most
 *   one match per team per day.
 * - Legs: fixtures are processed grouped by leg ascending (stable within a leg),
 *   so every leg-1 fixture is dated before any leg-2 fixture.
 */
export async function assignFixtureSlots(
  db: any,
  fixtures: Array<{ home_team_id: string; away_team_id: string; leg?: number }>,
  startFrom?: string,
  reservedSlots: number = 0,
  tournamentId?: string,
  opts?: SlotOptions
): Promise<SlotAssignment[]> {
  const weeklyMatches = opts?.weeklyMatches ?? 30
  const dailyMatchCap = (opts?.dailyMatchCap ?? 5) - reservedSlots
  const startDate = startFrom ?? format(new Date(), 'yyyy-MM-dd')

  const teamIds = new Set<string>()
  for (const f of fixtures) {
    teamIds.add(f.home_team_id)
    teamIds.add(f.away_team_id)
  }
  const N = teamIds.size
  const slotsPerWeek = weeklyMatches * 2
  const q = Math.floor(slotsPerWeek / N)
  const rem = slotsPerWeek % N

  // Leg-ordered queue: all leg-1 fixtures are placed before any leg-2 fixture.
  // Stable sort preserves the input (round-robin) order within a leg.
  const queue = [...fixtures].sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1))

  const played = new Map<string, number>()
  for (const id of teamIds) played.set(id, 0)

  const assignments: SlotAssignment[] = []
  const dayCount: Record<string, number> = {}
  const dayTeams: Record<string, Set<string>> = {}
  const weekCount = new Map<string, number>()

  const maxWindows = 1000
  for (let w = 0; w < maxWindows && queue.length > 0; w++) {
    const winStart = addDays(parseISO(startDate), w * 7)

    // Award the leftover games to the `rem` lightest-loaded teams this window.
    const sorted = [...teamIds].sort((a, b) => (played.get(a) ?? 0) - (played.get(b) ?? 0))
    const target = new Map<string, number>()
    for (let i = 0; i < sorted.length; i++) {
      target.set(sorted[i], i < rem ? q + 1 : q)
    }
    weekCount.clear()
    for (const id of teamIds) weekCount.set(id, 0)

    for (let d = 0; d < 7 && queue.length > 0; d++) {
      const dateStr = format(addDays(winStart, d), 'yyyy-MM-dd')
      if (dayCount[dateStr] === undefined) dayCount[dateStr] = 0
      if (!dayTeams[dateStr]) dayTeams[dateStr] = new Set()

      let placed = true
      while (placed && queue.length > 0) {
        placed = false
        for (let i = 0; i < queue.length; i++) {
          const fx = queue[i]
          if (dayCount[dateStr] >= dailyMatchCap) break
          if (dayTeams[dateStr].has(fx.home_team_id) || dayTeams[dateStr].has(fx.away_team_id)) continue
          if ((weekCount.get(fx.home_team_id) ?? 0) >= (target.get(fx.home_team_id) ?? 0)) continue
          if ((weekCount.get(fx.away_team_id) ?? 0) >= (target.get(fx.away_team_id) ?? 0)) continue

          assignments.push({
            home_team_id: fx.home_team_id,
            away_team_id: fx.away_team_id,
            scheduled_date: dateStr,
            leg: fx.leg,
          })
          queue.splice(i, 1)
          dayCount[dateStr]++
          dayTeams[dateStr].add(fx.home_team_id)
          dayTeams[dateStr].add(fx.away_team_id)
          weekCount.set(fx.home_team_id, (weekCount.get(fx.home_team_id) ?? 0) + 1)
          weekCount.set(fx.away_team_id, (weekCount.get(fx.away_team_id) ?? 0) + 1)
          played.set(fx.home_team_id, (played.get(fx.home_team_id) ?? 0) + 1)
          played.set(fx.away_team_id, (played.get(fx.away_team_id) ?? 0) + 1)
          placed = true
          break
        }
      }
    }
  }

  // Safety net for any leftovers (shouldn't normally happen): park them on
  // consecutive days after the scheduled span.
  if (queue.length > 0) {
    let dateStr = format(addDays(parseISO(startDate), maxWindows * 7), 'yyyy-MM-dd')
    for (const fx of queue) {
      assignments.push({
        home_team_id: fx.home_team_id,
        away_team_id: fx.away_team_id,
        scheduled_date: dateStr,
        leg: fx.leg,
      })
      dateStr = format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd')
    }
  }

  return assignments
}
