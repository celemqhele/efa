export interface SeedDraw {
  groupA: string[]
  groupB: string[]
  groupC: string[]
  groupD: string[]
}

export interface KnockoutDraw {
  matches: Array<{ home: string; away: string }>
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// UCL group draw: 12 teams into 4 groups of 3
// Pot 1: top 4, Pot 2: 5-8, Pot 3: 9-12
export function drawUCLGroups(teamIds: string[]): SeedDraw {
  const pot1 = shuffle(teamIds.slice(0, 4))
  const pot2 = shuffle(teamIds.slice(4, 8))
  const pot3 = shuffle(teamIds.slice(8, 12))

  return {
    groupA: [pot1[0], pot2[0], pot3[0]],
    groupB: [pot1[1], pot2[1], pot3[1]],
    groupC: [pot1[2], pot2[2], pot3[2]],
    groupD: [pot1[3], pot2[3], pot3[3]],
  }
}

// UCL QF draw: group winners (pot1) vs runners-up (pot2)
// Constraint: no same-group rematch
export function drawUCLKnockout(
  groupWinners: Array<{ teamId: string; group: string }>,
  groupRunnersUp: Array<{ teamId: string; group: string }>
): KnockoutDraw {
  const pot1 = shuffle([...groupWinners])
  const pot2 = shuffle([...groupRunnersUp])

  const matches: Array<{ home: string; away: string }> = []
  const usedPot2 = new Set<string>()

  for (const winner of pot1) {
    const eligible = pot2.filter(
      (ru) => ru.group !== winner.group && !usedPot2.has(ru.teamId)
    )
    if (eligible.length === 0) {
      // Fallback: allow any unused
      const fallback = pot2.find((ru) => !usedPot2.has(ru.teamId))!
      matches.push({ home: winner.teamId, away: fallback.teamId })
      usedPot2.add(fallback.teamId)
    } else {
      const opponent = eligible[0]
      matches.push({ home: winner.teamId, away: opponent.teamId })
      usedPot2.add(opponent.teamId)
    }
  }

  return { matches }
}

// Europa QF draw: 8 teams, top 4 in league bottom 8 = Pot 1, bottom 4 = Pot 2
export function drawEuropaKnockout(
  pot1Teams: string[],
  pot2Teams: string[]
): KnockoutDraw {
  const p1 = shuffle([...pot1Teams])
  const p2 = shuffle([...pot2Teams])

  return {
    matches: p1.map((home, i) => ({ home, away: p2[i] })),
  }
}
