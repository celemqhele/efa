/**
 * Season 3 Hand-Crafted Playstyles
 * Each team gets a unique, individually written playstyle profile
 *
 * Usage: npx tsx scripts/season3-playstyles.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'

const URL = 'https://dtxnqtfqsehofezdmdbd.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0eG5xdGZxc2Vob2ZlemRtZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUzNywiZXhwIjoyMDk0NjE5NTM3fQ.OtIVGf-WNvnMrkZ--rSwYb6WVnUV2PWqxvtjzvEPsHc'

const supabase = createClient(URL, KEY)

// ── Team IDs ──────────────────────────────────────────────────────────────────
const TEAMS: Record<string, string> = {
  'Al Ettifaq':          '89b4db6b-0bb6-4760-a742-01261d2aee3b',
  'Al Hilal':            '01c6d980-895e-4b03-a66b-7db481b3b8d2',
  'Al Khaleej':          '57214b5f-2e2f-4cb3-a248-4b3fc29f6b96',
  'Arsenal':             '2d8cee6f-7ac4-40dd-b001-15792ce7036b',
  'Barcelona':           '1d70ba4a-35a9-4153-9305-1d215d7635f0',
  'Bayer Leverkusen':    '7ef71f2e-0eba-4cb4-ab01-4cfe795f263d',
  'Bayern Munchen':      'b4c61e75-cb1f-4bb1-b094-9eee0344be71',
  'Bournemouth':         '4818ac8d-d9e8-4588-ab74-4db6ba683c70',
  'Brighton':            '77885f9a-45a5-415f-aee8-722fe524e097',
  'Burnley':             '1991eafa-e791-4c96-b4e7-2cc47ab94d63',
  'Chelsea':             'f150b294-acae-4247-b3f0-7be7769e2933',
  'Club Brugge':         'cd5931af-fe19-4aef-8863-fb6cc939c65a',
  'Como 1907':           '0c3fae4f-81ad-4f4a-8114-d57cf3f322fc',
  'Internazionale':       '82809e10-d12c-4317-bd34-6263a9e161cc',
  'Liverpool':           'cdce1c5b-1ddd-47fa-9b94-110b362ded96',
  'Manchester City':     '3ad8517d-fcfb-46ce-a1a3-d50873b61a47',
  'Manchester United':   'd8deab1e-2ad0-4643-8dc2-b98c29e25070',
  'AC Milan':             'd706907c-834f-47e6-acf8-2f32aab184b2',
  'Nantes':              'e9f6ed68-060d-4bb5-ad64-c93eb0685069',
  'Newcastle United':    '6b72a4ea-f2e3-4228-8e6b-afffd3e9d1cc',
  'Palmeiras':           '48c69c22-a49f-41a3-ae23-29d209b5da6c',
  'Paris Saint Germain': 'c5005494-6594-48f0-abe4-d2663d30bda4',
  'Real Betis':          '416ad02e-5721-43e9-b1ef-ae89511e5e97',
  'Real Madrid':         'e84088b1-d610-4be8-ac40-5d9448e9468c',
  'Santos':              '17dc53e9-b93d-485d-8e0f-e5fb2fd17780',
  'Sporting Cp':         '7a0e5c7c-92cd-451e-a849-e2b8b4e98a9f',
}

const TEAM_NAMES = Object.keys(TEAMS)

type Profile = { about: string; tendencies: string[]; weaknesses: string[]; coachNote: string }

// ══════════════════════════════════════════════════════════════════════════════
// PLAYSTYLE PROFILES — one per team, hand-crafted
// ══════════════════════════════════════════════════════════════════════════════

const PROFILES: Record<string, Profile> = {

  // ── Al Ettifaq ──────────────────────────────────────────────────────────────
  'Al Ettifaq': {
    about: "Al Ettifaq are a high-volume attacking side that overwhelms opponents through sheer shot quantity, averaging over 8 attempts per game. Their approach is built on relentless forward thrust — they dominate possession at a 49.4% clip and fire off shots with an exceptional 78% accuracy rate, meaning nearly every attempt is on target. Despite averaging 6.3 tackles per game, they remain remarkably disciplined, conceding barely 0.4 fouls per match. They generate 3.2 goals per game through persistent pressure and smart movement in the final third, though they concede 2.7 at the back — making them a classic 'we'll score more than you' outfit that thrives in open, end-to-end contests.",
    tendencies: [
      "Relentless shot volume with high accuracy — they don't waste their chances and will test any goalkeeper repeatedly from multiple angles",
      "Disciplined defensive approach that avoids fouls entirely — they win the ball through positioning rather than physicality, denying opponents set-piece opportunities",
      "Midfield control through volume passing at 122.9 passes per game with 70.2% accuracy — they prioritize keeping the ball moving to create openings",
    ],
    weaknesses: [
      "Al Ettifaq tends to concede 2.7 goals per game with only 6.3 tackles, so attempt to run at their defence directly with pace and dribbling, because they lack the defensive interventions to stop one-on-one situations.",
      "Al Ettifaq tends to become vulnerable when their rhythm is broken by early pressure, so attempt to press their build-up aggressively in the first 15 minutes, because their passing accuracy drops noticeably when hurried.",
    ],
    coachNote: "Al Ettifaq play through khumoshxta_, whose 51-game managerial record (27W-7D-17L) has forged a team that values attacking volume over defensive caution. They will test you with a relentless wave of shots — expect 8+ attempts and most of them on target. Their biggest vulnerability is at the back, where 2.7 goals conceded per game suggests you can hurt them if you survive the initial storm. Stay compact in defence, hit them on the counter, and target their backline directly rather than trying to out-pass them.",
  },

  // ── Al Hilal ────────────────────────────────────────────────────────────────
  'Al Hilal': {
    about: "Al Hilal are the league's most devastating attacking force, producing an astonishing 6 goals per game from 11.2 shots with 80.5% accuracy — numbers that suggest every attack carries a genuine goal threat. They see an even share of possession at 50.5% and complete 76.7% of their 149.6 passes per game, allowing them to control tempo while probing for openings. Their 7.9 tackles per game provide a solid defensive platform, and they concede just 1.9 saves per match on average — meaning their goalkeeper is rarely troubled. They are the complete package: balanced possession, clinical finishing, and a defence that barely gives opponents a sniff.",
    tendencies: [
      "Lethal shot conversion with elite accuracy — they pass the ball until a clear opening appears, then strike with devastating precision",
      "Possession-based control that wears opponents down — at 149.6 passes per game they cycle the ball relentlessly, waiting for defensive lapses",
      "Active defensive presence with 7.9 tackles and 30.3 interceptions — they win the ball high and turn defence into attack in one transition",
    ],
    weaknesses: [
      "Al Hilal tends to overcommit players forward in search of goals, so attempt to counter-attack quickly through the wide channels after winning possession, because their full-backs can be caught high up the pitch.",
      "Al Hilal tends to rely heavily on their passing rhythm to control games, so attempt to disrupt their midfield with physical, aggressive pressing, because if you break their passing sequences they lose their attacking cohesion.",
    ],
    coachNote: "Al Hilal play under Terrence, whose extraordinary 49W-2D-7L career record has built a winning machine. They average 6 goals per game — six. Every match against them is a survival exercise. They complete 76.7% of their passes and win the ball back 30.3 times per game through interceptions. Your best hope: disrupt their passing lanes with a compact mid-block, force them wide, and accept that you will concede chances. The key is to make those chances low-percentage by crowding the box.",
  },

  // ── Al Khaleej ──────────────────────────────────────────────────────────────
  'Al Khaleej': {
    about: "Al Khaleej enter the season as an unknown quantity under manager whitey, with no prior managerial data to draw from. They are the wildcard of Season 3 — a team with everything to prove and no established tactical identity to be scouted. Their squad is built on raw potential rather than proven output, and their approach will likely evolve as the season progresses. Opponents should expect a side that is still discovering its identity, which makes them both unpredictable to face and vulnerable to experienced teams who know exactly who they are.",
    tendencies: [
      "Adaptable and unpredictable — with no data history, they are likely to experiment with formations and tactical approaches early in the season",
      "Energetic and eager to prove themselves — expect high work rate and commitment as the squad fights to establish credibility",
      "Fast transitions and direct attacking — without a refined possession system, they will likely look to go forward quickly when they win the ball",
    ],
    weaknesses: [
      "Al Khaleej tends to lack the tactical cohesion that comes from a settled system, so attempt to impose your established playing style early in the match, because they will struggle to adapt once a rhythm is set against them.",
      "Al Khaleej tends to be vulnerable to experienced teams who control possession patiently, so attempt to dominate the ball and force them to chase, because their defensive organisation will fray under sustained pressure as the game wears on.",
    ],
    coachNote: "Al Khaleej are the mystery opponent of Season 3 under whitey. No prior match data exists, which means your scouting report will be written in real time as the season unfolds. Assume they will come out with high energy and a point to prove. Your best approach is to establish control early — don't let them build confidence. Dominate possession, be patient, and wait for their defensive shape to crack under the pressure of chasing the ball.",
  },

  // ── Arsenal ─────────────────────────────────────────────────────────────────
  'Arsenal': {
    about: "Arsenal dominate possession at a league-high 54.6%, dictating the tempo of matches through their 157.9 passes per game at an impressive 78.9% accuracy. Under thapelo, they've built a methodical, possession-heavy system that probes patiently before striking. They generate 3.3 goals per game from 8.4 shots, combining volume with quality. Their defensive approach is intriguing — just 5.5 tackles per game, suggesting they rely more on positioning and pressing to win the ball than traditional tackling. They concede 3.2 goals per game, hinting at a high defensive line that can be exploited, but their attacking output is formidable enough to outscore most opponents.",
    tendencies: [
      "Methodical build-up from the back with 157.9 passes per game — they circulate the ball endlessly, waiting for defensive seams to appear before threading the killer pass",
      "Quality over quantity in chance creation — 8.4 shots per game with 75.8% accuracy, meaning they wait for the right moment rather than firing speculatively",
      "Position-based defending that prioritises interceptions (25.2 per game) over tackles — they read the game well and step into passing lanes",
    ],
    weaknesses: [
      "Arsenal tends to concede 3.2 goals per game with only 5.5 tackles, so attempt to attack them directly through the centre with runners from midfield, because their lack of tackling bite means they struggle to stop dribblers.",
      "Arsenal tends to commit numbers forward in their build-up, so attempt to counter-attack at pace after winning possession in midfield, because their defensive transition leaves spaces behind the full-backs that quick forwards can exploit.",
    ],
    coachNote: "Arsenal under thapelo have a 29W-8D-18L record that reflects their attacking-first philosophy. They will dominate possession at 54.6% — accept this and plan to play without the ball for long stretches. Their vulnerability is the transition moment: when you win the ball, go direct and fast. Their 5.5 tackles per game is among the lowest in the league, so dribbling at their defence yields results. Target the space behind their full-backs when they push forward.",
  },

  // ── Barcelona ────────────────────────────────────────────────────────────────
  'Barcelona': {
    about: "Barcelona have evolved into a physically intense, high-tackle outfit that belies their traditional reputation for pure tiki-taka. They average a league-leading 10.5 tackles per game alongside 30.8 interceptions, turning defence into a weapon. Their 8.2 shots at 78.1% accuracy produce 3.3 goals per game, and they see an even 49.1% possession share. Under sanity, this is a Barcelona side that presses relentlessly, wins the ball in advanced positions, and converts defensive actions into attacking opportunities with frightening efficiency. They concede just 2.5 goals per game, making them a well-rounded contender.",
    tendencies: [
      "Aggressive, high-volume pressing with 10.5 tackles and 30.8 interceptions — they swarm opponents in packs and win possession in dangerous areas",
      "Direct attacking transitions after winning the ball — they don't waste time recycling possession, instead going straight for goal",
      "Compact defensive shape that forces opponents into wide areas before springing the press — they use the touchline as an extra defender",
    ],
    weaknesses: [
      "Barcelona tends to be vulnerable to teams that can play through their press with quick one-touch passing, so attempt to bypass their first line of pressure with direct balls to a target forward, because it takes their midfield pressers out of the game.",
      "Barcelona tends to accumulate fatigue from their high-intensity pressing style, so attempt to conserve energy and increase your attacking intensity after the 70th minute, because their pressing structure loses its sharpness late in games.",
    ],
    coachNote: "Barcelona under sanity (38W-5D-14L) are not the Barcelona of old — they are a pressing juggernaut that wins the ball 10.5 times per game through tackles. Expect relentless pressure in your own half. Your best response: bypass the press with early, direct balls to your forwards. Make them turn and run towards their own goal. And be patient — their intensity fades after 70 minutes, which is when games open up against them.",
  },

  // ── Bayer Leverkusen ────────────────────────────────────────────────────────
  'Bayer Leverkusen': {
    about: "Bayer Leverkusen arrive as another fresh face with no prior managerial data under itumeleng_99. The Bundesliga champions enter Season 3 with reputation alone — no match stats exist to quantify their approach, and their manager's tactical preferences remain unproven at this level. Leverkusen will need to write their own story from the opening whistle, and the lack of scouting data cuts both ways: opponents cannot prepare for a system they haven't seen, but Leverkusen also lack the battle-tested cohesion that comes from a settled tactical identity.",
    tendencies: [
      "Likely to establish a high-intensity pressing game based on their manager's fresh approach — expect committed, aggressive football from the first whistle",
      "Willingness to experiment with formation and personnel as they discover what works — early-season matches will feature tactical fluidity",
      "Fast, vertical attacking patterns — without the refinement of a possession system, direct forward play will be their default mode",
    ],
    weaknesses: [
      "Bayer Leverkusen tends to lack competitive rhythm and match fitness patterns that other teams have established, so attempt to control the tempo early and force them to play at your pace, because their decision-making will deteriorate under unfamiliar pressure.",
      "Bayer Leverkusen tends to be unsettled by teams that defend deep and deny space in behind, so attempt to sit in a compact mid-block and invite them to break you down, because their attacking patterns are unlikely to be fully developed yet.",
    ],
    coachNote: "Bayer Leverkusen under itumeleng_99 are a blank slate — zero historical data, zero tactical patterns to study. Assume they will come out aggressive and eager. Your advantage is that established teams have a rhythm; Leverkusen needs to find theirs. Force them to play at your tempo. Control possession, don't give away cheap transitions, and make them prove they can break down an organised defence for 90 minutes.",
  },

  // ── Bayern Munchen ──────────────────────────────────────────────────────────
  'Bayern Munchen': {
    about: "Bayern Munchen under dot7 play a controlled, possession-oriented game that sees them hold 52% of the ball while completing 74.9% of their 141.7 passes per game. They generate 3.2 goals per match from 8.6 shots with 75.4% shot accuracy, a clinical blend of volume and precision. Defensively they are stout, conceding just 2.0 goals per game behind 6.7 tackles and 27.6 interceptions. This is a Bayern side that values control above chaos — they won't overwhelm you with shot volume like Al Hilal, but they will methodically pick you apart through structured, intelligent attacking patterns.",
    tendencies: [
      "Controlled possession with purpose — 74.9% passing accuracy on 141.7 passes per game, they circulate the ball until gaps appear in the defensive structure",
      "Clinical finishing with 75.4% shot accuracy — they don't take low-percentage chances, instead working the ball into high-quality shooting positions",
      "Balanced defensive approach with 6.7 tackles and 27.6 interceptions — they defend as a unit and transition cleanly from defence to attack",
    ],
    weaknesses: [
      "Bayern Munchen tends to struggle when their passing rhythm is disrupted by high-pressure defending, so attempt to press their midfield aggressively, because their 74.9% accuracy drops significantly under sustained pressure.",
      "Bayern Munchen tends to leave spaces between their lines when their full-backs push forward, so attempt to attack the half-spaces with late midfield runners, because their defensive structure stretches thin when possession is lost in advanced areas.",
    ],
    coachNote: "Bayern Munchen under dot7 bring a 27W-6D-16L record built on controlled, methodical football. They hold 52% possession and convert at 75.4% accuracy — they don't miss. To beat them, you must disrupt their rhythm. Press their midfield, deny them time to pick passes, and attack the half-spaces between centre-back and full-back. Their 2.0 goals conceded is low, so set-piece situations may be your best path to goal.",
  },

  // ── Bournemouth ─────────────────────────────────────────────────────────────
  'Bournemouth': {
    about: "Bournemouth are a possession-heavy side that sees 53.2% of the ball, yet their attacking output is modest at just 1.8 goals from 5.4 shots per game. They complete 77.1% of their passes but struggle to convert possession into genuine threat. Their defensive approach is passive — 5.6 tackles per game and 23.2 interceptions — making them one of the easier teams to play against. Under Focus, Bournemouth control the ball as a defensive mechanism: they'd rather keep it than chase it, but when they lose possession, the backline is frequently exposed, conceding 2.7 goals per game.",
    tendencies: [
      "Ball retention as a defensive strategy — at 53.2% possession they use the ball to limit opponent opportunities rather than create their own",
      "Patient, sideways passing patterns with few penetrative through-balls — they circulate safely but rarely break lines with their distribution",
      "Conservative defensive positioning that prioritises shape over winning the ball — they wait for mistakes rather than forcing them",
    ],
    weaknesses: [
      "Bournemouth tends to produce very little end product from their possession dominance, so attempt to let them have the ball and stay compact, because their 1.8 goals per game from 5.4 shots means they cannot hurt you even with extended spells of control.",
      "Bournemouth tends to concede 2.7 goals per game from only 2.4 saves faced, so attempt to be direct and clinical when you win possession, because their defence will fold under even moderate pressure.",
    ],
    coachNote: "Bournemouth under Focus have a challenging 12W-10D-26L record that reflects their possession-without-penetration style. They will hold the ball at 53.2% but generate just 5.4 shots. Let them pass sideways — it's not hurting you. Your opportunity comes on the turnover: Bournemouth concede 2.7 goals per game and make just 5.6 tackles. Go direct, be clinical, and you'll find the net.",
  },

  // ── Brighton ─────────────────────────────────────────────────────────────────
  'Brighton': {
    about: "Brighton are one of the most possession-dominant sides in the league at 53.9%, completing 77.9% of their 162.8 passes per game — the highest passing volume in the competition. They score 2.8 goals per game from 6.5 shots with 72% accuracy, a controlled and efficient attacking output. Defensively, they are active and aggressive: 9.8 tackles per game and 28.4 interceptions while conceding just 2.4 goals. Under phiwayinkosi, Brighton blend patient build-up with a fierce pressing game, making them a complete, balanced side that is difficult to play through and dangerous in possession.",
    tendencies: [
      "High-volume passing at league-leading 162.8 passes per game — they wear opponents down by making them chase shadows, then exploit the resulting fatigue",
      "Active defensive engagement with 9.8 tackles — they don't wait for mistakes, they force them through coordinated pressing triggers",
      "Wide overloads through 4.3 crosses per game — they stretch the pitch to create isolation opportunities for their wingers against full-backs",
    ],
    weaknesses: [
      "Brighton tends to commit their full-backs high up the pitch, so attempt to counter-attack into the spaces they vacate with pacey wide forwards, because their 28.4 interceptions suggests they win the ball high but leave the backline exposed when bypassed.",
      "Brighton tends to struggle against teams that match their physical intensity in midfield, so attempt to go toe-to-toe in the tackle and disrupt their passing rhythm, because their game relies on midfield control that can be broken by aggression.",
    ],
    coachNote: "Brighton under phiwayinkosi (23W-4D-12L) are the passing kings of the league at 162.8 passes per game. They will dominate the ball and press you relentlessly when you have it. The antidote: go direct to pacey wide forwards when you win possession. Brighton's full-backs push high to support their passing game — exploit the space behind them. And match their physical intensity in midfield — they are not used to teams that hit back as hard as they press.",
  },

  // ── Burnley ─────────────────────────────────────────────────────────────────
  'Burnley': {
    about: "Burnley are a direct, physical side that averages 48.2% possession and 72% passing accuracy on 124.3 passes per game. They generate only 1.8 goals from 5.5 shots but convert at a remarkable 81.3% accuracy — the highest shot accuracy in the league. Defensively, they tackle hard (9.1 per game) but concede 3.2 goals, suggesting their aggression doesn't always translate into defensive solidity. Under anele_arh, Burnley are a side that makes every shot count but gives opponents too many looks at their own goal — a high-risk, scrappy outfit that forces chaotic, physical contests.",
    tendencies: [
      "Clinical finishing with 81.3% shot accuracy — they don't shoot often, but when they do the goalkeeper had better be ready because it's almost certainly on target",
      "Physical, high-tackle defending at 9.1 per game — they make opponents uncomfortable through constant, aggressive challenges",
      "Direct attacking that bypasses midfield — they play forward quickly, prioritising territory over possession and looking to win second balls",
    ],
    weaknesses: [
      "Burnley tends to concede 3.2 goals per game despite making 9.1 tackles, so attempt to move the ball quickly before the tackle arrives, because their aggression leaves gaps when you play one-touch around them.",
      "Burnley tends to struggle against teams that control possession and force them to chase, so attempt to keep the ball and make them work without it, because their high-tackle style leads to fouls and fatigue when they are constantly defending.",
    ],
    coachNote: "Burnley under anele_arh (8W-1D-21L) are fighters — they won't outplay you, but they will outwork you if you let them. They make 9.1 tackles per game and convert an incredible 81.3% of their shots. The danger is letting them get shots off: they rarely miss the target. Your strategy: keep the ball, force them to chase, draw fouls from their aggression, and make them defend for long spells. Their defensive concentration fades under sustained pressure.",
  },

  // ── Chelsea ─────────────────────────────────────────────────────────────────
  'Chelsea': {
    about: "Chelsea under siyethemba_ operate a balanced tactical system with 51.5% possession and 75.6% passing accuracy on 140 passes per game. They produce 2.3 goals from 6.8 shots at 75% accuracy — a measured, controlled attacking output. Defensively they average 7.0 tackles and 28.6 interceptions while conceding 2.8 goals per game. This Chelsea side is defined by moderation: they are not dominant in any single statistical category but are competent across all of them. They are a team that beats you by being slightly better in every phase rather than overwhelming you in any one area.",
    tendencies: [
      "Balanced approach that adapts to the opponent — they can control possession or sit deeper and counter depending on the matchup",
      "Efficient chance creation through 6.8 shots at 75% accuracy — they work the ball into good areas and take high-percentage attempts",
      "Structured defensive shape with 28.6 interceptions — they read the game well and position themselves to cut out danger before it develops",
    ],
    weaknesses: [
      "Chelsea tends to lack a standout statistical weapon that can win a game on its own, so attempt to impose your strongest tactical identity and force them to react, because they are a jack-of-all-trades side that can be beaten by a team that excels at one thing.",
      "Chelsea tends to concede 2.8 goals per game with only 3.2 saves faced, so attempt to be direct and test their goalkeeper early, because their defence allows quality chances that their keeper struggles to stop.",
    ],
    coachNote: "Chelsea under siyethemba_ (14W-6D-19L) are the league's most balanced side — no extreme strengths, no glaring weaknesses. 51.5% possession, 75.6% passing, 2.3 goals scored. They beat you by being competent everywhere. Your counter: pick one thing you do exceptionally well and make that the story of the game. If you have pace, go direct. If you have possession, starve them. Make them respond to your game rather than playing their own.",
  },

  // ── Club Brugge ─────────────────────────────────────────────────────────────
  'Club Brugge': {
    about: "Club Brugge hold 52.6% possession and complete 74.1% of their 112.8 passes per game, generating 2.5 goals from 7.6 shots with 73.6% accuracy. Under mapansela, they play a composed, continental style that values ball retention and measured build-up. Defensively they contribute 7.6 tackles and concede 2.9 goals per game — solid enough to be competitive but not dominant. Brugge are a side that will not beat themselves: they are organised, efficient, and disciplined, forcing opponents to earn every goal through sustained quality rather than capitalising on mistakes.",
    tendencies: [
      "Patient continental build-up with 74.1% passing accuracy — they progress through the thirds methodically, never forcing the play",
      "Quality chance creation with 73.6% shot accuracy — they pick their moments and make them count, firing only when a genuine opening appears",
      "Organised pressing structure with 7.6 tackles per game — they hunt the ball as a unit rather than relying on individual defensive heroics",
    ],
    weaknesses: [
      "Club Brugge tends to struggle against teams that press them high and deny their centre-backs time on the ball, so attempt to implement a coordinated high press against their build-up, because their 112.8 passes per game means they want to play out from the back under controlled conditions.",
      "Club Brugge tends to concede 2.9 goals per game with 25.4 interceptions, so attempt to play quick, direct passes through the centre, because their interception numbers suggest they can be bypassed by speed of thought and execution.",
    ],
    coachNote: "Club Brugge under mapansela (10W-0D-17L) play organized, continental football at 52.6% possession. They will try to control the game through passing, not pressing. Your best response: disrupt their build-up with a high press. Don't let their centre-backs pick passes comfortably. Hurry them into mistakes and convert those turnovers into quick chances. Brugge concede 2.9 per game — you will get opportunities if you force the issue.",
  },

  // ── Como 1907 ───────────────────────────────────────────────────────────────
  'Como 1907': {
    about: "Como 1907 under wandile bring a well-balanced attacking game with 50% possession and 74.9% passing accuracy on 131.5 passes per game. They generate 3.2 goals from 8.6 shots per match, a high-volume attack that mirrors the elite sides in the league. Their 7.3 tackles per game provide a respectable defensive platform, and they concede 2.5 goals — competitive at the back. Como are a side that punches above their historical weight through intelligent tactical organisation and a manager with a proven 36W-8D-11L record from his Tottenham tenure.",
    tendencies: [
      "High shot volume at 8.6 per game with above-average accuracy — they create chances consistently and keep defences under constant pressure",
      "Balanced possession game at 50% — they are comfortable both with and without the ball, adapting their approach to the match situation",
      "Wing-focused attacking through 1.8 crosses per game — they use width to stretch defences and create crossing opportunities",
    ],
    weaknesses: [
      "Como 1907 tends to be caught between two tactical identities, neither possession-dominant nor counter-attacking, so attempt to force them into a game state they are uncomfortable with by taking an early lead, because they struggle when the match script goes against them.",
      "Como 1907 tends to give away 0.6 fouls per game with 27 interceptions, so attempt to dribble at their defence directly, because their reluctance to commit tackles means you can carry the ball into dangerous areas without being stopped.",
    ],
    coachNote: "Como 1907 under wandile (36W-8D-11L at Spurs) are a well-coached, balanced side that generates 3.2 goals from 8.6 shots. They have no obvious statistical weakness but also no defining statistical strength. Your approach: take the initiative early. Force them into chasing the game. Como are structured and efficient when the game is level or they lead, but they lack the high-end quality to turn a deficit around against motivated opposition.",
  },

  // ── Internazionale ─────────────────────────────────────────────────────────
  'Internazionale': {
    about: "Internazionale under ayathaba control 51.5% possession with 75.7% passing accuracy on 141.4 passes per game, producing 2.3 goals from 6.8 shots at 75% efficiency. Their defensive contribution of 6.8 tackles and 28.7 interceptions per game creates a solid, organised foundation. They concede 2.8 goals per game — competitive but not watertight. Internazionale are a system team: everything is structured, everyone knows their role, and they execute consistently. They won't dazzle you with individual brilliance, but they will methodically work through their patterns until the opening appears.",
    tendencies: [
      "Systematic build-up through 141.4 passes at 75.7% accuracy — they value structure over flair, progressing through pre-planned patterns",
      "Patient chance creation that prioritises quality — 6.8 shots at 75% accuracy means every attempt is a calculated decision",
      "Organised defensive shape with 28.7 interceptions — they protect their goal by reading the game and positioning intelligently",
    ],
    weaknesses: [
      "Internazionale tends to struggle against teams that disrupt their structured patterns with unpredictable, high-tempo attacking, so attempt to vary your attacking approach and avoid falling into predictable rhythms, because their defensive system thrives on reading and anticipating.",
      "Internazionale tends to lack the individual brilliance to conjure a goal from nothing, so attempt to stay disciplined and not concede cheap set-pieces or transitions, because if you make them earn every goal through open-play construction, they will find it difficult.",
    ],
    coachNote: "Internazionale under ayathaba (12W-3D-4L) are a system team — 75.7% passing accuracy, 28.7 interceptions, everything by the book. The book is also their weakness. When the game becomes chaotic and unpredictable, their system frays. Your approach: be unpredictable. Vary your tempo, switch play unexpectedly, take shots from unusual positions. Don't let Internazionale settle into their comfortable, structured rhythm — force them out of it and watch their passing accuracy drop.",
  },

  // ── Liverpool ───────────────────────────────────────────────────────────────
  'Liverpool': {
    about: "Liverpool are the league's great contradiction: they complete just 60.1% of their passes (the lowest accuracy in the competition) yet generate 3.3 goals per game from 7.5 shots. Under Thando, this is not the possession-based Liverpool of lore — it is a direct, transition-focused juggernaut that thrives on chaos. They make 10.4 tackles per game (second-highest in the league) and concede 3.1 goals, making every Liverpool match a high-event spectacle. They don't pass to keep the ball; they pass to create danger. Every turnover is an attacking opportunity, and every loose ball is contested ferociously.",
    tendencies: [
      "Direct, vertical attacking with just 60.1% passing accuracy — they prioritise forward progression over possession, accepting turnovers in exchange for goal threat",
      "Ferocious pressing and tackling at 10.4 per game — they hunt the ball relentlessly, making opponents uncomfortable and forcing rushed decisions",
      "High-event, high-scoring matches — they both score and concede freely, meaning any game involving Liverpool will have goals",
    ],
    weaknesses: [
      "Liverpool tends to turn the ball over constantly with only 60.1% passing accuracy, so attempt to press their ball carriers aggressively after a turnover, because their passing breaks down under pressure and creates transition opportunities for you.",
      "Liverpool tends to be so committed to forward transitions that their defensive shape disintegrates, so attempt to counter-attack quickly after winning the ball in midfield, because their players will be caught ahead of the ball with no recovery structure.",
    ],
    coachNote: "Liverpool under Thando (3W-0D-4L) have completely abandoned possession football for pure, unadulterated chaos. They complete just 60.1% of passes — but they score 3.3 goals per game. They will give you the ball constantly. The question is what YOU do with it. Be direct. When Liverpool lose possession (and they will, 40% of the time), they leave massive gaps behind their pressing line. One ball over the top and your forward is through. Don't try to out-pass them — out-run them.",
  },

  // ── Manchester City ─────────────────────────────────────────────────────────
  'Manchester City': {
    about: "Manchester City enter Season 3 as another fresh project under jordan_, with no prior managerial data to analyze. The reigning Premier League champions will look to impose their trademark possession football, but with a new manager and an untested tactical system, their opening matches will be about identity formation rather than execution of a proven plan. City's squad quality is undeniable, but without statistical evidence of how this manager sets them up, they represent both a dangerous unknown and a beatable proposition for organised opponents.",
    tendencies: [
      "Likely to attempt possession-dominant football given City's squad composition — expect high passing volume and attempts to control tempo",
      "Tactical experimentation in the early rounds as the manager finds the right system — formation and personnel changes should be expected",
      "Individual quality as a primary threat — even without a settled system, City's players can produce moments of brilliance",
    ],
    weaknesses: [
      "Manchester City tends to lack the tactical familiarity that comes from an established manager-player relationship, so attempt to exploit communication gaps by pressing their build-up with coordinated triggers, because their passing patterns are unlikely to be fully automatic yet.",
      "Manchester City tends to rely on individual talent rather than collective system in the early stages, so attempt to stay compact and deny space between the lines, because forcing their stars into difficult individual moments is more effective than letting them combine.",
    ],
    coachNote: "Manchester City under jordan_ are an unknown quantity — elite squad, unproven manager. Assume they will try to dominate the ball. Your approach: press their build-up aggressively, test their tactical familiarity, and force them to prove their patterns work under pressure. An early goal would be huge — it forces a team still finding its identity to chase the game, which exposes tactical gaps that a settled side wouldn't have.",
  },

  // ── Manchester United ───────────────────────────────────────────────────────
  'Manchester United': {
    about: "Manchester United arrive under parmalat_ with no prior managerial record, making them another mystery side in Season 3. United's squad is among the most talented in the league, but talent without tactical cohesion is an unreliable asset. Their early-season matches will be about establishing patterns of play and building the confidence that comes from competitive results. Opponents face a familiar dilemma against an untested United: you know the players are dangerous, but you don't know how they will be deployed — an equation that creates both fear and opportunity.",
    tendencies: [
      "High-intensity attacking through individual quality — expect moments of individual brilliance even if the collective structure is developing",
      "Likely to press high and play with intensity as a way to compensate for tactical unfamiliarity — energy can mask system gaps",
      "Flexible approach that will evolve throughout the season — what you scout in Week 1 may look different by Week 5",
    ],
    weaknesses: [
      "Manchester United tends to be vulnerable to well-drilled teams that execute a clear game plan, so attempt to stick to your system and not be drawn into an individual-duel contest, because their players win one-on-one battles but can be beaten by collective organisation.",
      "Manchester United tends to lose defensive shape when chasing the game, so attempt to take an early lead and force them to open up, because their defensive transitions are likely to be the least practiced phase of their developing system.",
    ],
    coachNote: "Manchester United under parmalat_ are a project — elite players, new ideas, zero competitive history together. Take the game to them early. Score first and they will have to chase, which exposes their untested defensive transitions. United's danger comes from individual moments — you can limit those by staying compact and forcing them to construct goals through patterns they haven't mastered yet. Don't give them the space their stars crave.",
  },

  // ── AC Milan ───────────────────────────────────────────────────────────────
  'AC Milan': {
    about: "AC Milan are the league's most direct, defensive-minded side — they complete just 52.9% of their passes, by far the lowest in the competition, yet still generate 3.2 goals per game from 7.2 shots. Under calvin, this is football reduced to its simplest form: win the ball (11.1 tackles per game, league-leading), get it forward quickly, and trust your forwards to finish. They hold 46.8% possession and concede 3.3 goals per game. AC Milan don't care about aesthetics — they care about results, and their approach turns every match into a physical battle where technical quality takes a back seat.",
    tendencies: [
      "Extreme directness with 52.9% passing accuracy — they bypass midfield entirely, playing long balls and fighting for second balls in the final third",
      "League-leading 11.1 tackles per game — they are the most aggressive ball-winners in the competition, making every 50-50 a contested battle",
      "Low-possession, high-impact attacking — 3.2 goals from just 7.2 shots and 46.8% possession, a ruthlessly efficient conversion rate",
    ],
    weaknesses: [
      "AC Milan tends to complete only 52.9% of passes, so attempt to let them have the ball in their own half and press only when they cross midfield, because they will give you possession back constantly through misplaced long balls.",
      "AC Milan tends to commit 11.1 tackles per game but concede 3.3 goals, so attempt to draw their aggressive defenders out of position with off-the-ball movement, because their commitment to the tackle leaves gaps that runners from deep can exploit.",
    ],
    coachNote: "AC Milan under calvin (22W-3D-20L) play the ugliest, most effective football in the league. They complete just 52.9% of passes — but they score 3.2 goals per game. They will tackle you 11.1 times per game. This is pure physical football. Your approach: don't match their physicality, beat it. Move the ball quickly, make them chase, draw fouls in dangerous areas. Every time AC Milan commit a tackle, there's a gap behind them. Find it with quick one-twos and off-the-ball runs.",
  },

  // ── Nantes ──────────────────────────────────────────────────────────────────
  'Nantes': {
    about: "Nantes are a defensive-minded side that averages just 45.1% possession — the lowest in the league — while completing only 65.9% of their passes. They generate a meagre 1.9 goals from 6.2 shots per game, making them one of the least threatening attacking sides. Defensively they are active with 10.0 tackles per game, but they concede a concerning 3.4 goals — the most in the league. Under celemqhele, Nantes try to stay compact and hit on the break, but their inability to keep the ball or prevent goals makes them the team every opponent circles as a must-win fixture.",
    tendencies: [
      "Deep defensive block with 45.1% possession — they concede territory willingly, hoping to frustrate opponents and hit on the counter",
      "Active tackling at 10.0 per game — they commit to challenges and try to make games physical and disjointed",
      "Direct counter-attacking with limited passing accuracy — they go forward quickly when they win possession, accepting low completion rates in exchange for verticality",
    ],
    weaknesses: [
      "Nantes tends to concede a league-worst 3.4 goals per game while making 10.0 tackles, so attempt to attack them with sustained pressure and overlapping runs, because their defence will crack under the weight of repeated attacks regardless of their tackling effort.",
      "Nantes tends to generate only 1.9 goals from 6.2 shots at 45.1% possession, so attempt to control the game through possession and not give them transition moments, because if you deny them counter-attacking opportunities they have no Plan B.",
    ],
    coachNote: "Nantes under celemqhele (16W-4D-30L) are statistically the weakest side in the league. 45.1% possession, 3.4 goals conceded, 1.9 scored. They will sit deep, defend in numbers, and look for counter-attacks. Your approach: be patient. Dominate the ball, move it side to side, and wait for gaps. Nantes cannot defend for 90 minutes — their concentration will break. The goals will come if you don't gift them cheap transitions. Control the game and the result follows.",
  },

  // ── Newcastle United ────────────────────────────────────────────────────────
  'Newcastle United': {
    about: "Newcastle United mirror Burnley's statistical profile almost exactly — 48.2% possession, 72% passing accuracy, 1.8 goals from 5.5 shots with 81.3% shot accuracy. They make 9.1 tackles per game and concede 3.2 goals. Under tildedot, Newcastle are a direct, physical side that prioritises efficiency over volume, making every shot count while engaging in aggressive defensive battles. They are difficult to play against because they make every match an arm-wrestle, but their high concession rate suggests the arm-wrestle can be won if you bring enough firepower.",
    tendencies: [
      "Elite shot conversion at 81.3% accuracy — like Burnley, they make their limited attempts count, so every shot conceded is a genuine threat",
      "Physical, confrontational defending at 9.1 tackles — they want the game to be scrappy and will drag you into a fight",
      "Direct, territory-first football — they don't build from the back, they play forward and compete for second balls",
    ],
    weaknesses: [
      "Newcastle United tends to concede 3.2 goals per game from their aggressive approach, so attempt to move the ball quickly and not let them set their defensive shape, because their tackling numbers come from settled defensive situations — they are vulnerable in transition.",
      "Newcastle United tends to generate only 5.5 shots per game, so attempt to limit their shooting opportunities by cutting off supply into the box, because if you deny them shots you deny them goals entirely given their reliance on conversion efficiency.",
    ],
    coachNote: "Newcastle United under tildedot (9W-2D-12L) are Burnley in black and white — 81.3% shot accuracy, 9.1 tackles, direct, physical football. Every shot they take is dangerous, so limit their attempts by cutting off supply into the box. Defensively they concede 3.2 goals: attack them in transition, move the ball before their tackles arrive, and force them to defend while disorganised. A clean, fast passing game beats their physical approach every time.",
  },

  // ── Palmeiras ───────────────────────────────────────────────────────────────
  'Palmeiras': {
    about: "Palmeiras are a direct, combative side that averages 47.2% possession and 69.6% passing accuracy on 135.2 passes per game. They generate 2.6 goals from 7.1 shots per game and are one of the league's most active tacklers at 9.5 per game. Under s_a, Palmeiras blend South American intensity with direct attacking patterns — they win the ball, get it forward, and fight for every inch. Their 2.6 corners per game suggest set-piece threat, and their 2.7 goals conceded makes them a competitive but beatable defensive unit.",
    tendencies: [
      "South American intensity with 9.5 tackles per game — they play with fire and aggression, treating every duel as a personal battle",
      "Direct forward play at 69.6% passing accuracy — they don't overcomplicate, preferring to get the ball into dangerous areas quickly",
      "Set-piece threat through 2.6 corners per game — they are organised on dead balls and will look to capitalise on any defensive lapse",
    ],
    weaknesses: [
      "Palmeiras tends to run out of ideas against disciplined defences that don't engage in physical battles, so attempt to stay compact, avoid unnecessary fouls, and force them to break you down through passing, because their 69.6% accuracy means they will give the ball back to you.",
      "Palmeiras tends to lose composure when the game doesn't become the physical contest they want, so attempt to keep the ball, move it quickly, and frustrate them into tactical fouls and cards, because their aggression can be weaponised against them.",
    ],
    coachNote: "Palmeiras under s_a (20W-7D-22L) are the league's street fighters — 9.5 tackles, 69.6% passing, constant physical pressure. Don't fight them. Out-play them. Keep the ball, move it around, make them run. Their passing accuracy drops when they're tired and frustrated. Draw their fouls, win set-pieces, and let their aggression become their undoing. Palmeiras beat themselves when the game doesn't match their preferred physical tempo.",
  },

  // ── Paris Saint Germain ─────────────────────────────────────────────────────
  'Paris Saint Germain': {
    about: "PSG are the league's most complete statistical side alongside Al Hilal. Under ghost, they hold 52.5% possession with 75.4% passing accuracy, generate a league-leading 3.4 goals from 9.1 shots per game, and concede just 1.8 goals — the best defensive record in the competition. They average 7.0 tackles, 26.6 interceptions, and face just 1.9 saves per game. This PSG side is a machine: they score freely, defend resolutely, and control matches with a calm authority. Their only potential weakness is an over-reliance on their system functioning perfectly — disrupt one component and the whole machine may stutter.",
    tendencies: [
      "Complete football with 52.5% possession and 75.4% passing — they can dominate the ball or counter-attack with equal proficiency",
      "League-best 1.8 goals conceded behind just 1.9 saves per game — their goalkeeper is the least busy in the league, a testament to their defensive structure",
      "High-volume, high-quality attacking with 3.4 goals from 9.1 shots — they create consistently and convert ruthlessly",
    ],
    weaknesses: [
      "Paris Saint Germain tends to rely on system cohesion rather than individual rescue acts, so attempt to disrupt one specific phase of their game relentlessly — either their build-up OR their press — because if you break one link in their chain, the whole system loses effectiveness.",
      "Paris Saint Germain tends to face only 1.9 saves per game, so attempt to test their goalkeeper early and often, because he may not be match-sharp given how rarely he is called into action.",
    ],
    coachNote: "PSG under ghost (37W-3D-12L) are the gold standard. 3.4 goals scored, 1.8 conceded, 52.5% possession — they are elite in every phase. You cannot beat them by matching them; you beat them by disrupting them. Pick one phase of their game to attack relentlessly. If you press their build-up, commit fully. If you target their defensive line, do it consistently. Their system works because every part supports the others — break one link and you create vulnerabilities that less complete teams wouldn't have.",
  },

  // ── Real Betis ──────────────────────────────────────────────────────────────
  'Real Betis': {
    about: "Real Betis enter Season 3 under grugi with no prior managerial data, making them another unproven quantity. Betis will need to establish their tactical identity quickly in a league full of experienced managers with established systems. The squad has the talent to compete, but talent without a clear plan is merely potential. Opponents facing Betis early in the season will be navigating uncertainty — a double-edged sword that can produce surprises or expose naivety.",
    tendencies: [
      "Likely to adopt a Spanish-style possession approach based on the club's traditional identity — expect short passing and movement between the lines",
      "Eager to impress and establish credibility — high energy and commitment should be expected regardless of tactical sophistication",
      "Flexible from week to week as the manager experiments with what works — don't expect a settled starting XI or formation",
    ],
    weaknesses: [
      "Real Betis tends to lack the competitive reference points that other managers have built over multiple tenures, so attempt to start fast and impose your game immediately, because their players will need time to find their rhythm in a new system.",
      "Real Betis tends to be tactically unproven against high-level opposition, so attempt to test their defensive organisation with varied attacking patterns, because a developing system will have cracks that experienced attacks can find.",
    ],
    coachNote: "Real Betis under grugi are another blank slate with zero historical data. Assume they will try to play possession football given their club identity. Your approach: don't let them settle. Press them high, force early mistakes, score first. A team finding its feet cannot chase games effectively — take the lead and watch their tactical cohesion unravel as they push forward with patterns they haven't fully internalised.",
  },

  // ── Real Madrid ─────────────────────────────────────────────────────────────
  'Real Madrid': {
    about: "Real Madrid under dot play a measured, clinical game with 49.7% possession and an impressive 75.9% passing accuracy on 134.4 passes per game. They score 2.6 goals from 6.9 shots with a remarkable 78.9% shot accuracy — second only to Burnley and Newcastle. Defensively they concede 3.5 goals per game, the highest in the league alongside Nantes, behind 7.1 tackles. This Madrid side is a study in contradictions: they are lethal in front of goal but porous at the back. Every Madrid match promises goals at both ends, making them the most entertaining and unpredictable team in the competition.",
    tendencies: [
      "Clinical finishing at 78.9% shot accuracy — they don't miss, making every Madrid shot a potential goal regardless of distance or angle",
      "Possession with purpose at 75.9% passing accuracy — they build attacks intelligently and pick the right moment to strike",
      "High defensive line that trades solidity for attacking numbers — they concede 3.5 goals per game but accept this as the cost of their attacking output",
    ],
    weaknesses: [
      "Real Madrid tends to concede a league-worst 3.5 goals per game, so attempt to attack them directly and often — do not be cautious — because their defence will inevitably concede chances to any team that commits numbers forward.",
      "Real Madrid tends to leave their centre-backs isolated when the full-backs join the attack, so attempt to counter-attack into the wide spaces with pace, because their defensive recovery structure is among the most vulnerable in the league.",
    ],
    coachNote: "Real Madrid under dot (14W-3D-17L) are the league's great entertainers. 78.9% shot accuracy means every shot is a threat. But they concede 3.5 goals per game — the most in the league. This is the blueprint: attack them. Be brave. Commit numbers forward. Madrid will score against you regardless of how defensive you play, so you might as well try to match them goal for goal. Their defensive line is high and slow to recover — direct balls over the top will create chances all game.",
  },

  // ── Santos ──────────────────────────────────────────────────────────────────
  'Santos': {
    about: "Santos, the legendary Brazilian club, enter Season 3 under branco80ts with no prior competitive data. The club that produced Pele and Neymar brings its tradition of attacking, flair-based football to a league full of European powerhouses. How that tradition translates under a new manager remains to be seen. Santos will likely lean on their cultural identity — creative, skillful, attacking football — but without the statistical evidence to back it up, they are a romantic unknown rather than a known threat.",
    tendencies: [
      "Flair-based attacking football rooted in Brazilian tradition — expect dribbling, skill moves, and creative improvisation in the final third",
      "High-energy, youthful enthusiasm — Santos' identity is built on giving young talents the freedom to express themselves",
      "Offensive over defensive commitment — the Brazilian way rarely prioritises clean sheets over goal-scoring entertainment",
    ],
    weaknesses: [
      "Santos tends to lack the tactical discipline that European competition demands, so attempt to stay organised and hit them on structured counter-attacks, because their commitment to attacking flair leaves defensive gaps that well-drilled sides exploit.",
      "Santos tends to be emotionally volatile — they ride the highs and lows of the game — so attempt to frustrate them early by denying them space and possession, because their heads drop when the samba rhythm is disrupted.",
    ],
    coachNote: "Santos under branco80ts bring Brazilian flair with zero competitive data. Expect skill, dribbling, and attacking ambition. Also expect defensive disorganisation — it comes with the territory. Your approach: be the boring team. Stay compact, frustrate them, deny them the ball. Brazilian sides feed on rhythm and emotion — take both away by controlling possession and tempo. When they push forward in frustration, hit them on the break.",
  },

  // ── Sporting Cp ─────────────────────────────────────────────────────────────
  'Sporting Cp': {
    about: "Sporting Cp are a well-balanced, efficient side that averages 50% possession with 75.5% passing accuracy on 118.4 passes per game. Under Majun_buu, they produce 2.5 goals from 9.1 shots per game — high shot volume that matches the elite attacking sides. Defensively they contribute 7.9 tackles and concede 2.6 goals per game. Sporting are competitive in every statistical category without being dominant in any — a team that wins by being slightly better across the board rather than overwhelming opponents with a single defining strength.",
    tendencies: [
      "High shot volume at 9.1 per game — they create shooting opportunities consistently and keep defences under constant threat",
      "Disciplined ball retention at 75.5% accuracy — they complete their passes and build attacks methodically through the thirds",
      "Active defensive engagement with 7.9 tackles — they contribute defensively and make opponents work for every chance",
    ],
    weaknesses: [
      "Sporting Cp tends to lack a statistical superpower that can decide tight games, so attempt to drag them into a game decided by your own best attribute — if you are fast, make it a track meet; if you are technical, make it a passing contest — because they can be beaten at any style by a team that excels at one thing.",
      "Sporting Cp tends to struggle when their rhythm is broken by extended periods without the ball, so attempt to dominate possession and deny them shooting opportunities for 15-20 minute stretches, because their attacking output depends on steady chance creation rather than moments of magic.",
    ],
    coachNote: "Sporting Cp under Majun_buu (31W-5D-16L) are the league's most balanced side alongside Chelsea. 9.1 shots, 75.5% passing, 2.5 goals — solid everywhere, exceptional nowhere. Your approach: pick your strongest tactical identity and impose it. If you press, press relentlessly. If you counter, counter at pace. Sporting can be beaten by a team that does one thing at an elite level because they do everything at merely a good level.",
  },
}

// ══════════════════════════════════════════════════════════════════════════════
// UPSERT
// ══════════════════════════════════════════════════════════════════════════════

const LEVEL_SCORE: Record<string, Record<string, number>> = {
  'DANGER': { '+++++': 0.82, '++++': 0.67, '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20 },
  'STRONG': { '+++': 0.52, '++': 0.40, '+': 0.29, '-': 0.20 },
  'AVERAGE': { '++': 0.40, '+': 0.29, '-': 0.20, '--': 0.12 },
  'WEAK': { '+': 0.29, '-': 0.20, '--': 0.12, '---': 0.06 },
}

const LEVELS: Record<string, [string, string]> = {
  'Al Hilal':            ['Elite Dominators', '+++++'],
  'Paris Saint Germain': ['Elite Dominators', '+++++'],
  'Brighton':            ['Disciplined Pressers', '++++'],
  'Barcelona':           ['Gegenpressing', '++++'],
  'Bayern Munchen':      ['Technical Dominance', '+++'],
  'Como 1907':           ['Quick Counter', '+++'],
  'Arsenal':             ['Possession with Purpose', '+++'],
  'Internazionale':       ['Disciplined Pressers', '+++'],
  'Sporting Cp':         ['Quick Counter', '++'],
  'Chelsea':             ['Possession with Purpose', '++'],
  'Al Ettifaq':          ['Forward\'s Delight', '++'],
  'Liverpool':           ['Gegenpressing', '++'],
  'AC Milan':             ['The Grinders', '+'],
  'Real Madrid':         ['Shoot-on-Sight', '+'],
  'Palmeiras':           ['Long Ball Counter', '+'],
  'Club Brugge':         ['Possession with Purpose', '+'],
  'Bournemouth':         ['Possession with Purpose', '-'],
  'Burnley':             ['Long Ball Counter', '-'],
  'Newcastle United':    ['Long Ball Counter', '-'],
  'Nantes':              ['Defensive Solidity', '--'],
  'Al Khaleej':          ['Tactical Adaptive', '-'],
  'Bayer Leverkusen':    ['Tactical Adaptive', '-'],
  'Manchester City':     ['Tactical Adaptive', '+'],
  'Manchester United':   ['Tactical Adaptive', '+'],
  'Real Betis':          ['Tactical Adaptive', '-'],
  'Santos':              ['Tactical Adaptive', '-'],
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('=== DRY RUN ===\n')

  const total = TEAM_NAMES.length
  let idx = 0

  for (const teamName of TEAM_NAMES) {
    idx++
    const teamId = TEAMS[teamName]
    const profile = PROFILES[teamName]
        const [primaryProfile, primaryLevel] = LEVELS[teamName] || ['Tactical Adaptive', '-']

        const payload = {
      team_id: teamId,
      primary_profile: primaryProfile,
      primary_level: primaryLevel,
      primary_score: LEVEL_SCORE.DANGER[primaryLevel] ?? LEVEL_SCORE.STRONG[primaryLevel] ?? LEVEL_SCORE.AVERAGE[primaryLevel] ?? LEVEL_SCORE.WEAK[primaryLevel] ?? 0.29,
      primary_about: profile.about,
      primary_tendencies: profile.tendencies,
      primary_weaknesses: profile.weaknesses,
      primary_coach_note: profile.coachNote,
    }

    const action = dryRun ? 'Would upsert' : 'Upserted'
    if (dryRun) {
      console.log(`[${idx}/${total}] ${action}: ${teamName} [${primaryProfile} ${primaryLevel}] | `)
      console.log(`  About: ${profile.about.substring(0, 80)}...`)
      console.log(`  Weakness: ${profile.weaknesses[0].substring(0, 80)}...`)
    } else {
      const { error } = await supabase
        .from('team_dna')
        .upsert(payload, { onConflict: 'team_id' })
      const status = error ? `FAIL: ${error.message}` : 'OK'
      console.log(`[${idx}/${total}] ${teamName.padEnd(22)} ${status}`)
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}${total} playstyles ${dryRun ? 'would be' : ''} written.`)
}

main().catch(console.error)
