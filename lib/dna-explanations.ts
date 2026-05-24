export interface DNAExplanation {
  about: string
  tendencies: string[]
  selfNote: string
  weaknesses: string[]
}

export const DNA_EXPLANATIONS: Record<string, DNAExplanation> = {
  'Elite Dominators': {
    about:
      'A complete, high-performing style combining ball control, clinical attacking, and defensive organization. These teams dictate the game from start to finish.',
    tendencies: [
      'Controls possession above 53% consistently',
      'Creates many on-target chances every match',
      'Rarely concedes — defence is organized and solid',
      'Patient build-up with high pass accuracy',
    ],
    selfNote:
      'You are performing at an elite level. Keep the tempo up and stay concentrated — the higher you perform, the more opponents will try to disrupt your rhythm.',
    weaknesses: [
      'Deep defensive blocks can slow your build-up and frustrate your patterns',
      'Long balls over the top can bypass your high defensive line',
      'Fast counter-attacks on transition can catch you when over-committed going forward',
    ],
  },

  'Tiki-Taka': {
    about:
      'A possession-heavy, patient style built on short passes and fluid movement. Goals come from combinations, not direct balls — crosses are rare.',
    tendencies: [
      'Dominates the ball with patient, accurate passing',
      'Rarely plays direct — prefers to work the ball through the thirds',
      'Low cross count — danger comes through central combinations',
      'Pressing off the ball to regain possession quickly',
    ],
    selfNote:
      'Your strength is suffocating opponents with the ball. Keep your passing sharp and maintain spacing — if you rush, it breaks down.',
    weaknesses: [
      'Hard, aggressive pressing from the opponent can force errors and turnovers',
      'Direct long balls bypass your structure and create instant danger',
      'Teams that sit in a compact block and don\'t press can crowd your passing lanes',
    ],
  },

  'Gegenpressing': {
    about:
      'High-intensity counter-pressing that wins the ball back immediately after losing it. Physical, relentless, and exhausting for the opponent.',
    tendencies: [
      'Presses aggressively the moment possession is lost',
      'Recovers the ball quickly in dangerous areas of the pitch',
      'High tackle and interception numbers show defensive aggression',
      'Uses fouls as a tool to disrupt opponent rhythm when needed',
    ],
    selfNote:
      'Your engine is your energy. Maintain the press intensity throughout the game — if the press drops, your whole style falls apart.',
    weaknesses: [
      'High energy demands can lead to fatigue in long or physical games',
      'Calm, quick build-up play beats the press — opponents who don\'t panic will find space',
      'Long balls over the pressing line can catch you exposed at the back',
    ],
  },

  'Disciplined Pressers': {
    about:
      'Smart, organized pressing that wins the ball through positioning and reading the game rather than pure aggression. Low foul count shows tactical control.',
    tendencies: [
      'Intercepts passes by reading the opponent\'s patterns',
      'Cuts passing lanes intelligently without fouling',
      'Controlled, disciplined defensive shape that rarely overcommits',
    ],
    selfNote:
      'You win the ball through intelligence, not just effort. Stay disciplined in your shape — unnecessary fouls give away set-pieces and disrupt your structure.',
    weaknesses: [
      'Creative dribbling and quick one-two combinations can unlock your defensive lines',
      'Opponents with unpredictable passing patterns are harder to read and intercept',
    ],
  },

  'Quick Counter': {
    about:
      'A direct, fast-transition style. Absorb pressure, win the ball, and attack at pace before the opponent can reorganize.',
    tendencies: [
      'Accepts periods of lower possession to maximize transition opportunities',
      'Attacks with speed and directness the moment the ball is won',
      'Runs in behind the defensive line — regularly caught offside shows the intent',
      'Avoids unnecessary passes — gets forward fast',
    ],
    selfNote:
      'You thrive when opponents over-commit in attack. Stay patient in defence and be explosive going forward — your danger is in the transition.',
    weaknesses: [
      'Teams that hold the ball and build slowly deny you the transitions you need',
      'If opponents sit back and don\'t commit, you struggle to create space',
      'Slow build-up play disrupts your rhythm — you need pace and directness to be effective',
    ],
  },

  'Long Ball Counter': {
    about:
      'A deep defensive block with direct balls to bypass the midfield. Efficient and physical — relies on winning second balls and hitting quickly.',
    tendencies: [
      'Defends deep and absorbs pressure without panic',
      'Goes long to bypass the opponent\'s press',
      'Keeper is active — regularly faces shots and handles them well',
      'Interceptions break up play rather than pressing high',
    ],
    selfNote:
      'Your goalkeeper is a crucial part of your style. Make sure your target man can hold up play — your effectiveness depends on winning the first contact.',
    weaknesses: [
      'Tight marking on target men and strong aerial defending neutralizes your main attack route',
      'Teams that press your goalkeeper and defenders limit your long ball options',
      'Possession-heavy teams can exhaust you by making you defend for long periods',
    ],
  },

  'The Grinders': {
    about:
      'Physical, combative and direct. Not the prettiest football, but effective — wins through work rate, duels, and set-piece danger.',
    tendencies: [
      'Competes physically in every duel and second ball',
      'Uses fouls and tackles to disrupt the opponent\'s rhythm',
      'Direct style with shorter passing sequences',
      'Dangerous at set-pieces from winning free kicks',
    ],
    selfNote:
      'Your mentality is your biggest asset. Keep the intensity up and make it uncomfortable for the opponent — you thrive when games get physical and scrappy.',
    weaknesses: [
      'Technical, possession-based teams can outplay you when the game stays clean',
      'If you can\'t force a physical battle, your direct style loses effectiveness',
      'High pass-accuracy opponents can pick you apart if you\'re chasing the game',
    ],
  },

  'Out Wide': {
    about:
      'An expansive style that uses the full width of the pitch. Danger comes from crosses, overlapping runs, and corners won from wide areas.',
    tendencies: [
      'Attacks down both flanks consistently',
      'Delivers crosses from wide positions regularly',
      'Earns plenty of corners through wide pressure',
      'Stretches defensive lines to create space in the box',
    ],
    selfNote:
      'Your fullbacks and wingers are your best weapons. Keep them active and overlapping — your effectiveness drops sharply if you let the opponent push you narrow.',
    weaknesses: [
      'Compact, narrow defences can cut off your crosses and limit your wide attacks',
      'Teams that defend deep with a back five make it hard to get quality deliveries in',
      'If your crossers are shut down, you lack alternative attacking routes',
    ],
  },

  'Set-Piece Specialists': {
    about:
      'Relies heavily on dead-ball situations — corners, free kicks, and crosses to create scoring opportunities. A threat every time they win a free kick or corner.',
    tendencies: [
      'Wins plenty of corners and free kicks per game',
      'Dangerous at set-pieces through well-rehearsed routines',
      'Generates chances from dead-ball situations regularly',
    ],
    selfNote:
      'Every set-piece is a chance — treat them seriously. Work on your delivery and movement to maximize this advantage in every game.',
    weaknesses: [
      'Teams that defend set-pieces very well and have good aerial presence limit your main threat',
      'Opponents who avoid giving fouls in dangerous areas take away your best opportunity creator',
      'If your set-piece routine becomes predictable, opponents can prepare specifically for it',
    ],
  },

  'Shoot-on-Sight': {
    about:
      'A high-volume shooting style that gets the ball forward and shoots early and often. The philosophy is quantity over precision — one of those will go in.',
    tendencies: [
      'Shoots frequently, including from distance and tight angles',
      'Gets the ball forward quickly without overplaying',
      'Creates lots of goal-scoring attempts per game',
      'Lower shot-on-target ratio shows willingness to try from anywhere',
    ],
    selfNote:
      'Volume is your weapon — keep shooting. But don\'t become predictable: mix in runs in behind to stop the goalkeeper from getting too comfortable.',
    weaknesses: [
      'Organized defences that block shooting lanes force you to play more patiently, which isn\'t your strength',
      'Goalkeepers who are good at handling shots from distance reduce your effectiveness',
      'Opponents that press and stop you shooting from range neutralize your main threat',
    ],
  },

  'Pragmatic Stabilizers': {
    about:
      'A flexible, balanced style with no extreme tendencies. Solid without being dominant in any single area — adapts to what the game demands.',
    tendencies: [
      'Plays a well-rounded, balanced game',
      'Doesn\'t commit heavily to any one approach',
      'Adapts based on opponent and game situation',
    ],
    selfNote:
      'Your balance is a strength, but it\'s also a ceiling. As you develop a more defined style, you\'ll become harder to prepare for and more consistent.',
    weaknesses: [
      'Specialist styles can find edges against you — very technical teams or very physical teams may exploit specific gaps',
      'Without a dominant strength, it\'s harder to impose yourself on the game',
    ],
  },
}
