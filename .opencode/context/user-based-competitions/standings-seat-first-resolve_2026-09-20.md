# Live standings mixed a club's matches across groups after a qualify/re-add cycle

Fixed `buildLiveStandings` (the live standings engine behind the public `/standings` page, the admin `/admin/standings` page and admin news data) so fixture sides resolve by their **seat (participant)** first instead of by the fixture's snapshot team copy. Previously, when a club like Colombia was disqualified from one group, then a new manager chose the club again and was given a seat in a **different** group, the old group's already-played fixtures (which keep the departed club's team copy) were folded into the club's current group — showing combined stats from both groups. Resolving by seat also makes the league path show exactly the vacant seat's record the incoming club replaces.

## Problem

Live query of the EFA International Cup (`e2c61a3e-072e-4a07-8024-76de20c2a99a`):
- Old seat `3c0d668c-…` (Group B) is now owned by vuyo and shows team **Iran** (`f208b150-…`), but 4 confirmed Group-B fixtures (MD3 vs Morocco 3-10, MD8 vs Argentina 3-3, MD32 vs Tunisia 4-9, MD49 at Morocco 0-3) still carry `home/away_team_id` = **Colombia** (`c61972b2-…`) — confirmed fixtures intentionally keep the club that actually played.
- Current seat `976b1f83-…` (Group H, owned by phiwayinkosi) shows team **Colombia**, so `teamGroupMap['c61972b2-…'] = 'H'`.
- In `lib/standings-core.ts` `buildLiveStandings`, `resolveSide` looked up `teamGroupMap[teamId]` **first**, so every one of those 4 old Group-B Colombia fixtures resolved to group **H** and got applied to Colombia's current Group H row. Live Group H Colombia appeared with P10 / both groups' matches, while the stored `group_standings` table (written by `recalculateStandings` in `lib/standings-engine.ts`, which already resolves participant-first) was correct: Iran/Group B `P6 W1 D1 L4 GF16 GA34`, Colombia/Group H `P6 W1 D0 L3 GF13 GA14`. The league branch had the same copy-keyed flaw (`getRow(f.home_team_id!)` / `getRow(f.away_team_id!)`), which would merge a seat's old history into whatever club happened to share the copy rather than the vacant seat's current club.

## Fix

`lib/standings-core.ts` `buildLiveStandings` only — no DB migration, no data cleanup (stale copies on confirmed fixtures are intentional history).
- **Group branch**: reordered `resolveSide` to resolve by `participantById[participantId]` first (returning the seat's current `team_id`, its own `group_name`, and `teamData`), falling back to the `teamGroupMap[teamId]` team-copy lookup only for legacy fixtures that have no participant id. Mirrors the proven `resolveHome`/`resolveAway` ordering in `recalculateStandings`.
- **League branch**: added the same participant-first `resolveSide` and replaced the copy-keyed `getRow(f.home_team_id!)`/`getRow(f.away_team_id!)` calls with resolved sides, so an incoming club shows exactly the vacant seat's accumulated record (slot-follows-team) rather than blending by team copy.

## Verification

- `npx tsc --noEmit` clean; `npm run lint` only the pre-existing unrelated error.tsx warnings; `npm run build` succeeds.
- Read-only smoke run of `buildLiveStandings` against the International Cup: Group H Colombia = `P6 W1 D0 L3 GF13 GA14 Pts3` (only its own group's matches, exactly one Colombia row, none in any other group); Group B Iran = `P6 W1 D1 L4 GF16 GA34` (inherits the seat's Colombia-era record, matching the stored table); all 8 groups show 4 owned rows, no Unknown/Vacant rows.

## Restore File Section

- `scripts/_tmp_smoke-standings.ts` → moved to `.recycle\_tmp_smoke-standings.ts_2026-09-20.ts` (one-off read-only smoke of `buildLiveStandings` after the fix; restore with `git checkout` if a re-check is ever needed).

## Cross-references

- Stored-engine that already did participant-first resolution (the model this mirrors): `lib/standings-engine.ts`
- Slot model this sits on: `.opencode/context/user-based-competitions/user-slots-model_2026-08-30.md`
- Vacate/refill restamp rules (why confirmed fixtures keep the departed club's copy): `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`
- Colombia seat events investigated live (old Group B seat `3c0d668c-…`, current Group H seat `976b1f83-…`).

## Notes / follow-ups

- No recalc was needed: the stored `standings`/`group_standings` tables were already correct; only the live engine was wrong, and it is the single source for both standings pages via `lib/standings-page.ts` `loadStandingsPageData` plus the admin news generator.