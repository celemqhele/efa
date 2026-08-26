# Auto Super Cup generation when both UCL + UEL finals complete

Date: 2026-08-26
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
6. Uses `createAdminClient()` for all operations (bypasses RLS — same pattern as
   `/api/admin/generate-super-cup/route.ts`)
7. Creates: `friendlies` tournament + 2 `tournament_participants` + 1 fixture
   (`round_type: 'final'`, UCL winner = home, UEL winner = away)
8. Audit log entry: `action: 'auto_generate_super_cup'`

### Trigger coverage

`advanceWinner` is called from 6 paths — all now trigger the Super Cup check:
- `finalise-result/route.ts` (2 sites)
- `webhook/route.ts` (3 sites: override, submit, confirm)
- `backdoor/approve/route.ts` (1 site)

## Bug fix (2026-08-26)

### Problem

Super Cup was NOT auto-generated when Season 3 UCL + UEL finals were both confirmed.
Two bugs were identified:

1. **RLS on read queries**: `checkAndCreateSuperCup` used the passed `db` parameter for
   all read queries (tournaments, trophies, fixtures). When called from the webhook path,
   `db` is the **user-level** Supabase client which may fail RLS on these tables — the
   function would silently return early without creating anything.

2. **FK violation on audit_log**: The function used a zeroed UUID
   (`00000000-0000-0000-0000-000000000000`) for `audit_log.admin_id`. The `audit_log`
   table has a foreign key constraint to `profiles.id`, so this insert would always throw —
   even if the read queries succeeded, the audit_log insert would error (though the super
   cup tournament + fixture would already be committed by then).

### Fix

- Moved `createAdminClient()` to the top of the function and used it for **all** queries
  (reads + writes), not just the inserts.
- Audit log now looks up a real admin profile ID instead of the zeroed UUID.

### Manual Season 3 super cup

Created via SQL since the auto-generation failed:
- Tournament: `22cf1094-3dbc-4b83-a345-32174bf4e880`
- UCL winner (home): `01c6d980-895e-4b03-a66b-7db481b3b8d2`
- UEL winner (away): `6b72a4ea-f2e3-4228-8e6b-afffd3e9d1cc`
- Scheduled: 2026-08-26

## DB state at time of initial implementation (2026-08-25)

- UEL final (`80e86b39…` md 301): **confirmed** — Newcastle 4-3 Leverkusen (agg).
  Trophy awarded to Newcastle (`6b72a4ea`).
- UCL final (`7174e29f…` md 301): **confirmed** — trophy awarded to `01c6d980`.
- No Super Cup existed yet for season `fee4a878…` → created manually after fix.

## Deliberately unchanged

- Manual `SuperCupDialog` in SeasonManager and `/api/admin/generate-super-cup` route
  remain as fallbacks / for older seasons where both cups already had trophies.
- `awardTrophy` logic unchanged (home ≥ away = home wins — penalties already baked into
  the score by the time `advanceWinner` runs).
- No UI changes needed — existing Super Cup rendering already finds `friendlies` +
  `settings.is_super_cup`.

## Restore file section

- Original path: `.opencode/context/knockout-generation/auto-super-cup-generation_2026-08-25.md`
- Purpose: Context file documenting the auto super cup generation feature (initial implementation)
- New path: `.recycle/auto-super-cup-generation_2026-08-25.md`
- Reason for move: Renamed to 2026-08-26 after substantial edit on new date
