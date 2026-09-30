# Sacked clubs keep their identity — managerless-club auto-forfeits (all round types)

## Intro
Follow-up to the vacancy chain in `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`, `.opencode/context/user-based-competitions/vacant-seat-manager-takeover_2026-09-05.md` and `.opencode/context/user-based-competitions/vacant-sweep-misses-unowned-seats_2026-09-29.md`: the user reported that Calvin's Orlando Pirates and Loki's Milford were still holding six active participant seats with a sacked manager's `user_id`, so their opponents were left waiting on results forever. The fix changes what a sack **means** — the club's identity survives, only its ownership is dropped — and the user then corrected the target behaviour after the first pass: future-dated forfeits must be stamped as `confirmed_pending` (an earlier reading of "sched cancel" was a typo).

## Problem

### 1. A sack erased the club, then left unplayable fixtures stranded
`vacateUserSlots()` (`lib/slot-utils.ts`) overwrites the participant's `team_id` with the `custom/vacant` placeholder. Nobody owns that seat, so it can never be played, but `sweep_vacant_slots()` (migration `079_vacant_sweep_unowned_seats.sql`) only decides **past-due** `scheduled` fixtures in the `league` and `group` round types. Three gaps followed:

- Future-dated fixtures were left `scheduled` on purpose — so a manager assigned later would still play them — which meant they simply sat there while the league stalled.
- `r32` (and every other knockout round) was excluded from the sweep entirely, so a managerless club's knockout tie had no path to a result at all.
- The sack routes left the six target seats with a **stale `user_id`**, so even the past-due sweep could not classify them as vacant: they were owned, but the owner could never log in.

### 2. The standings trigger defers future results by round type, not by date alone
`update_standings_after_result()` (migration `065`) checks `scheduled_date::date > CURRENT_DATE` **before** branching on round type, so a future result is parked as `'confirmed_pending'` with standings untouched; `app/api/cron/flip-pending/route.ts` later flips due results, recalculates standings and advances `KO_ROUNDS` progression. Two consequences:

- `scheduled_date` is a Postgres `date`, so the trigger compares against **`CURRENT_DATE` (UTC)**, while the app cron derives its own key via `getSastDateKey()` (UTC+2). Between 00:00 and 02:00 SAST these disagree by a day.
- Which branch actually ran is therefore not knowable from a date comparison in TypeScript.

The first implementation decided "was this confirmed immediately?" with a SAST-vs-UTC date comparison and raced the trigger. It now re-reads `fixtures.status` after the write and trusts only that.

### 3. Reversibility was one-directional
`clearAutoForfeitResults()` existed and matched only the two legacy `Vacant slot absent` / `Both slots vacant` prefixes, so it withdrew the sweep's past-due stamps when a seat was reclaimed. It could not withdraw the new managerless-club stamps — a club that inherited a run of 0-3 results it never played would have kept them.

## Fix

### `forfeitUnmanagedClubSlots(db, clubTeamIds)` — new, in `lib/slot-utils.ts`
Keeps the **real club** on every seat (`team_id` unchanged, `vacated_from_team_id = NULL`) and only drops `user_id`, then auto-decides every remaining eligible fixture:

- Eligibility is `status IN ('scheduled','confirmed_pending')`, `scheduled_date IS NOT NULL`, both `home_participant_id` and `away_participant_id` resolvable. **No round-type filter** — league, group and knockout alike.
- A side is managerless when its participant row has `user_id IS NULL`. Opposing seats are re-read from the DB, so a club sacked earlier in the same season counts as managerless too.
- Scores: managerless home `0-3`, managerless away `3-0`, **both** managerless `0-0`.
- Reasons keep the substrings the trigger needs — `absent` selects the no-show branch (0 GF/GA for the absent side, `absent++`, `-3` GD penalty) and `both` selects the void branch:
  - `Managerless club absent — automatic 0-3`
  - `Managerless club absent — automatic 3-0`
  - `Both clubs managerless and absent — void (0-0)`
- `finalised_by: null`, `is_abandoned: false`, pen scores null — so `abandon_count` is never touched and the live opponent is never flagged absent. Results with `finalised_by` set (human-entered) are skipped, never overwritten.
- Knockout ties that the trigger confirmed **immediately** are advanced with a dynamic `import('@/lib/tournament-progression')` → `advanceWinner()`. Future ones are left to the flip-pending cron.
- Also restores legacy placeholder seats: `vacated_from_team_id` is selected and used as the club fallback when `team_id` is the `custom/vacant` placeholder, and `standings` / `group_standings` / pending `fixtures` rows are restamped from the placeholder back to the real club.

### Reversibility
`AUTO_FORFEIT_REASON_PREFIXES` now lists all four reason prefixes, so `clearAutoForfeitResults()` withdraws both the legacy sweep stamps and the new managerless stamps, restoring any `confirmed_pending` fixture to `scheduled`. It is called from `reclaimManagerSlots()` (`lib/slot-utils.ts`) and from `fillVacantSlot()`. An already-**confirmed** same-day forfeit is deliberately *not* reversible — its result is already in the standings.

