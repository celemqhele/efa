// Local dry-run verification of the balanced fixture scheduler.
// Does NOT touch the database — calls the generators directly with a null db.
//
// Run: npx tsx scripts/dry-run-schedule.ts

import { parseISO } from 'date-fns'
import {
  generateLeagueFixtures,
  generateGroupFixtures,
  generateExhibitionFixtures,
} from '../lib/fixture-generator'
import type { SlotAssignment } from '../lib/fixture-slots'

function makeTeams(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
}

interface Report {
  label: string
  fixtures: number
  dateRange: string
  maxDay: number
  maxTeamDay: number
  windows: Array<{ window: number; min: number; max: number; total: number }>
  errors: string[]
}

function analyze(
  label: string,
  assignments: SlotAssignment[],
  opts?: { perTeamTarget?: number; windowTolerance?: number }
): Report {
  const errors: string[] = []
  if (assignments.length === 0) {
    return { label, fixtures: 0, dateRange: '', maxDay: 0, maxTeamDay: 0, windows: [], errors: ['no fixtures assigned'] }
  }

  const dates = assignments.map((a) => a.scheduled_date).sort()
  const start = dates[0]
  const end = dates[dates.length - 1]

  const dayCount = new Map<string, number>()
  const teamGamesPerDay = new Map<string, Map<string, number>>()
  const teamTotal = new Map<string, number>()
  const windowTeams = new Map<string, Map<string, number>>()
  let maxLeg1Date = ''
  let minLeg2Date = '9999-99-99'
  let sawLeg1 = false
  let sawLeg2 = false

  for (const a of assignments) {
    const d = a.scheduled_date
    dayCount.set(d, (dayCount.get(d) ?? 0) + 1)
    for (const t of [a.home_team_id, a.away_team_id]) {
      if (!teamGamesPerDay.has(t)) teamGamesPerDay.set(t, new Map())
      teamGamesPerDay.get(t)!.set(d, (teamGamesPerDay.get(t)!.get(d) ?? 0) + 1)
      teamTotal.set(t, (teamTotal.get(t) ?? 0) + 1)
      const w = Math.floor((parseISO(d).getTime() - parseISO(start).getTime()) / (7 * 86400000))
      if (!windowTeams.has(t)) windowTeams.set(t, new Map())
      windowTeams.get(t)!.set(String(w), (windowTeams.get(t)!.get(String(w)) ?? 0) + 1)
    }
    if (a.leg === 1 || a.leg == null) {
      sawLeg1 = true
      if (d > maxLeg1Date) maxLeg1Date = d
    } else {
      sawLeg2 = true
      if (d < minLeg2Date) minLeg2Date = d
    }
  }

  let maxDay = 0
  for (const [d, c] of dayCount) {
    if (c > maxDay) maxDay = c
    if (c > 5) errors.push(`day ${d} has ${c} matches (cap 5)`)
  }

  let maxTeamDay = 0
  for (const [t, days] of teamGamesPerDay) {
    for (const [d, c] of days) {
      if (c > maxTeamDay) maxTeamDay = c
      if (c > 1) errors.push(`team ${t} played ${c} games on ${d}`)
    }
  }

  const allWindows = new Set<string>()
  for (const t of teamTotal.keys()) for (const w of windowTeams.get(t)!.keys()) allWindows.add(w)
  const windows: Report['windows'] = []
  for (const w of [...allWindows].sort((a, b) => Number(a) - Number(b))) {
    const counts = [...teamTotal.keys()].map((t) => windowTeams.get(t)!.get(w) ?? 0)
    const min = Math.min(...counts)
    const max = Math.max(...counts)
    const total = counts.reduce((a, b) => a + b, 0)
    windows.push({ window: Number(w), min, max, total })
    if (total > 60) errors.push(`window ${w} has ${total} team-games (pool 60)`)
    if (opts?.windowTolerance != null && max - min > opts.windowTolerance) {
      errors.push(`window ${w}: team games range ${min}..${max} (tolerance ${opts.windowTolerance})`)
    }
  }

  if (sawLeg1 && sawLeg2 && maxLeg1Date > minLeg2Date) {
    errors.push(`leg overlap: leg1 last ${maxLeg1Date} > leg2 first ${minLeg2Date}`)
  }

  if (opts?.perTeamTarget != null) {
    for (const [t, total] of teamTotal) {
      if (total !== opts.perTeamTarget) errors.push(`team ${t} played ${total} (target ${opts.perTeamTarget})`)
    }
  }

  return { label, fixtures: assignments.length, dateRange: `${start} → ${end}`, maxDay, maxTeamDay, windows, errors }
}

async function run() {
  const start = '2026-09-01'
  const results: Report[] = []

  results.push(
    analyze(
      'League: 20 teams, 2 legs (380 matches)',
      await generateLeagueFixtures(null as any, makeTeams(20), 'x', 2, start),
      { windowTolerance: 1 }
    )
  )

  results.push(
    analyze(
      'League: 26 teams, 2 legs (650 matches)',
      await generateLeagueFixtures(null as any, makeTeams(26), 'x', 2, start),
      { windowTolerance: 1 }
    )
  )

  const g16: Record<string, string[]> = {}
  for (let g = 0; g < 4; g++) g16[String.fromCharCode(65 + g)] = makeTeams(16).slice(g * 4, (g + 1) * 4)
  results.push(
    analyze(
      'Groups: 4 groups of 4 (16 teams), 2 legs',
      await generateGroupFixtures(null as any, g16, 2, start, 'x')
    )
  )

  const g10: Record<string, string[]> = { A: makeTeams(10).slice(0, 5), B: makeTeams(10).slice(5) }
  results.push(
    analyze(
      'Groups: 2 groups of 5 (10 teams), 2 legs',
      await generateGroupFixtures(null as any, g10, 2, start, 'x')
    )
  )

  results.push(
    analyze(
      'Friendlies: 10 teams, 3 matches each',
      await generateExhibitionFixtures(null as any, makeTeams(10), 3, start, 'x'),
      { perTeamTarget: 3 }
    )
  )

  results.push(
    analyze(
      'Friendlies: 7 teams (odd, bye), 2 matches each',
      await generateExhibitionFixtures(null as any, makeTeams(7), 2, start, 'x')
    )
  )

  results.push(
    analyze(
      'Stress: 64 teams, 1 match each',
      await generateExhibitionFixtures(null as any, makeTeams(64), 1, start, 'x'),
      { perTeamTarget: 1 }
    )
  )

  results.push(
    analyze(
      'Stress: 65 teams (odd), 1 match each',
      await generateExhibitionFixtures(null as any, makeTeams(65), 1, start, 'x')
    )
  )

  for (const r of results) {
    const winStr = r.windows.map((w) => `w${w.window}[${w.min}-${w.max}]`).join(' ')
    console.log(`\n=== ${r.label} ===`)
    console.log(`  fixtures: ${r.fixtures} | range: ${r.dateRange} | max/day: ${r.maxDay} | max team/day: ${r.maxTeamDay}`)
    console.log(`  weekly per-team range: ${winStr}`)
    if (r.errors.length > 0) {
      console.log('  ERRORS:')
      for (const e of r.errors) console.log(`    - ${e}`)
    } else {
      console.log('  OK')
    }
  }

  const failed = results.filter((r) => r.errors.length > 0)
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error('run failed:', e)
  process.exit(1)
})
