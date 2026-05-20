// Phase 1 match data → SQL seed generator
// Run: node scripts/phase1-seed.js > scripts/phase1-seed.sql

const crypto = require('crypto')

const matches = [
  // Round 1
  ['Fulham', 0, 0, 'Brighton & Hove Albion'],
  ['Tottenham Hotspur', 0, 0, 'Everton'],
  ['Chelsea', 0, 0, 'Crystal Palace'],
  ['Burnley', 3, 2, 'Manchester United'],
  ['Sunderland', 0, 4, 'Aston Villa'],
  ['Manchester City', 0, 0, 'West Ham United'],
  ['Leeds United', 0, 0, 'Brentford'],
  ['Wolverhampton Wanderers', 5, 5, 'Liverpool'],
  ['Nottingham Forest', 3, 2, 'Arsenal'],
  ['Newcastle United', 5, 2, 'Bournemouth'],
  // Round 2
  ['Tottenham Hotspur', 0, 0, 'Fulham'],
  ['Crystal Palace', 0, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 0, 'Burnley'],
  ['Aston Villa', 0, 0, 'Chelsea'],
  ['Manchester United', 0, 0, 'Manchester City'],
  ['Brentford', 0, 0, 'Sunderland'],
  ['West Ham United', 0, 0, 'Wolverhampton Wanderers'],
  ['Arsenal', 2, 2, 'Leeds United'],
  ['Liverpool', 3, 2, 'Newcastle United'],
  // Round 3
  ['Fulham', 0, 0, 'Crystal Palace'],
  ['Burnley', 3, 2, 'Tottenham Hotspur'],
  ['Brighton & Hove Albion', 0, 4, 'Aston Villa'],
  ['Manchester City', 0, 0, 'Everton'],
  ['Chelsea', 0, 0, 'Brentford'],
  ['Wolverhampton Wanderers', 5, 2, 'Manchester United'],
  ['Sunderland', 0, 0, 'Arsenal'],
  ['Newcastle United', 0, 0, 'West Ham United'],
  ['Nottingham Forest', 2, 3, 'Liverpool'],
  // Round 4
  ['Burnley', 0, 0, 'Fulham'],
  ['Aston Villa', 0, 0, 'Crystal Palace'],
  ['Tottenham Hotspur', 0, 0, 'Manchester City'],
  ['Brentford', 0, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 0, 'Wolverhampton Wanderers'],
  ['Arsenal', 0, 0, 'Chelsea'],
  ['Manchester United', 1, 3, 'Newcastle United'],
  ['West Ham United', 0, 0, 'Nottingham Forest'],
  ['Liverpool', 3, 1, 'Leeds United'],
  // Round 5
  ['Fulham', 0, 0, 'Aston Villa'],
  ['Manchester City', 0, 0, 'Burnley'],
  ['Crystal Palace', 0, 0, 'Brentford'],
  ['Wolverhampton Wanderers', 0, 0, 'Tottenham Hotspur'],
  ['Brighton & Hove Albion', 2, 6, 'Arsenal'],
  ['Newcastle United', 0, 0, 'Everton'],
  ['Nottingham Forest', 4, 2, 'Manchester United'],
  ['Sunderland', 0, 0, 'Liverpool'],
  ['Leeds United', 0, 0, 'West Ham United'],
  // Round 6
  ['Manchester City', 0, 0, 'Fulham'],
  ['Brentford', 0, 4, 'Aston Villa'],
  ['Burnley', 4, 1, 'Wolverhampton Wanderers'],
  ['Arsenal', 0, 0, 'Crystal Palace'],
  ['Tottenham Hotspur', 1, 4, 'Newcastle United'],
  ['Everton', 0, 0, 'Nottingham Forest'],
  ['Liverpool', 0, 0, 'Chelsea'],
  ['Manchester United', 1, 5, 'Leeds United'],
  ['West Ham United', 0, 0, 'Sunderland'],
  // Round 7
  ['Fulham', 0, 0, 'Brentford'],
  ['Wolverhampton Wanderers', 0, 0, 'Manchester City'],
  ['Aston Villa', 5, 1, 'Arsenal'],
  ['Nottingham Forest', 7, 4, 'Tottenham Hotspur'],
  ['Brighton & Hove Albion', 0, 0, 'Liverpool'],
  ['Leeds United', 3, 1, 'Everton'],
  ['Chelsea', 0, 0, 'West Ham United'],
  ['Sunderland', 0, 0, 'Manchester United'],
  // Round 8
  ['Wolverhampton Wanderers', 0, 0, 'Fulham'],
  ['Arsenal', 4, 1, 'Brentford'],
  ['Manchester City', 1, 4, 'Newcastle United'],
  ['Burnley', 3, 2, 'Nottingham Forest'],
  ['Liverpool', 0, 0, 'Crystal Palace'],
  ['Tottenham Hotspur', 0, 2, 'Leeds United'],
  ['West Ham United', 0, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 0, 'Sunderland'],
  ['Manchester United', 1, 7, 'Chelsea'],
  // Round 9
  ['Fulham', 0, 0, 'Arsenal'],
  ['Nottingham Forest', 4, 3, 'Manchester City'],
  ['Aston Villa', 5, 2, 'Liverpool'],
  ['Leeds United', 3, 6, 'Burnley'],
  ['Crystal Palace', 0, 0, 'West Ham United'],
  ['Brighton & Hove Albion', 0, 0, 'Manchester United'],
  ['Chelsea', 0, 0, 'Everton'],
  // Round 10
  ['Wolverhampton Wanderers', 0, 0, 'Nottingham Forest'],
  ['Liverpool', 7, 1, 'Brentford'],
  ['Manchester City', 4, 3, 'Leeds United'],
  ['Burnley', 0, 0, 'Sunderland'],
  ['Manchester United', 0, 0, 'Crystal Palace'],
  ['Everton', 0, 0, 'Brighton & Hove Albion'],
  // Round 11
  ['Arsenal', 3, 4, 'Liverpool'],
  ['Brentford', 0, 0, 'West Ham United'],
  ['Sunderland', 0, 0, 'Manchester City'],
  ['Aston Villa', 4, 1, 'Manchester United'],
  ['Chelsea', 2, 3, 'Burnley'],
  ['Crystal Palace', 0, 0, 'Everton'],
  ['West Ham United', 0, 0, 'Aston Villa'],
  // Round 12
  ['Nottingham Forest', 0, 0, 'Fulham'],
  ['West Ham United', 0, 0, 'Arsenal'],
  ['Wolverhampton Wanderers', 0, 0, 'Sunderland'],
  ['Manchester United', 1, 1, 'Brentford'],
  ['Manchester City', 4, 4, 'Chelsea'],
  ['Everton', 0, 0, 'Aston Villa'],
  ['Burnley', 7, 0, 'Brighton & Hove Albion'],
  // Round 13
  ['Fulham', 0, 0, 'Liverpool'],
  ['Crystal Palace', 0, 0, 'Burnley'],
  ['Aston Villa', 5, 2, 'Tottenham Hotspur'],
  ['Manchester City', 0, 0, 'Brighton & Hove Albion'],
  ['Brentford', 0, 0, 'Everton'],
  ['West Ham United', 0, 0, 'Manchester United'],
  ['Arsenal', 4, 4, 'Wolverhampton Wanderers'],
  ['Newcastle United', 4, 2, 'Nottingham Forest'],
  ['Bournemouth', 2, 0, 'Sunderland'],
  // Round 14
  ['Burnley', 2, 4, 'Aston Villa'],
  ['Liverpool', 3, 1, 'Manchester City'],
  ['Tottenham Hotspur', 0, 0, 'Brentford'],
  ['Brighton & Hove Albion', 0, 0, 'West Ham United'],
  ['Everton', 0, 0, 'Arsenal'],
  ['Wolverhampton Wanderers', 0, 0, 'Crystal Palace'],
  ['Nottingham Forest', 4, 0, 'Fulham'],
  ['Sunderland', 0, 0, 'Leeds United'],
  // Round 15
  ['Fulham', 0, 0, 'Manchester United'],
  ['Aston Villa', 4, 1, 'Wolverhampton Wanderers'],
  ['Brentford', 0, 2, 'Burnley'],
  ['West Ham United', 0, 0, 'Liverpool'],
  ['Arsenal', 4, 1, 'Tottenham Hotspur'],
  ['Crystal Palace', 0, 0, 'Leeds United'],
  ['Chelsea', 0, 0, 'Sunderland'],
  // Round 16
  ['Wolverhampton Wanderers', 0, 0, 'Brentford'],
  ['Nottingham Forest', 4, 0, 'West Ham United'],
  ['Liverpool', 3, 4, 'Newcastle United'],
  ['Tottenham Hotspur', 0, 0, 'Crystal Palace'],
  ['Brighton & Hove Albion', 0, 0, 'Fulham'],
  ['Leeds United', 1, 5, 'Aston Villa'],
  ['Sunderland', 0, 0, 'Everton'],
  ['Bournemouth', 2, 2, 'Chelsea'],
  // Round 17
  ['Fulham', 0, 3, 'Liverpool'],
  ['Brentford', 0, 3, 'Leeds United'],
  ['West Ham United', 0, 1, 'Newcastle United'],
  ['Crystal Palace', 0, 4, 'Aston Villa'],
  ['Chelsea', 0, 0, 'Tottenham Hotspur'],
  ['Everton', 0, 2, 'Manchester United'],
  ['Wolverhampton Wanderers', 0, 0, 'Bournemouth'],
  // Round 18
  ['Liverpool', 3, 0, 'West Ham United'],
  ['Brighton & Hove Albion', 0, 0, 'Everton'],
  ['Newcastle United', 4, 0, 'Fulham'],
  ['Leeds United', 3, 1, 'Wolverhampton Wanderers'],
  ['Tottenham Hotspur', 0, 3, 'Burnley'],
  ['Bournemouth', 2, 0, 'Crystal Palace'],
  // Round 19
  ['Fulham', 0, 0, 'West Ham United'],
  ['Everton', 0, 3, 'Liverpool'],
  ['Brentford', 0, 0, 'Crystal Palace'],
  ['Chelsea', 0, 2, 'Brighton & Hove Albion'],
  ['Sunderland', 0, 4, 'Nottingham Forest'],
  ['Arsenal', 4, 1, 'Manchester United'],
  // Round 20
  ['Nottingham Forest', 4, 1, 'Arsenal'],
  ['West Ham United', 0, 4, 'Manchester City'],
  ['Crystal Palace', 0, 0, 'Chelsea'],
  ['Aston Villa', 4, 0, 'Sunderland'],
  ['Liverpool', 3, 0, 'Wolverhampton Wanderers'],
  ['Manchester United', 1, 3, 'Burnley'],
  ['Brighton & Hove Albion', 0, 0, 'Fulham'],
  ['Everton', 0, 0, 'Tottenham Hotspur'],
  ['Brentford', 0, 2, 'Leeds United'],
  // Round 21
  ['Fulham', 0, 0, 'Tottenham Hotspur'],
  ['Manchester City', 4, 1, 'Manchester United'],
  ['Chelsea', 0, 4, 'Aston Villa'],
  ['Brighton & Hove Albion', 0, 0, 'Crystal Palace'],
  ['Wolverhampton Wanderers', 0, 0, 'West Ham United'],
  ['Leeds United', 1, 4, 'Arsenal'],
  ['Burnley', 3, 0, 'Everton'],
  ['Sunderland', 0, 0, 'Brentford'],
  ['Newcastle United', 4, 3, 'Liverpool'],
  // Round 22
  ['Crystal Palace', 0, 0, 'Fulham'],
  ['Aston Villa', 4, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 4, 'Manchester City'],
  ['Brentford', 0, 0, 'Chelsea'],
  ['Manchester United', 1, 4, 'Wolverhampton Wanderers'],
  ['Arsenal', 4, 0, 'Sunderland'],
  ['Liverpool', 3, 2, 'Nottingham Forest'],
  // Round 23
  ['Fulham', 0, 3, 'Burnley'],
  ['Manchester City', 4, 0, 'Tottenham Hotspur'],
  ['Brighton & Hove Albion', 0, 0, 'Brentford'],
  ['Wolverhampton Wanderers', 0, 0, 'Everton'],
  ['Chelsea', 0, 4, 'Arsenal'],
  ['Newcastle United', 4, 1, 'Manchester United'],
  ['Nottingham Forest', 4, 0, 'West Ham United'],
  ['Leeds United', 1, 3, 'Liverpool'],
  // Round 24
  ['Aston Villa', 4, 0, 'Fulham'],
  ['Burnley', 3, 4, 'Manchester City'],
  ['Brentford', 0, 0, 'Crystal Palace'],
  ['Tottenham Hotspur', 0, 0, 'Wolverhampton Wanderers'],
  ['Arsenal', 4, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 4, 'Newcastle United'],
  ['Manchester United', 1, 4, 'Nottingham Forest'],
  ['Liverpool', 3, 0, 'Sunderland'],
  ['West Ham United', 0, 1, 'Leeds United'],
  // Round 25
  ['Fulham', 0, 4, 'Manchester City'],
  ['Wolverhampton Wanderers', 0, 3, 'Burnley'],
  ['Crystal Palace', 0, 4, 'Arsenal'],
  ['Newcastle United', 4, 0, 'Tottenham Hotspur'],
  ['Chelsea', 0, 3, 'Liverpool'],
  ['Leeds United', 3, 1, 'Manchester United'],
  // Round 26
  ['Brentford', 0, 0, 'Fulham'],
  ['Manchester City', 4, 0, 'Wolverhampton Wanderers'],
  ['Arsenal', 2, 4, 'Aston Villa'],
  ['Tottenham Hotspur', 0, 4, 'Nottingham Forest'],
  ['Liverpool', 3, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 2, 'Leeds United'],
  ['West Ham United', 0, 0, 'Chelsea'],
  // Round 27
  ['Fulham', 0, 0, 'Wolverhampton Wanderers'],
  ['Brentford', 0, 4, 'Arsenal'],
  ['Newcastle United', 4, 1, 'Manchester City'],
  ['Nottingham Forest', 2, 3, 'Burnley'],
  ['Crystal Palace', 0, 3, 'Liverpool'],
  ['Leeds United', 3, 0, 'Tottenham Hotspur'],
  ['Brighton & Hove Albion', 0, 0, 'West Ham United'],
  ['Sunderland', 0, 0, 'Everton'],
  // Round 28
  ['Brentford', 0, 4, 'Manchester City'],
  ['Burnley', 3, 0, 'Wolverhampton Wanderers'],
  ['Liverpool', 3, 0, 'Chelsea'],
  ['Brighton & Hove Albion', 0, 4, 'Newcastle United'],
  // Round 29
  ['Wolverhampton Wanderers', 0, 4, 'Manchester City'],
  ['Aston Villa', 4, 2, 'Arsenal'],
  ['Everton', 0, 3, 'Leeds United'],
  // Round 30
  ['Arsenal', 4, 0, 'Fulham'],
  ['Liverpool', 3, 4, 'Aston Villa'],
  ['Burnley', 3, 1, 'Leeds United'],
  ['West Ham United', 0, 0, 'Crystal Palace'],
  ['Manchester United', 1, 0, 'Brighton & Hove Albion'],
  ['Everton', 0, 0, 'Chelsea'],
  // Round 31
  ['Wolverhampton Wanderers', 0, 4, 'Nottingham Forest'],
  ['Brentford', 0, 3, 'Liverpool'],
  ['Leeds United', 1, 4, 'Manchester City'],
  ['Sunderland', 0, 3, 'Burnley'],
  ['Crystal Palace', 0, 1, 'Manchester United'],
  // Round 32
  ['Arsenal', 4, 0, 'Brentford'],
  ['Manchester City', 4, 4, 'Newcastle United'],
  ['Burnley', 3, 2, 'Nottingham Forest'],
  ['Liverpool', 3, 0, 'Crystal Palace'],
  ['Tottenham Hotspur', 0, 3, 'Leeds United'],
  ['West Ham United', 0, 0, 'Brighton & Hove Albion'],
  ['Manchester United', 1, 0, 'Chelsea'],
  // Round 33
  ['Fulham', 0, 4, 'Newcastle United'],
  ['Brentford', 0, 4, 'Aston Villa'],
  ['Wolverhampton Wanderers', 0, 3, 'Leeds United'],
  ['Chelsea', 0, 1, 'Manchester United'],
  // Round 34
  ['West Ham United', 0, 0, 'Fulham'],
  ['Liverpool', 3, 0, 'Everton'],
  ['Crystal Palace', 0, 0, 'Brentford'],
  ['Newcastle United', 4, 1, 'Manchester City'],
  ['Brighton & Hove Albion', 0, 0, 'Chelsea'],
  ['Aston Villa', 4, 0, 'Wolverhampton Wanderers'],
  ['Leeds United', 1, 3, 'Burnley'],
  ['Nottingham Forest', 4, 0, 'Sunderland'],
  ['Manchester United', 1, 4, 'Arsenal'],
  // Round 35
  ['Aston Villa', 4, 0, 'Manchester City'],
  ['Newcastle United', 4, 1, 'Burnley'],
  ['Leeds United', 3, 1, 'Nottingham Forest'],
  ['Chelsea', 0, 0, 'Fulham'],
  ['Tottenham Hotspur', 0, 0, 'Brighton & Hove Albion'],
  // Round 36
  ['Arsenal', 2, 4, 'Newcastle United'],
  ['Nottingham Forest', 2, 4, 'Aston Villa'],
  ['Manchester City', 4, 1, 'Liverpool'],
  ['Fulham', 0, 0, 'Everton'],
  ['Sunderland', 0, 0, 'Crystal Palace'],
  // Round 37
  ['Liverpool', 3, 2, 'Arsenal'],
  ['Aston Villa', 4, 2, 'Newcastle United'],
  ['Chelsea', 0, 0, 'Wolverhampton Wanderers'],
  ['Brentford', 0, 0, 'Manchester United'],
  ['Brighton & Hove Albion', 0, 3, 'Burnley'],
  // Round 38
  ['Newcastle United', 4, 2, 'Aston Villa'],
  ['Burnley', 3, 4, 'Liverpool'],
  ['Arsenal', 4, 2, 'Manchester City'],
  ['Tottenham Hotspur', 0, 0, 'Chelsea'],
  ['Manchester United', 1, 0, 'Everton'],
]