### Call sites
Both sack routes the user selected now call the helper instead of `vacateUserSlots()`, and `/api/admin/sack` additionally clears every sibling team row's `manager_ids` (it previously only cleared the one team):

- `app/api/admin/sack/route.ts` (Admin → Users)
- `app/api/admin/managers/sack/route.ts` (Managers page)
- `app/api/admin/finalise-result/route.ts` (`checkAndAutoSack` on a walkover)

The audit log payload field was renamed `vacated_slots` → `forfeits_scheduled`. **Explicit disqualification still uses the placeholder flow** — the user chose to keep only the sack routes club-preserving.

### `scripts/forfeit-managerless-clubs.ts` (new)
Repair/dry-run utility for seats already stranded by an older build. Resolves club sibling team rows by shared logo (as the sack routes do) and accepts repeated `--club` selectors; with no selector it sweeps every managerless real club, so it should be scoped deliberately. Supports `--dry-run`. Verified idempotent — a second run reports the same seat/fixture counts and rewrites nothing.

## Live repair (Orlando Pirates + Milford)

- Calvin `ac6a7b31-1549-4f5b-a229-8b4563da5561` → Orlando Pirates `cf637188-14aa-41ec-a87d-f9f48b30f31b`
- Loki `56b05fa9-6b64-4979-8f5b-f24e2465eb9e` → Milford `13dd28d2-fcb1-4b36-b871-00ab1ca39f92`
- Active tournaments: Betway `18d4f540-0246-42ae-8699-64d13d0a2ae7`, CAF CL `a38a882b-04c7-4264-a1c8-9e84ee1cecf4`, Nedbank `ab37be7d-9882-463a-8011-620af9417ce1`.
- All six seats: `user_id = NULL`, `vacated_from_team_id = NULL`, real club `team_id`, no placeholder rows.
- 70 stamping operations produced **67 distinct** results (3 fixtures are mutual, counted from both clubs): 65 `confirmed_pending` + 2 immediately `confirmed`; 64 × 3-0 forfeits + 3 × 0-0 voids. Split 28 Betway league + 6 CAF group + 1 Nedbank `r32` per club.
- Standings verified correct against the trigger's absentee semantics: the absent side records 0 GF/0 GA, `absent++` and `gd_penalty -= 3` rather than a 0-3 score line, so both clubs read `played 3, losses 1, absent 2, gd_penalty -6` and their GF/GA still reflect only human results.

## Verification
- `npx tsc --noEmit` clean; `npx eslint` clean on every changed file (the remaining `npm run lint` warnings are pre-existing and unrelated).
- **Reverse path proven live**: `clearAutoForfeitResults()` on Orlando's Betway seat removed 27 auto-forfeits, dropped `confirmed_pending` fixtures 65 → 38 (exactly the 27 withdrawn, each reset to `scheduled`), and left the seat reclaimable with the club intact. The 1 result that stayed was the already-confirmed same-day fixture — correct. The state was then restored to 67.
- **Legacy repair proven live**: the Orlando seat was set to the placeholder with `vacated_from_team_id` pointing at the club and its pending results deleted; `forfeitUnmanagedClubSlots()` restored `team_id`, cleared `vacated_from_team_id`, restamped `standings` and re-scheduled 34 forfeits. All assertions passed and the steady state returned to 67 results / 0 placeholder rows.

## Known limits (deliberate)
- Migration `079_vacant_sweep_unowned_seats.sql` is **unchanged** — still past-due `scheduled`, `league`/`group` only. That is now inconsistent with the new "managerless means forfeit everything" model for anyone who nulls a `user_id` directly in the DB rather than via a route: future and knockout fixtures would not be swept. Extending the sweep to knockouts is **not safe in SQL alone**, because advancing a bracket needs `advanceWinner()` from `lib/tournament-progression.ts`, which no `pg_cron` job can call; a KO sweep would have to live in a TypeScript cron.
- Already-confirmed same-day forfeits cannot be withdrawn, since their result is already applied to the standings.

## Restore File Section
`.recycle/` is gitignored (`.gitignore:48`), so these throwaway verification scripts are **not** in the commit; move them back from `.recycle/` to rebuild the checks.

| Original path | Purpose | New path |
| --- | --- | --- |
| `scripts/tmp-verify-reclaim.ts` | Proved the reverse path: withdrew 27 auto-forfeits from Orlando's Betway seat and showed `confirmed_pending` 65 → 38, then the forfeit script restored the 67. | `.recycle/tmp-verify-reclaim_2026-09-30.ts` |
| `scripts/tmp-verify-legacy-repair.ts` | Proved the legacy placeholder repair: broke Orlando's seat onto the `custom/vacant` placeholder with `vacated_from_team_id` set, ran `forfeitUnmanagedClubSlots()`, asserted 6 checks. | `.recycle/tmp-verify-legacy-repair_2026-09-30.ts` |
| `scripts/tmp-legacy-repair.sql` | Abandoned first attempt at the legacy test — plain SQL cannot invoke the TypeScript helper. | `.recycle/tmp-legacy-repair_2026-09-30.sql` |
