import type { SlotOptions } from './fixture-slots'

export interface GeneratedFixture {
  home_team_id: string
  away_team_id: string
  matchday: number
  scheduled_date: string
  deadline: string
  round_type: 'league' | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'super_cup'
  leg: number
}

export interface LeagueRound {
  /** Round number within the tournament (1-based). Also used as `matchday`. */
  round: number
  /** 1 or 2 (or higher if more than two legs are requested). */
  leg: number
  fixtures: Array<{ home: string; away: string }>
}

const BYE = '__BYE__'

// --- Round robin construction -------------------------------------------------

// Circle-method round robin. Produces exactly one fixture per team per round
// (skipping a bye for odd-sized fields), so every team plays every other team
// exactly once across `n - 1` (even `n`) rounds.
export function circleRounds(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length
  if (n < 2) return []

  const pool = n % 2 === 1 ? [...teamIds, BYE] : [...teamIds]
  const m = pool.length
  const rounds: Array<Array<[string, string]>> = []

  for (let r = 0; r < m - 1; r++) {
    const roundPairs: Array<[string, string]> = []
    for (let i = 0; i < m / 2; i++) {
      const a = pool[i]
      const b = pool[m - 1 - i]
      if (a !== BYE && b !== BYE) roundPairs.push([a, b])
    }
    rounds.push(roundPairs)

    // Rotate: keep the first team fixed, rotate the rest.
    const last = pool[m - 1]
    for (let i = m - 1; i > 1; i--) pool[i] = pool[i - 1]
    pool[1] = last
  }

  return rounds
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Venue orientation --------------------------------------------------------

interface OrientedPair {
  home: string
  away: string
  round: number
}

// Cost of a team's venue sequence: anything past two consecutive games at the
// same venue is penalised hard, so the search drives it to zero.
function sequenceCost(seq: Array<'H' | 'A' | null>): number {
  let cost = 0
  let run = 0
  let last: 'H' | 'A' | null = null
  for (const venue of seq) {
    if (venue === null) {
      run = 0
      last = null
      continue
    }
    run = venue === last ? run + 1 : 1
    last = venue
    if (run > 2) cost += (run - 2) * (run - 2) * 1000
  }
  return cost
}

function buildVenueSequences(
  pairs: OrientedPair[],
  teamIds: string[],
  rounds: number
): Map<string, Array<'H' | 'A' | null>> {
  const seq = new Map<string, Array<'H' | 'A' | null>>()
  for (const id of teamIds) seq.set(id, new Array(rounds).fill(null))
  for (const p of pairs) {
    seq.get(p.home)![p.round - 1] = 'H'
    seq.get(p.away)![p.round - 1] = 'A'
  }
  return seq
}

/**
 * Choose home/away for each leg-1 fixture so that no team plays more than two
 * consecutive games at the same venue.
 *
 * Leg 2 is a strict mirror of leg 1 in REVERSED round order, which keeps the
 * boundary alternating: a team's last leg-1 venue is always flipped in its
 * first leg-2 game, and the reversed leg-2 order reproduces leg 1's run
 * structure exactly. So a leg-1 sequence with no 3-run guarantees a full-season
 * sequence with no 3-run, and every pair still gets exactly one home game each.
 *
 * Seeded annealing over single-fixture flips; the seed makes generation
 * reproducible, and the search stops as soon as the cost hits zero.
 */
function orientLegOne(rounds: Array<Array<[string, string]>>, teamIds: string[], seed = 987654321): OrientedPair[] {
  const pairs: OrientedPair[] = []
  for (let r = 0; r < rounds.length; r++) {
    for (const [a, b] of rounds[r]) pairs.push({ home: a, away: b, round: r + 1 })
  }
  if (pairs.length === 0) return pairs

  const totalRounds = rounds.length
  let state = seed >>> 0
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }

  // Random starting orientation.
  for (const p of pairs) {
    if (rand() < 0.5) {
      const h = p.home
      p.home = p.away
      p.away = h
    }
  }

  const seq = buildVenueSequences(pairs, teamIds, totalRounds)
  const costs = new Map<string, number>()
  let total = 0
  for (const id of teamIds) {
    const c = sequenceCost(seq.get(id)!)
    costs.set(id, c)
    total += c
  }

  let bestTotal = total
  let best = pairs.map((p) => ({ ...p }))

  const iterations = Math.min(150_000, Math.max(25_000, pairs.length * 500))
  for (let it = 0; it < iterations && bestTotal > 0; it++) {
    const p = pairs[Math.floor(rand() * pairs.length)]
    const roundIdx = p.round - 1
    const prevHome = p.home
    const prevAway = p.away

    // Flip this fixture's venue.
    p.home = prevAway
    p.away = prevHome
    seq.get(prevHome)![roundIdx] = 'A'
    seq.get(prevAway)![roundIdx] = 'H'

    const homeCost = sequenceCost(seq.get(prevHome)!)
    const awayCost = sequenceCost(seq.get(prevAway)!)
    const delta = homeCost + awayCost - (costs.get(prevHome)! + costs.get(prevAway)!)

    const temperature = 40 * (1 - it / iterations) + 0.05
    const accept = delta <= 0 || rand() < Math.exp(-delta / temperature)

    if (accept) {
      costs.set(prevHome, homeCost)
      costs.set(prevAway, awayCost)
      total += delta
      if (total < bestTotal) {
        bestTotal = total
        best = pairs.map((q) => ({ ...q }))
      }
    } else {
      p.home = prevHome
      p.away = prevAway
      seq.get(prevHome)![roundIdx] = 'H'
      seq.get(prevAway)![roundIdx] = 'A'
    }
  }

  return best
}