// Only count matches where goals were actually scored (0-0 = abandoned/walkover)
const realMatches = matches.filter(([, hs, as]) => hs + as > 0)

// Compute standings
const standings = {}
for (const [home, hs, as, away] of realMatches) {
  if (!standings[home]) standings[home] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
  if (!standings[away]) standings[away] = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }

  standings[home].played++
  standings[away].played++
  standings[home].gf += hs
  standings[home].ga += as
  standings[away].gf += as
  standings[away].ga += hs

  if (hs > as) {
    standings[home].wins++
    standings[away].losses++
  } else if (hs < as) {
    standings[away].wins++
    standings[home].losses++
  } else {
    standings[home].draws++
    standings[away].draws++
  }
}

// Sort by points desc
const sorted = Object.entries(standings)
  .map(([team, s]) => ({ team, ...s, points: s.wins * 3 + s.draws }))
  .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga))

// Print table to stderr for review
process.stderr.write('\nPhase 1 Final Standings:\n')
process.stderr.write('Pos | Team                     | P  | W  | D  | L  | GF | GA | GD  | Pts\n')
process.stderr.write('-'.repeat(80) + '\n')
sorted.forEach((s, i) => {
  const gd = s.gf - s.ga
  process.stderr.write(
    `${String(i+1).padStart(3)} | ${s.team.padEnd(24)} | ${String(s.played).padStart(2)} | ${String(s.wins).padStart(2)} | ${String(s.draws).padStart(2)} | ${String(s.losses).padStart(2)} | ${String(s.gf).padStart(2)} | ${String(s.ga).padStart(2)} | ${String(gd).padStart(3)} | ${s.points}\n`
  )
})

