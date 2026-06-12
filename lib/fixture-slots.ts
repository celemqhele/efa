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
  if (weekend || isPublicHoliday(dateStr)) return { globalCap: 30, teamCap: 3 }
  return { globalCap: 20, teamCap: 2 }
}

export async function getSlotStateForDate(db: any, dateStr: string): Promise<{ globalUsed: number; teamUsed: Record<string, number> }> {
  const { data: fixtures } = await db
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('scheduled_date', dateStr)

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
}

export async function assignFixtureSlots(
  db: any,
  fixtures: Array<{ home_team_id: string; away_team_id: string }>,
  startFrom?: string
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
        slotCache[dateStr] = await getSlotStateForDate(db, dateStr)
      }

      const state = slotCache[dateStr]
      const { globalCap, teamCap } = getDailyCapacity(dateStr)

      const homeUsed = state.teamUsed[home_team_id] ?? 0
      const awayUsed = state.teamUsed[away_team_id] ?? 0

      if (state.globalUsed + 2 <= globalCap && homeUsed < teamCap && awayUsed < teamCap) {
        assignments.push({ home_team_id, away_team_id, scheduled_date: dateStr })
        state.globalUsed += 2
        state.teamUsed[home_team_id] = homeUsed + 1
        state.teamUsed[away_team_id] = awayUsed + 1
        assigned = true
        break
      }

      currentDate = addDays(currentDate, 1)
    }

    if (!assigned) {
      assignments.push({ home_team_id, away_team_id, scheduled_date: format(currentDate ?? parseISO(startDate), 'yyyy-MM-dd') })
    }
  }

  return assignments
}
