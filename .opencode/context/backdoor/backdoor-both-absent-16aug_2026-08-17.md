# Backdoor Both-Absent — 21 fixtures on 16 Aug (both sides absent, 0–0)

## Problem
All fixtures scheduled for 2026-08-16 were unplayed (both teams absent). Needed "both teams absent" backdoor results (0–0, no points for either side) applied to 21 fixtures across 3 tournaments.

## Fix
One-off script `scripts/backdoor-both-absent-16aug.ts` (re-run safe) applying 0–0 backdoor results to all 21 scheduled fixtures on 2026-08-16, mirroring the WhatsApp admin backdoor flow (`handleBackdoorSide`) + the direct result-submit pattern used in `scripts/backdoor-mci-loss-15aug.ts`.

### Fixtures processed (21 total)

| Fixture | Matchday | Home | Away | Tournament |
|---------|----------|------|------|------------|
| `96b1b0e5` | 1 | Real Betis | Real Madrid | EFA Europa League (`80e86b39-...`) |
| `c9e4e20d` | 3 | Inter Milan | Manchester United | EFA Europa League |
| `1a8287be` | 3 | Arsenal | Bournemouth | EFA Champions League (`7174e29f-...`) |
| `84d618ac` | 4 | Arsenal | AC Milan | EFA Champions League |
| `5866b97e` | 5 | Liverpool | Manchester United | EFA Europa League |
| `eaa28a8a` | 12 | Manchester United | Liverpool | EFA Europa League |
| `bb6aa480` | 14 | Manchester United | Inter Milan | EFA Europa League |
| `c719fd39` | 14 | Barcelona | Brighton & Hove Albion | EFA Champions League |
| `abaedab1` | 15 | Inter Milan | Liverpool | EFA Europa League |
| `48fec65b` | 16 | AC Milan | Arsenal | EFA Champions League |
| `4798e81c` | 25 | Real Betis | Al Khaleej | EFA Europa League |
| `69ffe813` | 27 | Real Madrid | Al Khaleej | EFA Europa League |
| `01d06f85` | 39 | Bournemouth | Arsenal | EFA Champions League |
| `32363ee9` | 43 | Arsenal | Club Brugge | EFA Champions League |
| `d56ad0e7` | 44 | Club Brugge | Bournemouth | EFA Champions League |
| `b2ef19b5` | 47 | AC Milan | Bournemouth | EFA Champions League |
| `f1e32e85` | 612 | Arsenal | Al Khaleej | EFA Premier League (`35adbc8e-...`) |
| `29a341fa` | 629 | Inter Milan | Real Betis | EFA Premier League |
| `cddf9892` | 635 | Al Khaleej | Arsenal | EFA Premier League |
| `7868a991` | 639 | Al Khaleej | Manchester United | EFA Premier League |
| `81ace9cd` | 646 | Real Madrid | Al Khaleej | EFA Premier League |

### Per fixture the script:
- Upserts the result (`home_score: 0, away_score: 0, is_abandoned: false, finalised_by: celemqhele`, `override_reason: 'Both teams absent — result void (0–0, no points)'`), which fires `on_result_insert` (updates `group_standings`; group fixtures need the explicit status update)
- Sets fixture status to `confirmed`
- Voids pending `backdoor_submissions` (`void_game_played`)
- Inserts `result_confirmed` notifications for both managers
- Writes an `audit_log` `finalise_result` entry with `home_absent: true, away_absent: true`

### Standings recalculation
Calls `recalculateStandings()` for all 3 affected tournaments:
- **EFA Europa League** (`80e86b39-...`): group tournament — 10 group rows written, 40 fixtures processed
- **EFA Champions League** (`7174e29f-...`): group tournament — 16 group rows written, 48 fixtures processed
- **EFA Premier League** (`35adbc8e-...`): league tournament — 26 standings rows written, 650 fixtures processed

All 21 fixtures verified `confirmed` with 0–0 result.

## Related files
This is part of the one-off backdoor script family mirroring the WhatsApp admin backdoor flow (`handleBackdoorSide`) and the direct result-submit pattern:
- `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md` — the `isOverride` mechanism used here.
- `.opencode/context/backdoor/backdoor-mci-loss_2026-08-15.md` — Man City absent walkover losses (same direct-submit pattern referenced in the Fix above).
- `.opencode/context/backdoor/backdoor-psg-chelsea-override_2026-08-15.md` — override a confirmed result (PSG vs Chelsea).
- `.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md` — reverse Real Betis's mistaken loss into a win.
- `.opencode/context/backdoor/backdoor-side-inversion_2026-08-16.md` — correct the `side_claimed`-inverted results.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |