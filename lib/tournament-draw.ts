/**
 * Universal tournament draw & seeding engine.
 *
 * Supports any number of teams, groups, pots, qualifiers, and knockout rounds.
 * All procedures are dynamically calculated based on tournament configuration.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DrawConfig {
  teams: DrawTeam[]
  groupCount: number
  restriction?: DrawRestriction
}

export interface DrawTeam {
  id: string
  rank: number
  label?: string
}

export interface GroupAssignment {
  group: number
  teamId: string
  pot: number
}

export interface DrawResult {
  groups: GroupAssignment[]
  valid: boolean
  iterations: number
}

export interface DrawRestriction {
  /** Teams that cannot be placed in the same group */
  sameGroupForbidden?: string[][]
  /** Teams that must be placed in different groups (e.g. same country) */
  separateGroups?: Set<string>[]
  /** Maximum teams from a given cohort per group */
  maxPerGroup?: { cohortKey: string; max: number }[]
}

export interface KnockoutDrawConfig {
  seededTeams: string[]
  unseededTeams: string[]
  roundName: string
  /** Pairs of teams that cannot face each other (e.g. same group) */
  forbiddenPairs?: Set<string>[]
  totalRounds: number
  currentRound: number
}

export interface KnockoutDrawResult {
  pairings: { seeded: string; unseeded: string }[]
  valid: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Group Stage Draw ──────────────────────────────────────────────────────────

export function createPots(teams: DrawTeam[], groupCount: number): DrawTeam[][] {
  if (groupCount < 1) return []

  const sorted = [...teams].sort((a, b) => a.rank - b.rank)
  const pots: DrawTeam[][] = []
  const potSize = Math.ceil(sorted.length / groupCount)

  for (let i = 0; i < sorted.length; i += potSize) {
    pots.push(sorted.slice(i, i + potSize))
  }

  return pots
}

export function drawGroups(config: DrawConfig): DrawResult {
  const { teams, groupCount, restriction } = config
  const pots = createPots(teams, groupCount)
  const maxTeamsPerGroup = Math.ceil(teams.length / groupCount)
  const maxIterations = 20000

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const assignments: GroupAssignment[] = []
    const groupSlots: string[][] = Array.from({ length: groupCount }, () => [])

    let valid = true

    for (let potIdx = 0; potIdx < pots.length; potIdx++) {
      const pot = shuffle(pots[potIdx])
      const groupOrder = shuffle(
        Array.from({ length: groupCount }, (_, i) => i)
      )

      for (const team of pot) {
        let placed = false

        for (const groupIdx of groupOrder) {
          if (groupSlots[groupIdx].length >= maxTeamsPerGroup) continue

          if (restriction) {
            const forbidden = restriction.sameGroupForbidden ?? []
            const isForbidden = forbidden.some(
              (pair) =>
                groupSlots[groupIdx].some((tid) => pair.includes(tid) && pair.includes(team.id))
            )
            if (isForbidden) continue
          }

          groupSlots[groupIdx].push(team.id)
          assignments.push({ group: groupIdx, teamId: team.id, pot: potIdx })
          placed = true
          break
        }

        if (!placed) {
          valid = false
          break
        }
      }

      if (!valid) break
    }

    if (valid) {
      return { groups: assignments, valid: true, iterations: iteration + 1 }
    }
  }

  return { groups: [], valid: false, iterations: maxIterations }
}

export function getGroupStandings(groups: GroupAssignment[], groupCount: number): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (let i = 0; i < groupCount; i++) map.set(i, [])
  for (const a of groups) {
    map.get(a.group)!.push(a.teamId)
  }
  return map
}

// ── Qualification ─────────────────────────────────────────────────────────────

