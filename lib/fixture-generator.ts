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

export async function generateLeagueFixtures(
  db: any,
  teamIds: string[],
  tournamentId: string,
  numRounds: number = 2,
  startFrom?: string
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots } = await import('./fixture-slots')
  const allPairs = shuffle(generateRoundRobin(teamIds, numRounds))
  const pairs = allPairs.map(([home, away]) => ({ home_team_id: home, away_team_id: away }))

  const assignments = await assignFixtureSlots(db, pairs, startFrom)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: i + 1,
    scheduled_date: a.scheduled_date,
    deadline: `${a.scheduled_date}T12:00:00Z`,
    round_type: 'league' as const,
    leg: 1,
  }))
}

export async function generateGroupFixtures(
  db: any,
  groups: Record<string, string[]>,
  numRounds: number = 2,
  startFrom?: string
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots: assignSlots } = await import('./fixture-slots')

  const allPairs: Array<[string, string]> = []
  for (const teamIds of Object.values(groups)) {
    allPairs.push(...generateRoundRobin(teamIds, numRounds))
  }

  const shuffled = shuffle(allPairs)
  const pairs = shuffled.map(([home, away]) => ({ home_team_id: home, away_team_id: away }))

  const assignments = await assignSlots(db, pairs, startFrom)
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
      leg: 1,
    }
  })
}

export async function generateExhibitionFixtures(
  db: any,
  teamIds: string[],
  matchesPerTeam: number,
  startFrom?: string
): Promise<GeneratedFixture[]> {
  const { assignFixtureSlots } = await import('./fixture-slots')
  
  // Simple round-robin pairings for exhibition
  const pairs: Array<{ home_team_id: string; away_team_id: string }> = []
  const shuffledTeams = shuffle([...teamIds])

  // Basic heuristic: each team plays each other until matchesPerTeam is reached
  for (let m = 0; m < matchesPerTeam; m++) {
    for (let i = 0; i < shuffledTeams.length; i++) {
      for (let j = i + 1; j < shuffledTeams.length; j++) {
        pairs.push({ home_team_id: shuffledTeams[i], away_team_id: shuffledTeams[j] })
      }
    }
  }

  const assignments = await assignFixtureSlots(db, pairs, startFrom)

  return assignments.map((a, i) => ({
    home_team_id: a.home_team_id,
    away_team_id: a.away_team_id,
    matchday: i + 1,
    scheduled_date: a.scheduled_date,
    deadline: `${a.scheduled_date}T12:00:00Z`,
    round_type: 'friendlies' as any,
    leg: 1,
  }))
}
