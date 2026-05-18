export interface DisconnectRule {
  minute: string
  restart: string
  note: string
}

export const DISCONNECT_RULES: DisconnectRule[] = [
  { minute: '10\'', restart: '9-minute full game', note: 'Carry aggregate score' },
  { minute: '20\'', restart: '8-minute full game', note: 'Carry aggregate score' },
  { minute: '30\'', restart: '7-minute full game', note: 'Carry aggregate score' },
  { minute: '40\'', restart: '6-minute full game', note: 'Carry aggregate score' },
  { minute: '50\'', restart: '5-minute full game', note: 'Carry aggregate score' },
  { minute: '60–70\'', restart: '5-minute game, FIRST HALF ONLY', note: 'Carry aggregate score' },
  { minute: '80\'+', restart: '5-minute game, FIRST 20 MINUTES ONLY', note: 'Carry aggregate score' },
]

export const OFFICIAL_RULES = [
  { icon: '✅', rule: 'Match duration: 10 minutes' },
  { icon: '✅', rule: 'Injuries: ON' },
  { icon: '✅', rule: 'Substitutions: 6' },
  { icon: '✅', rule: 'Auto Assist: OFF' },
  { icon: '❌', rule: 'Extra Time: OFF (league & group stage)' },
  { icon: '❌', rule: 'Penalties: OFF (league & group stage)' },
  { icon: '✅', rule: 'Extra Time + Penalties: ON (single-leg knockout finals only)' },
  { icon: '✅', rule: 'Extra Time: ON (2nd leg of two-legged ties, if aggregate level)' },
  { icon: '🏠', rule: 'Home team creates the matchroom in eFootball' },
]