// Generate SQL
const seasonId = crypto.randomUUID()
const tournamentId = crypto.randomUUID()

let sql = `-- ============================================================
-- EFA Phase 1 Seed Data
-- Generated from 38 rounds of match results
-- Run in Supabase SQL Editor
-- NOTE: adjust team names below if they differ from your teams table
-- ============================================================

-- 1. Create Phase 1 season
INSERT INTO seasons (id, name, base_league, status, start_date, end_date)
VALUES (
  '${seasonId}',
  'EFA Phase 1',
  'Premier League',
  'completed',
  '2024-09-01',
  '2025-06-30'
);

-- 2. Create Phase 1 tournament
INSERT INTO tournaments (id, season_id, name, type, status)
VALUES (
  '${tournamentId}',
  '${seasonId}',
  'Phase 1 League',
  'league',
  'completed'
);

-- 3. Insert standings (looked up by team name)
-- If a team name doesn't match your teams table exactly, edit it below.
`

for (const s of sorted) {
  const gd = s.gf - s.ga
  sql += `
INSERT INTO standings (tournament_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
SELECT
  '${tournamentId}',
  id,
  ${s.played}, ${s.wins}, ${s.draws}, ${s.losses}, ${s.gf}, ${s.ga}, ${s.points}
FROM teams WHERE name = '${s.team}'
ON CONFLICT (tournament_id, team_id) DO UPDATE SET
  played = EXCLUDED.played,
  wins = EXCLUDED.wins,
  draws = EXCLUDED.draws,
  losses = EXCLUDED.losses,
  goals_for = EXCLUDED.goals_for,
  goals_against = EXCLUDED.goals_against,
  points = EXCLUDED.points;
-- ${s.team}: P${s.played} W${s.wins} D${s.draws} L${s.losses} GF${s.gf} GA${s.ga} GD${gd > 0 ? '+' : ''}${gd} Pts${s.points}
`
}

sql += `
-- ============================================================
-- Verify: check how many standings rows were inserted
-- SELECT t.name, s.played, s.wins, s.draws, s.losses, s.goals_for, s.goals_against, s.points
-- FROM standings s JOIN teams t ON t.id = s.team_id
-- WHERE s.tournament_id = '${tournamentId}'
-- ORDER BY s.points DESC;
-- ============================================================
`

process.stdout.write(sql)