/**
 * Build the ordered rounds for a two-legged league.
 *
 * `matchday` in the returned rounds is the round number (1..R), which keeps
 * matchdays per tournament instead of counting every fixture in the season.
 */
export function buildLeagueRounds(teamIds: string[], numRounds: number = 2): LeagueRound[] {
  const base = circleRounds(teamIds)
  if (base.length === 0) return []

  const R = base.length
  const legOne = orientLegOne(base, teamIds)
  const legTwo: OrientedPair[] = [...legOne]
    .reverse()
    .map((p) => ({ home: p.away, away: p.home, round: R + (R - p.round + 1) }))

  const rounds: LeagueRound[] = []
  const perBlock = R * 2
  const legs = Math.max(1, Math.floor(numRounds))
  const blocksNeeded = Math.ceil(legs / 2)

  const addRound = (p: OrientedPair, offset: number, legOffset: number) => {
    const round = offset + p.round
    let entry = rounds.find((r) => r.round === round)
    if (!entry) {
      entry = { round, leg: (p.round > R ? 2 : 1) + legOffset, fixtures: [] }
      rounds.push(entry)
    }
    entry.fixtures.push({ home: p.home, away: p.away })
  }

  for (let b = 0; b < blocksNeeded; b++) {
    const offset = b * perBlock
    if (legs >= 1 + b * 2) for (const p of legOne) addRound(p, offset, b * 2)
    if (legs >= 2 + b * 2) for (const p of legTwo) addRound(p, offset, b * 2)
  }

  return rounds.sort((a, b) => a.round - b.round)
}

// Group pairs keep the simple mirrored shape: leg 1 in round order, leg 2 in
// reverse round order with venues swapped.
function buildGroupRounds(teamIds: string[], numRounds: number): LeagueRound[] {
  const base = circleRounds(teamIds)
  if (base.length === 0) return []

  const R = base.length
  const rounds: LeagueRound[] = []
  const legs = Math.max(1, Math.floor(numRounds))

  for (let r = 0; r < R; r++) {
    rounds.push({
      round: r + 1,
      leg: 1,
      fixtures: base[r].map(([home, away]) => ({ home, away })),
    })
  }
  if (legs >= 2 && R > 0) {
    for (let r = 0; r < R; r++) {
      const src = base[R - 1 - r]
      rounds.push({
        round: R + r + 1,
        leg: 2,
        fixtures: src.map(([home, away]) => ({ home: away, away: home })),
      })
    }
  }

  return rounds
}

