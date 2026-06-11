export interface TeamState {
  id: string
  label: string
  description: string
  color: string
}

interface StateInput {
  avgGoalsScored: number
  avgGoalsConceded: number
  avgPossession: number
  avgShots: number
  avgShotsOnTarget: number
  avgFouls: number
  avgTackles: number
  avgInterceptions: number
  avgPasses: number
  avgSaves: number
  avgCrosses: number
  recentStreak: { wins: number; draws: number; losses: number }
  cleanSheets: number
  totalGames: number
}

export function detectTeamStates(input: StateInput): TeamState[] {
  const states: TeamState[] = []
  const n = input.totalGames
  if (n < 2) return states

  const csRatio = n > 0 ? input.cleanSheets / n : 0

  // 1. Conceding Many Goals
  if (input.avgGoalsConceded > 2) {
    states.push({
      id: 'conceding-many',
      label: 'Conceding Many Goals',
      description: `this team is conceding an average of ${input.avgGoalsConceded.toFixed(1)} goals per game over the last ${n} matches`,
      color: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30',
    })
  }

  // 2. Very Dangerous Attack
  if (input.avgGoalsScored > 2.2) {
    states.push({
      id: 'dangerous-attack',
      label: 'Very Dangerous Attack',
      description: `this team is averaging ${input.avgGoalsScored.toFixed(1)} goals scored per game — among the most prolific attacking sides`,
      color: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30',
    })
  }

  // 3. Weak Defense
  if (input.avgGoalsConceded > 1.8 && input.avgGoalsConceded <= 2) {
    states.push({
      id: 'weak-defense',
      label: 'Weak Defense',
      description: `this team is conceding ${input.avgGoalsConceded.toFixed(1)} goals per game — defensive frailties are a concern`,
      color: 'bg-feedback-warning/20 text-feedback-warning border-feedback-warning/30',
    })
  }

  // 4. Congested Midfield
  if (input.avgPasses > 135 && input.avgCrosses < 3 && input.avgPossession > 50) {
    states.push({
      id: 'congested-midfield',
      label: 'Congested Midfield',
      description: 'this team funnels play through the central midfield, keeping the ball narrow and relying on combinations through the middle',
      color: 'bg-accent/20 text-accent border-accent/30',
    })
  }

  // 5. Winning Streak
  if (input.recentStreak.wins >= 4) {
    states.push({
      id: 'winning-streak',
      label: 'Winning Streak',
      description: `this team has won ${input.recentStreak.wins} consecutive matches — formidable form`,
      color: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30',
    })
  }

  // 6. Losing Streak
  if (input.recentStreak.losses >= 3) {
    states.push({
      id: 'losing-streak',
      label: 'Losing Streak',
      description: `this team has lost ${input.recentStreak.losses} consecutive matches — in a concerning run of form`,
      color: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30',
    })
  }

  // 7. Clean Sheet Streak
  if (csRatio >= 0.6 && input.avgGoalsConceded < 0.8) {
    states.push({
      id: 'clean-sheet-streak',
      label: 'Defensive Wall',
      description: `this team has kept clean sheets in ${Math.round(csRatio * 100)}% of recent matches — a miserly defence`,
      color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    })
  }

  // 8. High Pressing
  if (input.avgTackles > 7 && input.avgInterceptions > 25) {
    states.push({
      id: 'high-pressing',
      label: 'High Pressing',
      description: 'this team presses aggressively high up the pitch, winning tackles and interceptions at an elite rate',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    })
  }

  // 9. Goal Drought
  if (input.avgGoalsScored < 0.6 && n >= 3) {
    states.push({
      id: 'goal-drought',
      label: 'Goal Drought',
      description: `this team is averaging only ${input.avgGoalsScored.toFixed(1)} goals per game — struggling to find the net`,
      color: 'bg-feedback-error/20 text-feedback-error border-feedback-error/30',
    })
  }

  // 10. Free Scoring
  if (input.avgGoalsScored > 1.5 && input.avgGoalsScored <= 2.2) {
    states.push({
      id: 'free-scoring',
      label: 'Free Scoring',
      description: `this team is averaging ${input.avgGoalsScored.toFixed(1)} goals per game — consistently finding the net`,
      color: 'bg-feedback-success/20 text-feedback-success border-feedback-success/30',
    })
  }

  // 11. Set-Piece Threat
  if (input.avgCorners > 5 && input.avgFreeKicks > 3) {
    states.push({
      id: 'set-piece-threat',
      label: 'Set-Piece Threat',
      description: 'this team wins an unusually high number of corners and free kicks — a constant threat from dead-ball situations',
      color: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    })
  }

  // 12. Route One
  if (input.avgPasses < 115 && input.avgSaves > 4 && input.avgPossession < 44) {
    states.push({
      id: 'route-one',
      label: 'Route One',
      description: 'this team plays direct football — long balls bypass the midfield and the goalkeeper is frequently involved',
      color: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    })
  }

  return states
}
