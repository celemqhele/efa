import type { Standing } from '@/lib/supabase/types'

interface H2HRecord {
  homeWins: number
  awayWins: number
  draws: number
}

export interface ProbabilityResult {
  home: number
  draw: number
  away: number
}

function getFormPoints(form: string): number {
  return form.split('').reduce((acc, char) => {
    if (char === 'W') return acc + 3
    if (char === 'D') return acc + 1
    return acc
  }, 0)
}

export function calculateProbability(
  homeStanding: Standing | null,
  awayStanding: Standing | null,
  h2h: H2HRecord
): ProbabilityResult {
  if (!homeStanding || !awayStanding) {
    return { home: 40, draw: 25, away: 35 }
  }

  const homeFormPoints = getFormPoints(homeStanding.form ?? '')
  const awayFormPoints = getFormPoints(awayStanding.form ?? '')

  const homeGoalsAvg = homeStanding.played > 0
    ? homeStanding.goals_for / homeStanding.played : 0
  const awayGoalsAvg = awayStanding.played > 0
    ? awayStanding.goals_for / awayStanding.played : 0

  const homeConcededAvg = homeStanding.played > 0
    ? homeStanding.goals_against / homeStanding.played : 0
  const awayConcededAvg = awayStanding.played > 0
    ? awayStanding.goals_against / awayStanding.played : 0

  const homeScore =
    (homeFormPoints * 0.35) +
    (homeGoalsAvg * 0.25) +
    ((1 / (homeConcededAvg + 0.1)) * 0.2) +
    (h2h.homeWins * 0.2)

  const awayScore =
    (awayFormPoints * 0.35) +
    (awayGoalsAvg * 0.25) +
    ((1 / (awayConcededAvg + 0.1)) * 0.2) +
    (h2h.awayWins * 0.2)

  const total = homeScore + awayScore
  if (total === 0) return { home: 40, draw: 25, away: 35 }

  const rawHome = (homeScore / total) * 100
  const rawAway = (awayScore / total) * 100

  // Draw probability is 15-30% based on closeness
  const closeness = 1 - Math.abs(rawHome - rawAway) / 100
  const drawProb = Math.round(15 + closeness * 15)

  const remainder = 100 - drawProb
  const homePct = Math.round((rawHome / (rawHome + rawAway)) * remainder)
  const awayPct = remainder - homePct

  return { home: homePct, draw: drawProb, away: awayPct }
}