export function determineQualifiers(
  groupStandings: { group: string; teamId: string; points: number; gd: number; gf: number }[],
  autoQualifyPerGroup: number,
  additionalSlots: number
): { autoQualifiers: string[]; additionalQualifiers: string[] } {
  const byGroup = new Map<string, typeof groupStandings>()
  for (const row of groupStandings) {
    if (!byGroup.has(row.group)) byGroup.set(row.group, [])
    byGroup.get(row.group)!.push(row)
  }

  // Sort each group by points > GD > GF
  for (const [, teams] of byGroup) {
    teams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      return b.gf - a.gf
    })
  }

  const autoQualifiers: string[] = []
  const remaining: typeof groupStandings = []

  for (const [, teams] of byGroup) {
    const taken = teams.slice(0, autoQualifyPerGroup)
    autoQualifiers.push(...taken.map((t) => t.teamId))
    remaining.push(...teams.slice(autoQualifyPerGroup))
  }

  remaining.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    return b.gf - a.gf
  })

  const additionalQualifiers = remaining.slice(0, additionalSlots).map((t) => t.teamId)

  return { autoQualifiers, additionalQualifiers }
}

// ── Knockout Draw ─────────────────────────────────────────────────────────────

export function drawKnockoutRound(config: KnockoutDrawConfig): KnockoutDrawResult {
  const { seededTeams, unseededTeams, forbiddenPairs } = config
  const maxIterations = 5000

  for (let iter = 0; iter < maxIterations; iter++) {
    const shuffledSeeded = shuffle(seededTeams)
    const shuffledUnseeded = shuffle(unseededTeams)
    const pairings: { seeded: string; unseeded: string }[] = []
    let valid = true

    for (let i = 0; i < shuffledSeeded.length; i++) {
      const seeded = shuffledSeeded[i]
      const unseeded = shuffledUnseeded[i]

      if (seeded === unseeded) { valid = false; break }

      if (forbiddenPairs) {
        const isForbidden = forbiddenPairs.some(
          (pairSet) => pairSet.has(seeded) && pairSet.has(unseeded)
        )
        if (isForbidden) { valid = false; break }
      }

      pairings.push({ seeded, unseeded })
    }

    if (valid && pairings.length === seededTeams.length) {
      return { pairings, valid: true }
    }
  }

  // Fallback: try with reduced constraints
  const shuffledSeeded = shuffle(seededTeams)
  const shuffledUnseeded = shuffle(unseededTeams)
  const pairings: { seeded: string; unseeded: string }[] = []

  for (let i = 0; i < Math.min(shuffledSeeded.length, shuffledUnseeded.length); i++) {
    pairings.push({ seeded: shuffledSeeded[i], unseeded: shuffledUnseeded[i] })
  }

  return { pairings, valid: pairings.length === seededTeams.length }
}

export function drawOpenBracket(teams: string[]): { home: string; away: string }[] {
  const shuffled = shuffle(teams)
  const pairings: { home: string; away: string }[] = []

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairings.push({ home: shuffled[i], away: shuffled[i + 1] })
    }
  }

  return pairings
}

// ── Bracket Builder ───────────────────────────────────────────────────────────

export interface BracketRound {
  name: string
  matchCount: number
  constraints?: { seeded?: boolean }
}

export function buildBracket(
  qualifiedTeams: string[],
  rounds: BracketRound[]
): { round: string; home: string | null; away: string | null }[] {
  let remainingTeams = shuffle(qualifiedTeams)
  const fixtures: { round: string; home: string | null; away: string | null }[] = []

  for (const round of rounds) {
    const mid = Math.ceil(remainingTeams.length / 2)
    const seeded = remainingTeams.slice(0, mid)
    const unseeded = remainingTeams.slice(mid)

    if (round.constraints?.seeded && seeded.length === unseeded.length) {
      const result = drawKnockoutRound({
        seededTeams: seeded,
        unseededTeams: unseeded,
        roundName: round.name,
        totalRounds: rounds.length,
        currentRound: rounds.indexOf(round) + 1,
      })

      for (const p of result.pairings) {
        fixtures.push({ round: round.name, home: p.seeded, away: p.unseeded })
      }

      remainingTeams = result.pairings.flatMap((p) => [p.seeded, p.unseeded])
    } else {
      const pairs = drawOpenBracket(remainingTeams)
      for (const p of pairs) {
        fixtures.push({ round: round.name, home: p.home, away: p.away })
      }
      remainingTeams = pairs.flatMap((p) => [p.home, p.away])
    }
  }

  return fixtures
}
