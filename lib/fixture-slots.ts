import { addDays, format, parseISO, subDays } from 'date-fns'

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

function countSlotsInWindow(
  windowStart: string,
  dateStr: string,
  assignments: SlotAssignment[]
): number {
  return assignments.filter(a =>
    a.scheduled_date >= windowStart &&
    a.scheduled_date <= dateStr
  ).length * 2
}

export async function assignFixtureSlots(
  db: any,
  fixtures: Array<{ home_team_id: string; away_team_id: string; leg?: number }>,
  startFrom?: string,
  reservedSlots: number = 0,
  tournamentId?: string,
  weeklySlotBudget?: number
): Promise<SlotAssignment[]> {
  const startDate = startFrom ?? format(new Date(), 'yyyy-MM-dd')
  const assignments: SlotAssignment[] = []
  const slotCache: Record<string, { globalUsed: number; teamUsed: Record<string, number> }> = {}

  for (const fx of fixtures) {
    const { home_team_id, away_team_id } = fx
    let currentDate = parseISO(startDate)
    let assigned = false

    for (let safety = 0; safety < 730; safety++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      if (!slotCache[dateStr]) {
        slotCache[dateStr] = await getSlotStateForDate(db, dateStr, tournamentId)
      }

      const state = slotCache[dateStr]
      const { globalCap, teamCap } = getDailyCapacity(dateStr)
      const cap = globalCap - reservedSlots * 2

      const homeUsedToday = state.teamUsed[home_team_id] ?? 0
      const awayUsedToday = state.teamUsed[away_team_id] ?? 0

      if (homeUsedToday >= teamCap || awayUsedToday >= teamCap) {
        currentDate = addDays(currentDate, 1)
        continue
      }

      if (state.globalUsed + 2 > cap) {
        currentDate = addDays(currentDate, 1)
        continue
      }

      if (weeklySlotBudget !== undefined && weeklySlotBudget > 0) {
        const windowStart = format(subDays(currentDate, 6), 'yyyy-MM-dd')
        const slotsUsed = countSlotsInWindow(windowStart, dateStr, assignments)
        if (slotsUsed + 2 > weeklySlotBudget) {
          currentDate = addDays(currentDate, 1)
          continue
        }
      }

      assignments.push({ home_team_id, away_team_id, scheduled_date: dateStr, leg: fx.leg })
      state.globalUsed += 2
      state.teamUsed[home_team_id] = homeUsedToday + 1
      state.teamUsed[away_team_id] = awayUsedToday + 1
      assigned = true
      break
    }

    if (!assigned) {
      assignments.push({ home_team_id, away_team_id, scheduled_date: format(currentDate ?? parseISO(startDate), 'yyyy-MM-dd'), leg: fx.leg })
    }
  }

  return assignments
}