function deadlineFor(date: string): string {
  return `${date}T12:00:00Z`
}

function roundDate(roundDates: string[] | undefined, round: number): string | null {
  if (!roundDates || roundDates.length === 0) return null
  const date = roundDates[round - 1]
  return date ?? null
}

// --- League fixtures ----------------------------------------------------------

export async function generateLeagueFixtures(
  db: any,
  teamIds: string[],
  tournamentId: string,
  numRounds: number = 2,
  startFrom?: string,
  opts?: SlotOptions
): Promise<GeneratedFixture[]> {
  const rounds = buildLeagueRounds(teamIds, numRounds)
  if (rounds.length === 0) return []

  // Calendar path: every round gets its own league day, straight from the
  // season calendar. One round = one day = one `matchday`.
  if (opts?.roundDates && opts.roundDates.length > 0) {
    const out: GeneratedFixture[] = []
    for (const r of rounds) {
      const date = roundDate(opts.roundDates, r.round)
      if (!date) continue
      for (const f of r.fixtures) {
        out.push({
          home_team_id: f.home,
          away_team_id: f.away,
          matchday: r.round,
          scheduled_date: date,
          deadline: deadlineFor(date),
          round_type: 'league',
          leg: r.leg,
        })
      }
    }
    return out
  }

  // Legacy path (no season calendar): keep the balanced weekly scheduler but
  // still report the round as `matchday`.
  const { assignFixtureSlots } = await import('./fixture-slots')
  const pairs: Array<{ home_team_id: string; away_team_id: string; leg: number; round: number }> = []
  for (const r of rounds) {
    for (const f of r.fixtures) {
      pairs.push({ home_team_id: f.home, away_team_id: f.away, leg: r.leg, round: r.round })
    }
  }

  const assignments = await assignFixtureSlots(db, pairs, startFrom, 0, tournamentId, opts)
  const roundByKey = new Map<string, number>()
  for (const p of pairs) roundByKey.set(`${p.leg}|${p.home_team_id}|${p.away_team_id}`, p.round)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: roundByKey.get(`${a.leg ?? 1}|${a.home_team_id}|${a.away_team_id}`) ?? i + 1,
    scheduled_date: a.scheduled_date,
    deadline: deadlineFor(a.scheduled_date),
    round_type: 'league' as const,
    leg: a.leg ?? 1,
  }))
}

// --- Group fixtures -----------------------------------------------------------

/**
 * Place fixtures on an explicit list of allowed days (the cup's calendar
 * windows), respecting the daily cap and one game per team per day. Returns
 * null when the fixtures have to fall back to the normal slot scheduler.
 */
function placeOnAllowedDays(
  rounds: LeagueRound[],
  allowedDays: string[],
  dailyCap: number
): Array<{ home_team_id: string; away_team_id: string; round: number; leg: number; date: string }> | null {
  if (allowedDays.length === 0) return null

  const out: Array<{ home_team_id: string; away_team_id: string; round: number; leg: number; date: string }> = []
  let dayIndex = 0

  for (const round of rounds) {
    const pending = [...round.fixtures]
    while (pending.length > 0 && dayIndex < allowedDays.length) {
      const date = allowedDays[dayIndex]
      const usedTeams = new Set<string>()
      let placedToday = 0

      for (let i = 0; i < pending.length; i++) {
        if (placedToday >= dailyCap) break
        const fx = pending[i]
        if (usedTeams.has(fx.home) || usedTeams.has(fx.away)) continue

        out.push({
          home_team_id: fx.home,
          away_team_id: fx.away,
          round: round.round,
          leg: round.leg,
          date,
        })
        usedTeams.add(fx.home)
        usedTeams.add(fx.away)
        placedToday++
        pending.splice(i, 1)
        i--
      }

      if (placedToday === 0) break
      dayIndex++
    }

    // Not enough window days — bail out so the caller can fall back.
    if (pending.length > 0) return null
  }

  return out
}

