import { addDays, format } from 'date-fns'

export function generateFriendlyFixtures(
  teamIds: string[],
  matchesPerTeam: number,
  startDate: string
) {
  const fixtures = []
  const teamPairs = new Set<string>()

  // Pair up teams based on matchesPerTeam
  // This is a simple heuristic: shuffle, then try to pair them
  let shuffledTeams = [...teamIds].sort(() => Math.random() - 0.5)

  // Simple round-robin approach for matchesPerTeam
  for (let m = 0; m < matchesPerTeam; m++) {
    for (let i = 0; i < shuffledTeams.length; i++) {
      for (let j = i + 1; j < shuffledTeams.length; j++) {
        const homeId = shuffledTeams[i]
        const awayId = shuffledTeams[j]
        const pairKey = [homeId, awayId].sort().join('-')
        
        if (!teamPairs.has(pairKey)) {
          fixtures.push({
            home_team_id: homeId,
            away_team_id: awayId,
            matchday: m + 1,
            scheduled_date: format(addDays(new Date(startDate), m), 'yyyy-MM-dd'),
            deadline: format(addDays(new Date(startDate), m), 'yyyy-MM-dd') + 'T20:00:00Z',
            status: 'scheduled',
          })
          teamPairs.add(pairKey)
          break // Limit to one match per pairing per round-robin pass
        }
      }
    }
  }

  return fixtures
}
