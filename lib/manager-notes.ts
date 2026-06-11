export interface ManagerNote {
  text: string
  type: 'positive' | 'negative' | 'neutral'
}

interface NoteInput {
  avgGoalsScored: number
  avgGoalsConceded: number
  avgPossession: number
  avgShots: number
  avgShotsOnTarget: number
  avgFouls: number
  avgTackles: number
  avgInterceptions: number
  avgPasses: number
  avgSuccessfulPasses: number
  avgCrosses: number
  avgSaves: number
  avgCorners: number
  avgFreeKicks: number
  avgOffsides: number
  recentStreak: { wins: number; draws: number; losses: number }
  totalGames: number
}

export function generateManagerNotes(input: NoteInput): ManagerNote[] {
  const notes: ManagerNote[] = []
  const n = input.totalGames
  if (n < 3) return [{ text: 'Not enough recent games to generate observations.', type: 'neutral' }]

  const pa = input.avgPasses > 0 ? input.avgSuccessfulPasses / input.avgPasses : 0
  const shotAccuracy = input.avgShots > 0 ? input.avgShotsOnTarget / input.avgShots : 0

  // Positive notes
  if (input.recentStreak.wins >= 3) {
    notes.push({ text: 'This manager is on a winning streak — confidence is high across the squad.', type: 'positive' })
  }
  if (input.avgGoalsScored > 2.5) {
    notes.push({ text: 'The team has been scoring freely lately, averaging over 2.5 goals per game.', type: 'positive' })
  }
  if (input.avgGoalsConceded < 0.8) {
    notes.push({ text: 'The defence has been solid — conceding less than a goal per game on average.', type: 'positive' })
  }
  if (input.avgPossession > 55) {
    notes.push({ text: 'Dominates possession consistently, controlling the tempo of matches.', type: 'positive' })
  }
  if (input.avgShots > 12) {
    notes.push({ text: 'Creates plenty of chances, averaging over 12 shots per game.', type: 'positive' })
  }
  if (shotAccuracy > 0.55) {
    notes.push({ text: 'Clinical in front of goal — a high proportion of shots are finding the target.', type: 'positive' })
  }
  if (input.avgInterceptions > 28) {
    notes.push({ text: 'Reads the game exceptionally well — intercepting opposition passes at a high rate.', type: 'positive' })
  }
  if (input.avgTackles > 8 && input.avgFouls < 2) {
    notes.push({ text: 'Wins the ball cleanly through tackles without resorting to fouls — disciplined defending.', type: 'positive' })
  }
  if (n >= 3 && input.recentStreak.losses === 0) {
    notes.push({ text: 'Unbeaten in recent games — difficult to beat right now.', type: 'positive' })
  }

  // Negative notes
  if (input.recentStreak.losses >= 3) {
    notes.push({ text: 'On a losing streak — morale may be low and changes are needed.', type: 'negative' })
  }
  if (input.avgGoalsConceded > 2) {
    notes.push({ text: 'Conceding a lot lately — the defence is being breached over 2 times per game.', type: 'negative' })
  }
  if (input.avgGoalsScored < 0.8) {
    notes.push({ text: 'Struggling to score — less than a goal per game is a concern going forward.', type: 'negative' })
  }
  if (input.avgPossession < 40) {
    notes.push({ text: 'Struggling to keep the ball — possession has dropped below 40% on average.', type: 'negative' })
  }
  if (input.avgShots < 6) {
    notes.push({ text: 'Not creating enough chances — averaging fewer than 6 shots per game.', type: 'negative' })
  }
  if (shotAccuracy < 0.30 && input.avgShots > 8) {
    notes.push({ text: 'Wasteful in front of goal — many shots but too few are on target.', type: 'negative' })
  }
  if (input.avgFouls > 4 && input.avgTackles < 5) {
    notes.push({ text: 'Discipline is a concern — committing many fouls without winning the ball cleanly.', type: 'negative' })
  }
  if (input.avgSaves > 5) {
    notes.push({ text: 'The goalkeeper is being overworked — the defence is allowing too many shots.', type: 'negative' })
  }

  // Neutral / informational notes
  if (input.avgCrosses > 5) {
    notes.push({ text: 'Heavily reliant on wide deliveries — crosses are a primary attacking method.', type: 'neutral' })
  }
  if (input.avgPasses < 110) {
    notes.push({ text: 'Plays a direct style — bypassing the midfield with long passes.', type: 'neutral' })
  }
  if (input.avgFreeKicks > 3 && input.avgCorners > 4) {
    notes.push({ text: 'Creates danger from set-pieces — wins plenty of free kicks and corners.', type: 'neutral' })
  }
  if (input.avgOffsides > 2.5) {
    notes.push({ text: 'Forwards are constantly looking to run in behind — high risk, high reward.', type: 'neutral' })
  }
  if (input.avgPossession > 50 && input.avgCrosses < 2) {
    notes.push({ text: 'Keeps the ball patiently and attacks through central combinations — rarely goes wide.', type: 'neutral' })
  }
  if (input.avgTackles > 8 && input.avgFouls > 3) {
    notes.push({ text: 'Very aggressive without the ball — pressing and physical duels define the approach.', type: 'neutral' })
  }
  if (input.avgSaves < 2 && input.avgGoalsConceded < 1) {
    notes.push({ text: 'Defends by controlling the ball — the goalkeeper is rarely tested.', type: 'neutral' })
  }
  if (input.avgOffsides < 0.5 && input.avgPasses < 120) {
    notes.push({ text: 'Sits deep and hits long balls — forwards compete for knockdowns rather than running in behind.', type: 'neutral' })
  }

  return notes
}
