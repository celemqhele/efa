// Local dry-run verification of the balanced fixture scheduler.
// Does NOT touch the database — calls the generators directly with a null db.
//
// Run: npx tsx scripts/dry-run-schedule.ts

import { parseISO } from 'date-fns'
import {
  generateLeagueFixtures,
  generateGroupFixtures,
  generateExhibitionFixtures,
  buildLeagueRounds,
} from '../lib/fixture-generator'
import { buildSeasonCalendar } from '../lib/season-calendar'
import { DAILY_MATCH_CAP, WEEKLY_MATCHES } from '../lib/fixture-slots'
import type { SlotAssignment } from '../lib/fixture-slots'

function makeTeams(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
}

// --- Season shape assertions --------------------------------------------------

interface ShapeReport {
  label: string
  errors: string[]
  info: string
}

// Checks the invariants the league generator must guarantee:
//   - every pair meets exactly twice, exactly once at home each,
//   - no team plays more than 2 consecutive games at the same venue,
//   - matchday is the round number (1..R), not a global fixture counter,
//   - leg 1 comes before leg 2.
function checkLeagueShape(label: string, teamIds: string[], numRounds = 2): ShapeReport {
  const errors: string[] = []
  const rounds = buildLeagueRounds(teamIds, numRounds)

  const n = teamIds.length
  const roundsPerLeg = n % 2 === 0 ? n - 1 : n
  const expectedRounds = roundsPerLeg * numRounds
  if (rounds.length !== expectedRounds) {
    errors.push(`expected ${expectedRounds} rounds, got ${rounds.length}`)
  }

  // Venue sequence in round order.
  const seqs = new Map<string, Array<'H' | 'A'>>()
  for (const id of teamIds) seqs.set(id, [])
  const meetings = new Map<string, { homeCount: Record<string, number>; count: number }>()
  const roundSizes = new Map<number, number>()

  for (const r of rounds) {
    roundSizes.set(r.round, (roundSizes.get(r.round) ?? 0) + r.fixtures.length)
    for (const f of r.fixtures) {
      seqs.get(f.home)!.push('H')
      seqs.get(f.away)!.push('A')
      const key = [f.home, f.away].sort().join('|')
      const entry = meetings.get(key) ?? { homeCount: {}, count: 0 }
      entry.homeCount[f.home] = (entry.homeCount[f.home] ?? 0) + 1
      entry.count += 1
      meetings.set(key, entry)
    }
  }

  // Every pair meets exactly `numRounds` times, split evenly by venue (so a
  // 2-leg season gives exactly one home game each).
  const pairCount = (n * (n - 1)) / 2
  if (meetings.size !== pairCount) errors.push(`expected ${pairCount} pairings, got ${meetings.size}`)
  const expectedHosts = numRounds / 2
  for (const [key, m] of meetings) {
    if (m.count !== numRounds) errors.push(`${key} met ${m.count} times (expected ${numRounds})`)
    // Only meaningful when the pairs are mirrored (an even number of legs).
    if (numRounds % 2 !== 0) continue
    for (const [team, hosted] of Object.entries(m.homeCount)) {
      if (hosted !== expectedHosts) errors.push(`${key}: ${team} hosted ${hosted} (expected ${expectedHosts})`)
    }
  }

  // No more than two consecutive same-venue games.
  let worstRun = 0
  for (const [id, seq] of seqs) {
    let run = 1
    for (let i = 1; i < seq.length; i++) {
      run = seq[i] === seq[i - 1] ? run + 1 : 1
      if (run > worstRun) worstRun = run
    }
    if (run > 2) errors.push(`${id} finished on a ${run}-game same-venue run`)
  }
  if (worstRun > 2) errors.push(`max same-venue run is ${worstRun} (max allowed 2)`)

  // Round numbers must be 1..R with the expected number of fixtures per round
  // and legs in ascending order.
  const numbers = rounds.map((r) => r.round).sort((a, b) => a - b)
  if (numbers.some((v, i) => v !== i + 1)) errors.push(`round numbers are not 1..${rounds.length}`)
  const sizes = [...new Set(roundSizes.values())]
  if (sizes.length !== 1) errors.push(`round sizes differ: ${sizes.join(', ')}`)
  let previousLeg = 1
  for (const r of rounds) {
    if (r.leg < previousLeg) errors.push(`leg ${r.leg} round ${r.round} appears after leg ${previousLeg}`)
    previousLeg = r.leg
  }

  return {
    label,
    errors,
    info: `${rounds.length} rounds, ${rounds.reduce((s, r) => s + r.fixtures.length, 0)} fixtures, max run ${worstRun}`,
  }
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
    if (c > DAILY_MATCH_CAP) errors.push(`day ${d} has ${c} matches (cap ${DAILY_MATCH_CAP})`)
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
    const pool = WEEKLY_MATCHES * 2
    if (total > pool) errors.push(`window ${w} has ${total} team-games (pool ${pool})`)
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

  // --- Season shape: venue alternation + matchday = round --------------------
  const shapeReports: ShapeReport[] = []
  for (const n of [6, 8, 10, 12, 14, 16, 18, 20]) {
    shapeReports.push(checkLeagueShape(`Shape: ${n} teams, 2 legs`, makeTeams(n), 2))
  }
  shapeReports.push(checkLeagueShape('Shape: 16 teams, 1 leg', makeTeams(16), 1))
  shapeReports.push(checkLeagueShape('Shape: 16 teams, 4 legs', makeTeams(16), 4))
  shapeReports.push(checkLeagueShape('Shape: 7 teams (odd), 2 legs', makeTeams(7), 2))

  for (const s of shapeReports) {
    console.log(`\n=== ${s.label} ===`)
    console.log(`  ${s.info}`)
    if (s.errors.length > 0) {
      console.log('  ERRORS:')
      for (const e of s.errors) console.log(`    - ${e}`)
    } else {
      console.log('  OK')
    }
  }

  // --- Calendar: 49-day full season, leagues paused on cup days --------------
  const calendar = buildSeasonCalendar(start, 30, 'full')
  console.log(`\n=== Calendar: full preset, 30 rounds ===`)
  console.log(
    `  ${calendar.totalDays} days (${calendar.startDate} → ${calendar.endDate}), ` +
      `${calendar.leagueDays.length} league days, ${calendar.windows.length} windows`
  )
  console.log(`  windows: ${calendar.windows.map((w) => `${w.key}[${w.days.length}]`).join(' ')}`)
  const calendarErrors: string[] = []
  if (calendar.totalDays !== 49) calendarErrors.push(`expected a 49-day season, got ${calendar.totalDays}`)
  const perKey: Record<string, number> = {}
  for (const w of calendar.windows) perKey[w.key] = (perKey[w.key] ?? 0) + w.days.length
  if (perKey.caf !== 11) calendarErrors.push(`CAF window is ${perKey.caf} days (expected 11)`)
  if (perKey.nedbank !== 6) calendarErrors.push(`Nedbank window is ${perKey.nedbank} days (expected 6)`)
  if (perKey.international !== 2) calendarErrors.push(`international window is ${perKey.international} days (expected 2)`)

  const cupDays = new Set(calendar.windows.flatMap((w) => w.days))
  const overlap = calendar.leagueDays.filter((d) => cupDays.has(d))
  if (overlap.length > 0) calendarErrors.push(`league and cup days overlap on ${overlap.join(', ')}`)
  const owners = new Map<string, number>()
  for (const w of calendar.windows) for (const d of w.days) owners.set(d, (owners.get(d) ?? 0) + 1)
  for (const [d, count] of owners) if (count > 1) calendarErrors.push(`${d} is claimed by ${count} windows`)
  if (calendarErrors.length > 0) {
    console.log('  ERRORS:')
    for (const e of calendarErrors) console.log(`    - ${e}`)
  } else {
    console.log('  OK')
  }

  // --- Calendar-driven league generation: one round per league day ----------
  const leagueFixtures = await generateLeagueFixtures(null as any, makeTeams(16), 'x', 2, start, {
    roundDates: calendar.leagueDays,
  })
  const roundDays = new Set(leagueFixtures.map((f) => f.scheduled_date))
  const leagueErrors: string[] = []
  if (leagueFixtures.length !== 240) leagueErrors.push(`expected 240 fixtures, got ${leagueFixtures.length}`)
  if (roundDays.size !== 30) leagueErrors.push(`expected 30 league days, got ${roundDays.size}`)
  if (leagueFixtures.some((f) => cupDays.has(f.scheduled_date))) {
    leagueErrors.push('a league fixture landed on a cup day')
  }
  const badMatchday = leagueFixtures.filter((f) => f.matchday < 1 || f.matchday > 30)
  if (badMatchday.length > 0) leagueErrors.push(`${badMatchday.length} fixtures have a matchday outside 1..30`)
  const perRoundDay = new Map<number, string>()
  for (const f of leagueFixtures) {
    const seen = perRoundDay.get(f.matchday)
    if (seen && seen !== f.scheduled_date) leagueErrors.push(`matchday ${f.matchday} spans ${seen} and ${f.scheduled_date}`)
    perRoundDay.set(f.matchday, f.scheduled_date)
  }
  console.log(`\n=== Calendar league generation: 16 teams on 30 league days ===`)
  console.log(`  ${leagueFixtures.length} fixtures across ${roundDays.size} days`)
  if (leagueErrors.length > 0) {
    console.log('  ERRORS:')
    for (const e of leagueErrors) console.log(`    - ${e}`)
  } else {
    console.log('  OK')
  }

  // --- Cup group stage packed into its window days --------------------------
  const g16: Record<string, string[]> = {}
  for (let g = 0; g < 4; g++) g16[String.fromCharCode(65 + g)] = makeTeams(16).slice(g * 4, (g + 1) * 4)
  const cafDays = calendar.windowsByKey.caf ?? []
  const cupFixtures = await generateGroupFixtures(null as any, g16, 2, start, 'x', {
    allowedDates: cafDays,
  })
  const cupErrors: string[] = []
  if (cupFixtures.length !== 48) cupErrors.push(`expected 48 group fixtures, got ${cupFixtures.length}`)
  const outside = cupFixtures.filter((f) => !cafDays.includes(f.scheduled_date))
  if (outside.length > 0) cupErrors.push(`${outside.length} cup fixtures fell outside the CAF window`)
  const cupDaysUsed = new Set(cupFixtures.map((f) => f.scheduled_date))
  const cupMatchdays = [...new Set(cupFixtures.map((f) => f.matchday))].sort((a, b) => a - b)
  if (cupMatchdays.join(',') !== '1,2,3,4,5,6') cupErrors.push(`cup matchdays are ${cupMatchdays.join(',')}`)
  console.log(`\n=== Cup group stage: 4 groups of 4 inside the CAF window ===`)
  console.log(`  ${cupFixtures.length} fixtures across ${cupDaysUsed.size} window days`)
  if (cupErrors.length > 0) {
    console.log('  ERRORS:')
    for (const e of cupErrors) console.log(`    - ${e}`)
  } else {
    console.log('  OK')
  }

  // --- Legacy weekly scheduler still works ----------------------------------

  results.push(
    analyze(
      'League: 20 teams, 2 legs (380 matches)',
      await generateLeagueFixtures(null as any, makeTeams(20), 'x', 2, start),
      { windowTolerance: 2 }
    )
  )

  results.push(
    analyze(
      'League: 26 teams, 2 legs (650 matches)',
      await generateLeagueFixtures(null as any, makeTeams(26), 'x', 2, start),
      { windowTolerance: 2 }
    )
  )

  const g16legacy: Record<string, string[]> = {}
  for (let g = 0; g < 4; g++) g16legacy[String.fromCharCode(65 + g)] = makeTeams(16).slice(g * 4, (g + 1) * 4)
  results.push(
    analyze(
      'Groups: 4 groups of 4 (16 teams), 2 legs',
      await generateGroupFixtures(null as any, g16legacy, 2, start, 'x')
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
  const failedShape = shapeReports.filter((r) => r.errors.length > 0)
  const extraScenarios = 3
  const extraFailures =
    (calendarErrors.length > 0 ? 1 : 0) + (leagueErrors.length > 0 ? 1 : 0) + (cupErrors.length > 0 ? 1 : 0)
  const total = results.length + shapeReports.length + extraScenarios
  const failedCount = failed.length + failedShape.length + extraFailures
  console.log(`\n${total - failedCount}/${total} scenarios passed`)
  if (failedCount > 0) process.exit(1)
}

run().catch((e) => {
  console.error('run failed:', e)
  process.exit(1)
})
