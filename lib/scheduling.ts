import { Database } from './supabase/types'
import { addDays, format } from 'date-fns'

export type ManagerAvailability = Database['public']['Tables']['manager_availability']['Row']
export type DaySchedule = {
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
  available: boolean
  start: string | null
  end: string | null
}

const HOME_BIAS = 0.3

export const ALL_DAYS_FULL: DaySchedule[] = [
  { day: 'MON', available: true, start: '00:00', end: '23:59' },
  { day: 'TUE', available: true, start: '00:00', end: '23:59' },
  { day: 'WED', available: true, start: '00:00', end: '23:59' },
  { day: 'THU', available: true, start: '00:00', end: '23:59' },
  { day: 'FRI', available: true, start: '00:00', end: '23:59' },
  { day: 'SAT', available: true, start: '00:00', end: '23:59' },
  { day: 'SUN', available: true, start: '00:00', end: '23:59' },
]

export const DEFAULT_SAT_EVENING: DaySchedule[] = [
  { day: 'MON', available: false, start: null, end: null },
  { day: 'TUE', available: false, start: null, end: null },
  { day: 'WED', available: false, start: null, end: null },
  { day: 'THU', available: false, start: null, end: null },
  { day: 'FRI', available: false, start: null, end: null },
  { day: 'SAT', available: true, start: '18:00', end: '19:00' },
  { day: 'SUN', available: false, start: null, end: null },
]

export function resolveAvailability(
  schedule: DaySchedule[] | undefined | null,
  opponentSchedule: DaySchedule[] | undefined | null,
): DaySchedule[] {
  if (schedule && schedule.length > 0) return schedule
  if (opponentSchedule && opponentSchedule.length > 0) return opponentSchedule
  return DEFAULT_SAT_EVENING
}

export function getDateForDay(dayName: string, refDate: Date): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const targetDay = days.indexOf(dayName)
  let d = refDate
  for (let i = 0; i < 7; i++) {
    if (d.getDay() === targetDay) break
    d = addDays(d, 1)
  }
  return format(d, 'yyyy-MM-dd')
}

// Helpers
const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const toTimeString = (minutes: number): string => {
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

const dayNumber = (day: string): number => {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  return days.indexOf(day)
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max))

// --- Phase 1: Find Match Day ---------------------------

export function findMatchDay(homeSchedule: DaySchedule[], awaySchedule: DaySchedule[]): string {
  const homeDays = homeSchedule.filter(d => d.available).map(d => d.day)
  const awayDays = awaySchedule.filter(d => d.available).map(d => d.day)

  const overlapDays = homeDays.filter(d => awayDays.includes(d))

  if (overlapDays.length > 0) {
    const preferredHomeDay = homeDays[0] // min(homeDays)
    const sortedOverlap = overlapDays.sort((a, b) => dayNumber(a) - dayNumber(b))
    
    // Pick day closest to preferredHomeDay
    const homeDayNum = dayNumber(preferredHomeDay)
    return sortedOverlap.reduce((closest, current) => 
      Math.abs(dayNumber(current) - homeDayNum) < Math.abs(dayNumber(closest) - homeDayNum) ? current : closest
    )
  }

  // No overlapping days
  const homeDayNums = homeDays.map(dayNumber)
  const awayDayNums = awayDays.map(dayNumber)

  let bestHome = homeDayNums[0]
  let bestAway = awayDayNums[0]
  let minDistance = Infinity

  for (const h of homeDayNums) {
    for (const a of awayDayNums) {
      const dist = Math.abs(h - a)
      if (dist < minDistance) {
        minDistance = dist
        bestHome = h
        bestAway = a
      }
    }
  }

  const gap = bestAway - bestHome
  let meetPoint: number

  if (gap > 0) {
    meetPoint = bestHome + gap * HOME_BIAS
  } else {
    meetPoint = bestAway + Math.abs(gap) * (1 - HOME_BIAS)
  }

  const roundedMeet = Math.round(meetPoint)

  // Find closest available day
  const availableDays = [...new Set([...homeDays, ...awayDays])].map(d => ({day: d, num: dayNumber(d)}))
  
  return availableDays.reduce((closest, current) => {
    const distC = Math.abs(current.num - roundedMeet)
    const distClosest = Math.abs(closest.num - roundedMeet)
    if (distC < distClosest) return current
    if (distC === distClosest) return homeDays.includes(current.day) ? current : closest // Home wins tie
    return closest
  }).day
}

// --- Phase 2: Find Time Window -----------------------------

export function findTimeWindow(homeSchedule: DaySchedule[], awaySchedule: DaySchedule[], matchDay: string) {
  const homeAvail = homeSchedule.find(d => d.day === matchDay) ?? { available: false, start: "00:00", end: "23:59" }
  const awayAvail = awaySchedule.find(d => d.day === matchDay) ?? { available: false, start: "00:00", end: "23:59" }

  const hStart = toMinutes(homeAvail.available ? (homeAvail.start ?? '00:00') : '00:00')
  const hEnd = toMinutes(homeAvail.available ? (homeAvail.end ?? '23:59') : '23:59')
  const aStart = toMinutes(awayAvail.available ? (awayAvail.start ?? '00:00') : '00:00')
  const aEnd = toMinutes(awayAvail.available ? (awayAvail.end ?? '23:59') : '23:59')

  const overlapStart = Math.max(hStart, aStart)
  const overlapEnd = Math.min(hEnd, aEnd)

  if (overlapEnd - overlapStart >= 60) {
    const windowStart = clamp(hStart, overlapStart, overlapEnd - 60)
    return { start: toTimeString(windowStart), end: toTimeString(windowStart + 60) }
  }

  // No usable time overlap
  let meetPoint: number
  if (hEnd < aStart) {
    meetPoint = hEnd + (aStart - hEnd) * HOME_BIAS
  } else {
    meetPoint = aEnd + (hStart - aEnd) * (1 - HOME_BIAS)
  }

  const windowStart = Math.round(meetPoint - 30)
  return { start: toTimeString(windowStart), end: toTimeString(windowStart + 60) }
}
