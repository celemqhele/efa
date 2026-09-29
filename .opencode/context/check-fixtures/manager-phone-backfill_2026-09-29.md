# Season 4 manager phone backfill for WhatsApp groups

## Intro
Follow-up to the WhatsApp phone-update flow in `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`: while assembling the Div 1 / Div 2 WhatsApp group invite lists from the Season 4 participants, three managers turned out to have no number on file, and the user supplied two of them directly. Recorded as a tracked data migration so the backfill is reproducible on a fresh database.

## Problem
- `hunger_` (Hungry Lions), `ozilotf_` (Gomora United) and `wamashudu` (Orbit College) all had `profiles.phone = NULL`, so they could not be added to the Div 2 group.
- The bot's own auto-capture only fires when a manager texts in and submits a result or check-fixtures, so an unengaged manager can stay null indefinitely — the same three clubs were already the ones flagged as low-engagement (missing eFootball crests earlier in the session).
- Lerumo Lions and Upington City are a different case entirely: they have **no manager**, so there is no profile to attach a number to.

## Fix
`supabase/migrations/081_season4_manager_phone_updates.sql` — idempotent `UPDATE`s setting:
- `dimarco_32` (The Bees) → `+27 77 485 6151`
- `ozilotf_` (Gomora United) → `+27 69 733 3125`

Stored with spaces, matching the style already on several profiles (e.g. `'+27 78 829 9215'`). Format is cosmetic: `phoneNumbersMatch()` and `toInternationalPhone()` in `app/api/webhook/route.ts:1366` and `app/api/webhook/route.ts:1385` both strip non-digits first, and the WhatsApp contacts API rejects local-format numbers (error 131009) so `toInternationalPhone` is what actually dials.

### Duplicate-account finding: `ozilotf` vs `ozilotf_`
`ozilotf_` is one of two accounts for the same person — `ozilotf` already held `27697333125`, which is the same number the user supplied. Both now carry it, which is safe because **the app never resolves a profile by phone**: a WhatsApp session resolves to a `matched_fixture_id`, then to that fixture's teams, then through `teams.manager_id` to the profile whose stored phone gets compared (`getPhoneUpdatePrompt`, `app/api/webhook/route.ts:1397`). There is also no unique constraint or index on `profiles.phone` — only `profiles_username_key`. `ozilotf_` is the account that actually holds the Gomora United seat.

This is the same two-accounts-per-manager pattern flagged for `Thando` / `thando_1110`; worth a sweep for other near-duplicate usernames before the next season.

## Verification
- Migration re-run end to end: same two values written, no error — confirms idempotency.
- `dimarco_32` = `+27 77 485 6151`, `ozilotf_` = `+27 69 733 3125`.
- Re-queried Season 4 league participants for `phone IS NULL`: only `hunger_` (Hungry Lions) and `wamashudu` (Orbit College) remain, plus the two managerless clubs. So **28 of 30** managers now have a number on file.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Auto phone-update flow these numbers sit alongside: `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`
- Admin manager assignment (where a club actually gets its manager): `.opencode/context/onboarding/` category
- The backfill migration: `supabase/migrations/081_season4_manager_phone_updates.sql`
- Same session's vacancy auto-loss fix, which covered the two managerless clubs: `.opencode/context/user-based-competitions/vacant-sweep-misses-unowned-seats_2026-09-29.md`

## Notes / follow-ups
- Still outstanding: `hunger_` and `wamashudu` have no number. Chase manually or let the bot capture it on their first result submission.
- `loki` (Milford, Div 1) is on Namibian country code `+264 81 475 7719`, not `+27` — worth confirming before the Div 1 group goes out.
- `has_searched` is `false` for all 30 managers, so expect low early group activity.
- `profiles.phone` has no unique index. If phone-based identity is ever needed, the two `ozilotf*` accounts are the first thing that would break.
