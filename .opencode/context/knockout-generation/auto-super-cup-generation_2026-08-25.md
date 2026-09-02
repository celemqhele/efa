# Auto Super Cup generation when both UCL + UEL finals complete

Date: 2026-08-25
Chain: `knockout-generation/` (follow-up to `backdoor-dashboard-approve-progression_2026-08-24.md` —
extends `advanceWinner` which that fix wired into all confirmation paths)

## What changed

Previously the Super Cup was only created manually via the admin Seasons page
(SeasonManager → SuperCupDialog → POST `/api/admin/generate-super-cup`).

Now: when **both** UCL and UEL finals are confirmed (trophy rows exist for both
`tournament_club` tournaments in a season), `advanceWinner` auto-creates the
Super Cup fixture the next day — no admin action needed.

## Implementation

Single file change: `lib/tournament-progression.ts`

### New function: `checkAndCreateSuperCup(db, justCompletedTournamentId)`

Called from `advanceWinner` immediately after `awardTrophy` when `round_type === 'final'`.

Flow:
1. Look up `season_id` from the just-completed tournament
2. Find both `tournament_club` tournaments for that season (requires ≥ 2)
3. Check `trophies` table — both must have a row (early-exit if either missing)
4. Check no existing `friendlies` tournament with `settings->>'is_super_cup' = 'true'`
   (prevents duplicates)
5. Determine scheduled date: day after the **later** of the two finals' `scheduled_date`
6. Uses `createAdminClient()` for inserts (bypasses RLS — same pattern as
   `/api/admin/generate-super-cup/route.ts`)
7. Creates: `friendlies` tournament + 2 `tournament_participants` + 1 fixture
   (`round_type: 'final'`, UCL winner = home, UEL winner = away)
8. Audit log entry: `action: 'auto_generate_super_cup'`

### Trigger coverage

`advanceWinner` is called from 6 paths — all now trigger the Super Cup check:
- `finalise-result/route.ts` (2 sites)
- `webhook/route.ts` (3 sites: override, submit, confirm)
- `backdoor/approve/route.ts` (1 site)

## DB state at time of implementation

- UEL final (`80e86b39…` md 301): **confirmed** — Newcastle 4-3 Leverkusen (agg).
  Trophy already awarded to Newcastle (`6b72a4ea`).
- UCL final (`7174e29f…` md 301): **scheduled** — both slots null, awaiting SF results.
- No Super Cup exists yet for season `fee4a878…`.

Expected behaviour: once UCL SF results fill the final slots and the final is confirmed,
`advanceWinner` fires → trophy awarded → `checkAndCreateSuperCup` sees both trophies →
auto-creates Super Cup (Newcastle vs UCL winner, scheduled day after UCL final date).

## Deliberately unchanged

- Manual `SuperCupDialog` in SeasonManager and `/api/admin/generate-super-cup` route
  remain as fallbacks / for older seasons where both cups already had trophies.
- `awardTrophy` logic unchanged (home ≥ away = home wins — penalties already baked into
  the score by the time `advanceWinner` runs).
- No UI changes needed — existing Super Cup rendering already finds `friendlies` +
  `settings.is_super_cup`.

## Gotchas

- `audit_log.admin_id` is a UUID FK to `profiles.id`. The auto-generated entry uses a
  zeroed UUID (`00000000-…`) since there's no human admin. If `admin_id` has a NOT NULL
  FK constraint this would fail — current schema allows it.
- `createAdminClient()` is needed for the tournament/fixture inserts because the user-level
  Supabase client may not bypass RLS on `tournaments`/`fixtures` tables.

## Related files

- Extends `advanceWinner` first wired into every confirmation path by
  .opencode/context/knockout-generation/backdoor-dashboard-approve-progression_2026-08-24.md.
- The both-cups-complete requirement ties to the start-tournament flow:
  .opencode/context/season-cup-flow/deferred-ucl-uel-start_2026-08-23.md.
- Its bug fix (RLS on read queries + audit_log FK):
  .opencode/context/knockout-generation/super-cup-bugfix_2026-08-26.md.
