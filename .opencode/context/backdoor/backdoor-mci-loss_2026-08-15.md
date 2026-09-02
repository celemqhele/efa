# Backdoor Losses — Man City absent (15 Aug)

## Problem
Manchester City was absent on 2026-08-15, so its unplayed fixtures that day needed
"backdoor" 3-0 walkover losses recorded.

## Fix
One-off script `scripts/backdoor-mci-loss-15aug.ts` (re-run safe) applying 3-0
backdoor losses to the 3 fixtures on 2026-08-15 that were still `scheduled`,
mirroring the WhatsApp admin backdoor flow (`handleBackdoorSide`):

| Fixture | Matchday | Result |
|---------|----------|--------|
| `33af4c21` | 33 | Chelsea 3-0 Manchester City |
| `f82c3583` | 42 | Paris Saint Germain 3-0 Manchester City |
| `69cd36a9` | 37 | Manchester City 0-3 Chelsea |

Per fixture the script:
- Upserts the result (`is_abandoned = false`, `finalised_by = celemqhele`), which
  fires `on_result_insert` (updates `group_standings`; group fixtures need the
  explicit status update).
- Sets fixture status to `confirmed`.
- Voids pending `backdoor_submissions` (`void_game_played`).
- Inserts `result_confirmed` notifications for both managers.
- Writes an `audit_log` `finalise_result` entry with `home_absent`/`away_absent`.

Then calls `recalculateStandings(tournament_id)` for the EFA Champions League
(`7174e29f-...`). Group standings rebuilt (16 rows).

## Notes / Gotchas
- The standings engine's `createAdminClient()` needs `NEXT_PUBLIC_SUPABASE_URL` set —
  the script sets it from the service-role config before importing the engine
  (same pattern as `scripts/fix-psg-mci-result.ts`).
- The 2 Sporting Cp fixtures on the same date were already `confirmed`
  (Man City 0-4 / 0-8) and were intentionally left untouched.

## Related files
This is one of several one-off backdoor scripts mirroring the WhatsApp admin backdoor flow:
- `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md` — the `handleBackdoorSide` / `isOverride` mechanism this script mirrors.
- `.opencode/context/backdoor/backdoor-psg-chelsea-override_2026-08-15.md` — override a confirmed result (PSG vs Chelsea).
- `.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md` — reverse Real Betis's mistaken loss into a win.
- `.opencode/context/backdoor/backdoor-side-inversion_2026-08-16.md` — correct the `side_claimed`-inverted results.
- `.opencode/context/backdoor/backdoor-both-absent-16aug_2026-08-17.md` — 0-0 both-absent results on 16 Aug.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
