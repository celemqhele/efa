export interface DNAExplanation {
  about: string
  tendencies: string[]
  selfNote: string
  weaknesses: string[]
}

export const DNA_EXPLANATIONS: Record<string, DNAExplanation> = {
  'Elite Dominators': {
    about:
      'Controls games through complete territorial and technical dominance. The statistical signature combines high possession, heavy passing volume, accurate distribution, clinical shooting, and defensive solidity. This profile emerges when a team simultaneously controls the ball (avg possession >55%), builds through intricate passing (avg passes >148), tests the keeper regularly (avg SoT >6), and rarely concedes (avg GA <0.7). The keeper faces minimal work because the opponent is pinned back — the few chances that do come are typically low-quality.',
    tendencies: [
      'Dictates tempo through sustained possession and patient build-up',
      'Creates high shot volume with above-average on-target accuracy',
      'Overwhelms opponents through total control — ball, space, and tempo',
      'Defends by keeping the ball; goalkeeper rarely tested because the opponent never gets near goal',
      'Dominates both the passing and pressing metrics without committing reckless fouls',
    ],
    selfNote:
      'You are playing at an elite level where your control suffocates opponents. Stay patient in build-up — the goals will come. The danger is complacency: one lapse in concentration can undo 90 minutes of dominance. Keep the defensive line alert for counter-attacks when you over-commit numbers forward.',
    weaknesses: [
      'Compact low blocks can frustrate your build-up and force sideways passing without penetration',
      'Quick direct attacks bypass your high defensive line and catch your fullbacks advanced',
      'Physical teams that disrupt your passing rhythm through tactical fouling can knock you out of your flow',
      'When Plan A (possession) fails, you may lack the direct alternative to break a stubborn defence',
    ],
  },

  'Tiki-Taka': {
    about:
      'Possession as both attack and defence. The statistical profile shows very high possession (>56%), high pass count (>152), exceptional pass accuracy (>81%), very few crosses (<1), low fouls, and low GA. The style forgoes width and directness entirely — danger comes through central combinations, one-twos, and through balls. The midfield squeeze (compact spacing between lines) is the key mechanism: players stay close enough to offer passing angles while compressing the space the opponent can defend.',
    tendencies: [
      'Prioritizes ball retention above all else — keeps possession even in defensive thirds',
      'Builds through short, precise passes; rarely plays long or direct',
      'Central combinations are the primary attacking method — crosses are almost absent',
      'Squeezes the midfield to create passing triangles and numerical overloads centrally',
      'Pressing after loss is coordinated rather than frantic — cuts passing lanes rather than chasing',
    ],
    selfNote:
      'Your philosophy is that the ball never gets tired. Keep spacing tight and passing angles open — your biggest enemy is rushing. When opponents sit deep, resist the urge to force it forward; let the ball do the work and pull them out of shape through circulation. Maintain your positional discipline — runners from deep are your best weapon.',
    weaknesses: [
      'Intense, aggressive pressing can force errors if your players lack composure on the ball',
      'Direct long balls bypass your structure entirely, creating one-on-one defensive situations',
      'Compact low blocks with disciplined shape deny space between the lines — your passing network becomes ornamental rather than penetrative',
      'The physical toll of constant movement off the ball can lead to second-half drop-off in intensity',
    ],
  },

  'Gegenpressing': {
    about:
      'High-intensity counter-pressing that treats every lost ball as an immediate attacking opportunity. The statistical profile shows high tackles (>8), high interceptions (>30), elevated fouls (>3), moderate possession (~49%), high offsides (>2), and high shot volume. The core mechanism is the 5-second rule: win the ball back within 5 seconds of losing it, ideally in the opponent\'s half. Fouls are tactical — they disrupt opponent rhythm and prevent counter-attacks when the press is bypassed.',
    tendencies: [
      'Switches instantly from attack to defence mode on ball loss — no transition phase',
      'Wins the ball high up the pitch through coordinated pressing traps',
      'Commits tactical fouls to stop counter-attacks when the press is broken',
      'Plays with a high defensive line that squeezes the opponent into their own half',
      'Generates shots directly from turnovers in dangerous areas',
    ],
    selfNote:
      'Your engine is your energy. The press must be coordinated — one player pressing alone is a cone. Trigger the press as a unit when the opponent receives with their back to goal or in a wide area near the touchline. If the press drops below 70% intensity, your entire defensive structure becomes exposed. Rotate early to maintain freshness across the front five.',
    weaknesses: [
      'High energy demands cause visible drop-off in the final 20 minutes — opponents can exploit tired legs',
      'Calm, composed build-up players bypass the press with quick one-touch passing',
      'Long diagonals over the pressing line switch the play and expose the space behind your advanced fullbacks',
      'Clinical finishers need only 2-3 chances to punish the space you leave behind',
    ],
  },

  'Disciplined Pressers': {
    about:
      'Organized pressing that wins the ball through positioning and reading the game rather than physical aggression. The statistical profile shows high interceptions (>30), high tackles (>7), but very low fouls (<1) — the hallmark of a team that reads the game rather than chasing it. Average possession and passing suggest a counterpressing style that prioritizes structural integrity over ball recovery speed. This is the most efficient pressing style: maximum ball recovery with minimum defensive risk.',
    tendencies: [
      'Cuts passing lanes through anticipation and positioning rather than sprinting',
      'Wins the ball high but through interceptions, not tackles — reads the next pass',
      'Rarely commits fouls — presses with discipline and tactical awareness',
      'Forces opponents into low-value passing options (backward or sideways) before tightening the trap',
      'Maintains compact defensive shape while pressing — rarely caught out of position',
    ],
    selfNote:
      'You press with your brain, not just your legs. Read the opponent\'s body language and passing patterns — your interceptions come from being one step ahead. Stay disciplined: the moment you dive in and miss, your entire structure opens up. Patience in the press is your superpower — the opponent will eventually run out of safe options.',
    weaknesses: [
      'Elite dribblers who can beat a man one-on-one break your pressing structure instantly',
      'Unpredictable passing patterns (e.g., teams with high创造性 and no fixed shape) are harder to read',
      'Quick one-two combinations can unlock the space between your pressing lines',
      'Teams that bypass the press with long diagonals force you to reset your defensive shape repeatedly',
    ],
  },

  'Quick Counter': {
    about:
      'Vertical, explosive transitions that punish opponents who over-commit. The statistical profile shows low possession (<45%), high shot volume (>10), high offsides (>2), high saves (>4), low passes (<122), and low pass accuracy (<73%). The keeper is busy because the team absorbs pressure before hitting on the break. This is a game-state-dependent style: it thrives when opponents push forward and leaves space in behind. The high offside count is a feature, not a bug — forwards constantly test the defensive line.',
    tendencies: [
      'Absorbs pressure in a medium-to-low block, then explodes forward on turnover',
      'Attacks with minimal touches — gets the ball forward before the opponent can reorganize',
      'Forwards make constant runs in behind, accepting offside calls as part of the strategy',
      'Keeper is a key attacking trigger — distribution starts the counter',
      'Avoids unnecessary sideways or backward passes in transition',
    ],
    selfNote:
      'Your moment is the turnover. Stay compact and patient without the ball — the longer you keep the opponent in front of you, the more space appears behind them. Your forwards must be explosive over 5-10 yards. If the opponent sits back and doesn\'t commit numbers forward, you lose your primary weapon — prepare a Plan B for possession-heavy opponents.',
    weaknesses: [
      'Teams that keep the ball and build slowly deny you the transitions you thrive on',
      'Deep low blocks with no space in behind leave you without your main attacking route',
      'If your forwards are isolated, you can\'t hold the ball up long enough for support to arrive',
      'Possession-dominant opponents can pin you back for extended periods, increasing defensive fatigue and error risk',
    ],
  },

  'Long Ball Counter': {
    about:
      'Deep defence and direct attacks bypassing the midfield entirely. The statistical profile shows very low possession (<42%), low passes (<115), low pass accuracy (<70%), very low corners (<2), very low offsides (<1), and very high saves (>5). The goalkeeper is effectively a central defender in possession — long distribution starts attacks. The team doesn\'t build through midfield; it bypasses it. The low offside count confirms forwards are holding position rather than running in behind — they compete for first-contact knockdowns.',
    tendencies: [
      'Defends deep in a compact low block, often with a back five',
      'Goes direct from goal kicks and defensive clearances — midfield is a battleground for second balls',
      'Keeper faces many shots but the shots are typically from distance or in crowded areas',
      'Interceptions win the ball rather than tackles — reads the long pass and steps in',
      'Offensive corners are rare but dangerous when they come — aerial presence is a key weapon',
    ],
    selfNote:
      'Your goalkeeper and centre-backs are your primary playmakers. The target man must win first-contact headers and hold the ball up — everything depends on it. Stay compact and patient: the longer you keep the game at 0-0, the more frustrated the opponent gets. Your physicality is your edge — make every duel a battle.',
    weaknesses: [
      'Tight man-marking on your target man neutralizes your primary attacking outlet',
      'Goalkeeper pressing from the opponent forces rushed clearances and gives away possession cheaply',
      'Possession-heavy teams can exhaust you by making you defend for long spells without the ball',
      'When trailing, you lack the technical ability to build patient attacks — chasing the game is not your strength',
    ],
  },

  'The Grinders': {
    about:
      'Physical, combative football that wins through duels, set-pieces, and sheer work rate. The statistical profile shows high fouls (>3), high tackles (>8), high free kicks won (>3), low passes (<120), low possession (<46%), low pass accuracy (<71%), and high saves (>4). Every phase of play involves physical contact — through duels for first contact, second balls, aerial challenges, and tactical fouls. This is not pretty football, but it is brutally effective: the team makes the game uncomfortable for technically superior opponents.',
    tendencies: [
      'Engages physically in every duel — tackles, shoulder charges, and aerial challenges',
      'Wins and gives fouls in equal measure — disrupts rhythm through constant physical contact',
      'Plays direct football with short passing sequences; avoids elaborate build-up',
      'Dangerous from set-pieces — free kicks and corners are primary scoring opportunities',
      'Wears opponents down over 90 minutes through relentless physical intensity',
    ],
    selfNote:
      'Make every game a street fight. Your first job is to impose physicality — the opponent needs to know they\'ve been in a game. Target their technically best player and make every touch uncomfortable. Your set-pieces are your best chance to score — practice routines and make every dead ball count. Don\'t try to outplay technical teams at their own game; drag them into your world.',
    weaknesses: [
      'Clean, technical possession teams can pick you apart if the referee protects them',
      'If you can\'t force physical dominance, your tactical limitations are exposed — you lack technical answers',
      'High foul count gives away dangerous set-pieces and accumulates suspensions',
      'Teams that move the ball quickly in one or two touches bypass your physical pressing and find space',
    ],
  },

  'Out Wide': {
    about:
      'Expansive attacking play that stretches the opponent through constant width. The statistical profile shows high crosses (>4), high corners (>5), moderate possession (~50%), moderate passing (~135), and high shot volume (>10). The full width of the pitch is the primary attacking channel — overlaps, underlaps, and wide combinations create crossing opportunities. Corners are a natural byproduct of wide pressure. The team stretches defensive lines horizontally, creating space for midfield runners to exploit between centre-backs and fullbacks.',
    tendencies: [
      'Attacks down both flanks consistently — fullbacks push high and wide',
      'Delivers crosses early and often — whipped, clipped, and driven into the box',
      'Wins corners through sustained wide pressure and deflections off defenders',
      'Stretches defensive shape to create pockets of space between centre-backs for midfield runners',
      'Uses width as a weapon both in open play and from set-piece situations',
    ],
    selfNote:
      'Your fullbacks and wingers are your creative engine. Keep them high and wide — stretch the pitch to its maximum width. If the opponent narrows their shape, exploit the space on the flanks. If they spread wide, hit them through the center with your midfield runners. Your crossing must be varied — low driven, high floated, cut-backs — to keep defenders guessing. A predictable cross is an easy clearance.',
    weaknesses: [
      'Compact narrow defences with strong aerial centre-backs can cut off your primary route to goal',
      'Back-five formations leave you outnumbered in wide areas and reduce crossing space',
      'If your wide players are shut down or have poor delivery, you lack alternative attacking patterns',
      'Quick counter-attacking teams can exploit the space your advanced fullbacks leave behind',
    ],
  },

  'Set-Piece Specialists': {
    about:
      'Dead-ball situations are the primary scoring method — corners, free kicks, and throw-ins are treated as attacking opportunities. The statistical profile shows high corners (>5), high free kicks (>3), high fouls (>3, winning dangerous free kicks), high crosses (>3), and high shot volume. The team actively wins fouls in dangerous areas through dribbling, quick turns, and attacking running. Every set-piece is rehearsed — routines, movements, and delivery targets are specific to the opponent\'s defensive setup. The statistical signature overlaps with Out Wide in corner volume but distinguishes itself through free kick frequency.',
    tendencies: [
      'Wins fouls in dangerous areas through purposeful attacking carries and quick direction changes',
      'Creates chances from corners through well-rehearsed routines — near-post flick-ons, far-post overloads, short corners',
      'Generates shots from free kicks — both direct attempts and headed deliveries',
      'Treats throw-ins in the final third as set-piece opportunities with structured movement',
      'Studies opponent defensive set-piece setups to target specific weak points',
    ],
    selfNote:
      'Every dead ball is a goal-scoring opportunity. Be deliberate about winning fouls in advanced areas — a free kick on the edge of the box is as good as a penalty. Practice your set-piece routines relentlessly: the difference between a routine clearance and a goal is movement off the ball. Have multiple options — near-post flick, far-post overload, short corner, and direct shot.',
    weaknesses: [
      'Teams with strong aerial defending and good set-piece organization neutralize your primary weapon',
      'Opponents who avoid giving away fouls in dangerous areas starve you of your best chances',
      'If your delivery is off on a given day, your attacking output drops significantly',
      'Predictable routines can be studied and countered by well-prepared defensive setups',
    ],
  },

  'Shoot-on-Sight': {
    about:
      'Volume shooting philosophy: get the ball forward and shoot early, often, and from anywhere. The statistical profile shows very high total shots (>13) but low shot accuracy (<0.5 SoT/shots ratio), high offsides (>2), moderate possession (~50%), and high corners (>4). The low on-target ratio is not poor finishing — it reflects a willingness to shoot from low-probability positions: distance, tight angles, and under pressure. The logic is statistical: more shots = more goals, even at a lower conversion rate. Deflections, rebounds, and keeper errors create secondary chances.',
    tendencies: [
      'Shoots from distance, tight angles, and early in the attacking phase — rarely passes up a shooting opportunity',
      'Generates many corners from blocked shots and deflections',
      'Forwards make aggressive runs behind the defence — offsides are accepted as part of the approach',
      'Creates chaos in the box through sheer volume — second balls and rebounds are actively hunted',
      'Relies on quantity over quality — the keeper is tested repeatedly from all ranges',
    ],
    selfNote:
      'Volume is your strategy. First thought in the final third: shoot. Every shot creates a chance — corner, rebound, deflection, or goal. Don\'t become predictable — mix in a through ball or a pass to keep the keeper honest. If the opposition blocks everything, look for the second ball. Your forwards must be alert for rebounds — most goals from this style come from the first shot being saved.',
    weaknesses: [
      'Organized defences that block shooting lanes and maintain shape force you into low-percentage shots',
      'Goalkeepers with strong handling and positioning reduce rebound opportunities',
      'Teams that press aggressively and stop you from winding up shots neutralize your primary tactic',
      'When shots aren\'t falling, the frustration can lead to forcing even lower-percentage attempts',
    ],
  },

  'Pragmatic Stabilizers': {
    about:
      'A flexible, adaptive style with no extreme statistical tendencies. This is the default classification when no other profile scores above the threshold — it indicates a team that either has limited data, is still developing its identity, or adapts its approach game-by-game. The statistical profile is balanced across all metrics without leaning heavily into any single dimension. This is not a negative classification — it simply means the team\'s style is not yet statistically dominant in any specific direction.',
    tendencies: [
      'Plays a balanced, well-rounded game without extreme tactical commitment',
      'Adapts approach based on opponent, game state, and match context',
      'Does not show strong statistical signals in any single tactical dimension',
      'Can shift between styles within a game — pragmatic rather than dogmatic',
      'May reflect a transitional period (new manager, squad changes, or tactical evolution)',
    ],
    selfNote:
      'Your balance is a strength — opponents can\'t prepare for a single dominant pattern. But it can also be a ceiling: specialist teams with a clear identity may find edges against you. As you develop a more defined tactical approach, you become harder to prepare for and more consistent. Consider leaning into your natural strengths — look at which stats are highest and build around them.',
    weaknesses: [
      'Specialist styles with clear tactical identities can identify and exploit weaknesses in a general approach',
      'Without a dominant strength, it\'s harder to impose your game on the opponent',
      'Teams with extreme approaches (very physical or very technical) may find specific edges against you',
      'In critical moments, a team without a defined style may lack the automatic responses of a specialist team',
    ],
  },
}
