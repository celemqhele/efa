import { Database } from './supabase/types'

export type ManagerAvailability = Database['public']['Tables']['manager_availability']['Row']
export type DaySchedule = {
  day: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
  available: boolean
  start: string | null
  end: string | null
}

const HOME_BIAS = 0.3

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
  const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
  
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