export async function generateGroupFixtures(
  db: any,
  groups: Record<string, string[]>,
  numRounds: number = 2,
  startFrom?: string,
  tournamentId?: string,
  opts?: SlotOptions
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots: assignSlots } = await import('./fixture-slots')

  // Merge every group's rounds by round number so all groups play the same
  // round on the same day (that is how a cup matchday works).
  const byRound = new Map<number, LeagueRound>()
  for (const teamIds of Object.values(groups)) {
    for (const r of buildGroupRounds(teamIds, numRounds)) {
      const entry = byRound.get(r.round) ?? { round: r.round, leg: r.leg, fixtures: [] }
      entry.fixtures.push(...r.fixtures)
      byRound.set(r.round, entry)
    }
  }
  const rounds = [...byRound.values()].sort((a, b) => a.round - b.round)
  if (rounds.length === 0) return []

  const allowedDays = opts?.allowedDates ?? []
  const dailyCap = opts?.dailyMatchCap ?? 8
  const placed = placeOnAllowedDays(rounds, allowedDays, dailyCap)

  if (placed) {
    return placed.map((p) => ({
      home_team_id: p.home_team_id,
      away_team_id: p.away_team_id,
      matchday: p.round,
      scheduled_date: p.date,
      deadline: deadlineFor(p.date),
      round_type: 'group' as const,
      leg: p.leg,
    }))
  }

  const allPairs: Array<{ home_team_id: string; away_team_id: string; leg: number; round: number }> = []
  for (const r of rounds) {
    for (const f of r.fixtures) {
      allPairs.push({ home_team_id: f.home, away_team_id: f.away, leg: r.leg, round: r.round })
    }
  }

  const assignments = await assignSlots(db, allPairs, startFrom, 0, tournamentId, opts)
  const roundByKey = new Map<string, number>()
  for (const p of allPairs) roundByKey.set(`${p.leg}|${p.home_team_id}|${p.away_team_id}`, p.round)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: roundByKey.get(`${a.leg ?? 1}|${a.home_team_id}|${a.away_team_id}`) ?? i + 1,
    scheduled_date: a.scheduled_date,
    deadline: deadlineFor(a.scheduled_date),
    round_type: 'group' as const,
    leg: a.leg ?? 1,
  }))
}

// --- Exhibition / friendly fixtures -------------------------------------------

// Exhibition pairings: each team plays exactly `matchesPerTeam` distinct-ish
// games by cycling the round robin. Byes are dropped.
function buildExhibitionPairs(
  teamIds: string[],
  matchesPerTeam: number
): Array<{ home_team_id: string; away_team_id: string }> {
  const rounds = circleRounds(teamIds)
  if (rounds.length === 0) return []

  const pairs: Array<{ home_team_id: string; away_team_id: string }> = []
  for (let g = 0; g < matchesPerTeam; g++) {
    for (const [a, b] of rounds[g % rounds.length]) {
      pairs.push({ home_team_id: a, away_team_id: b })
    }
  }
  return pairs
}

export async function generateExhibitionFixtures(
  db: any,
  teamIds: string[],
  matchesPerTeam: number,
  startFrom?: string,
  tournamentId?: string,
  opts?: SlotOptions
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots } = await import('./fixture-slots')

  const shuffledTeams = shuffle([...teamIds])
  const pairs = buildExhibitionPairs(shuffledTeams, matchesPerTeam)

  const assignments = await assignFixtureSlots(db, pairs.map(p => ({ ...p, leg: 1 })), startFrom, 0, tournamentId, opts)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: i + 1,
    scheduled_date: a.scheduled_date,
    deadline: deadlineFor(a.scheduled_date),
    round_type: 'friendlies' as any,
    leg: a.leg ?? 1,
  }))
}
