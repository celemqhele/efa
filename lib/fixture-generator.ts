import type { SlotOptions } from './fixture-slots'

export interface GeneratedFixture {
  home_team_id: string
  away_team_id: string
  matchday: number
  scheduled_date: string
  deadline: string
  round_type: 'league' | 'group' | 'r16' | 'qf' | 'sf' | 'final' | 'super_cup'
  leg: number
}

function generateRoundRobin(teamIds: string[], numRounds: number = 2): Array<[string, string]> {
  const pairs: Array<[string, string]> = []

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]])
    }
  }

  for (let r = 2; r <= numRounds; r++) {
    const roundPairs: Array<[string, string]> = []
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Circle-method round robin. Produces exactly one round per team; each team
// plays every other team once (skipping a bye for odd-sized fields).
function buildRoundRobinRounds(teamIds: string[]): Array<Array<[string, string]>> {
  const n = teamIds.length
  if (n < 2) return []

  const pool = n % 2 === 1 ? [...teamIds, '__BYE__'] : [...teamIds]
  const m = pool.length
  const rounds: Array<Array<[string, string]>> = []

  for (let r = 0; r < m - 1; r++) {
    const roundPairs: Array<[string, string]> = []
    for (let i = 0; i < m / 2; i++) {
      roundPairs.push([pool[i], pool[m - 1 - i]])
    }
    rounds.push(roundPairs)

    // Rotate: keep the first team fixed, rotate the rest.
    const last = pool[m - 1]
    for (let i = m - 1; i > 1; i--) pool[i] = pool[i - 1]
    pool[1] = last
  }

  return rounds
}

// Exhibition pairings: each team plays exactly `matchesPerTeam` distinct-ish
// games by cycling the round robin. Byes are dropped.
function buildExhibitionPairs(
  teamIds: string[],
  matchesPerTeam: number
): Array<{ home_team_id: string; away_team_id: string }> {
  const rounds = buildRoundRobinRounds(teamIds)
  if (rounds.length === 0) return []

  const pairs: Array<{ home_team_id: string; away_team_id: string }> = []
  for (let g = 0; g < matchesPerTeam; g++) {
    for (const [a, b] of rounds[g % rounds.length]) {
      if (a === '__BYE__' || b === '__BYE__') continue
      pairs.push({ home_team_id: a, away_team_id: b })
    }
  }
  return pairs
}

export async function generateLeagueFixtures(
  db: any,
  teamIds: string[],
  tournamentId: string,
  numRounds: number = 2,
  startFrom?: string,
  opts?: SlotOptions
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots } = await import('./fixture-slots')
  const matchupsPerRound = (teamIds.length * (teamIds.length - 1)) / 2
  const allPairs = generateRoundRobin(teamIds, numRounds)
  const pairs = allPairs.map(([home, away], i) => ({
    home_team_id: home,
    away_team_id: away,
    leg: Math.floor(i / matchupsPerRound) + 1,
  }))

  const assignments = await assignFixtureSlots(db, pairs, startFrom, 0, tournamentId, opts)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: i + 1,
    scheduled_date: a.scheduled_date,
    deadline: `${a.scheduled_date}T12:00:00Z`,
    round_type: 'league' as const,
    leg: a.leg ?? 1,
  }))
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

  const allPairs: Array<{ home_team_id: string; away_team_id: string; leg: number }> = []
  for (const teamIds of Object.values(groups)) {
    const matchupsPerRound = (teamIds.length * (teamIds.length - 1)) / 2
    const groupPairs = generateRoundRobin(teamIds, numRounds)
    groupPairs.forEach(([home, away], i) => {
      allPairs.push({ home_team_id: home, away_team_id: away, leg: Math.floor(i / matchupsPerRound) + 1 })
    })
  }

  const assignments = await assignSlots(db, allPairs, startFrom, 0, tournamentId, opts)
  let matchdayCounter = 0

  return assignments.map((a) => {
    matchdayCounter++
    return {
      home_team_id: a.home_team_id,
      away_team_id: a.away_team_id,
      matchday: matchdayCounter,
      scheduled_date: a.scheduled_date,
      deadline: `${a.scheduled_date}T12:00:00Z`,
      round_type: 'group' as const,
      leg: a.leg ?? 1,
    }
  })
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
    deadline: `${a.scheduled_date}T12:00:00Z`,
    round_type: 'friendlies' as any,
    leg: a.leg ?? 1,
  }))
}
