# Reassign Hungry Lions to maninblack, delete hunger_, set wamashudu phone

Admin requested manager cleanup for the current season (2026-09-30): `hunger_`
was a duplicate account (the same manager re-created after "having issues" going
forward as `maninblack`), so Hungry Lions, its season seats, tenure, notifications
and poll applications moved to `maninblack` and the `hunger_` account was deleted;
`wamashudu` finally got a phone number. Follows the data-move approach of
`.opencode/context/onboarding/manager-data-transfer_2026-08-25.md` and the
seat/tenure handling of `.opencode/context/onboarding/assign-vacant-season4-seats_2026-09-29.md`.

## Problem

- `hunger_` (`81e59b06-bec0-46f9-8bd9-16d2d8303bfc`) and `maninblack`
  (`e30cea5f-5128-4ec0-872e-8dd1ed0d81fd`) are the same human. maninblack's Ghana
  tenure ended 2026-09-27T18:13:39 and hunger_ opened the Hungry Lions tenure at
  2026-09-27T18:14:32 (same admin reassignment session). `maninblack` held no team.
- `wamashudu` (`1909a51f-b351-4c12-9246-1f1f7c0cc3f9`, Orbit College) had `phone = null`.
- Season schedule context: `profiles.id` == `auth.users.id`, but the profiles→auth
  FK is RESTRICT (profile must be deleted before the auth row), and several
  NO ACTION FKs point back at the profile (teams, participants, tenures
  [SET NULL], notifications, poll_applications).

## Database research (before the change)

- FKs referencing `profiles(id)` enumerated via pg_constraint; hunger_ owned 1
  team (Hungry Lions `31ecfc55-86f4-47d6-add4-f1ff1a90ff67`, single row, no logo
  siblings), 3 `tournament_participants` seats (Motsepe / CAF Confederations /
  Nedbank), 1 open tenure, 8 notifications, 2 approved `poll_applications`
  (poll `c0586f56` 2026 SA Club Selection). No trophies, forfeits, results
  (`finalised_by`), comments, predictions, push subs, or audit rows.
- maninblack's own approved poll application is on a different poll
  (INTERNATIONAL CUP), so the 2 hunger_ applications move without uniqueness clash.

## Fix (migration `083_reassign_hungry_lions_maninblack_delete_hunger_set_wamashudu_phone.sql`, applied live)

1. `teams.manager_id` Hungry Lions → maninblack.
2. `tournament_participants.user_id` (3 seats) → maninblack.
3. Open Hungry Lions `manager_tenures` → maninblack + `manager_username =
   'maninblack'` (done BEFORE the delete; the tenure FK is SET NULL).
4. `notifications.user_id` (8) → maninblack.
5. `poll_applications.applicant_id` (2) → maninblack.
6. `profiles.phone = '27711063817'` for wamashudu (+27 71 106 3817, digits-only
   matching migration `082_repair_270_prefixed_phone_numbers.sql` format).
7. Delete `public.profiles` row, then `auth.users` row for hunger_ (profile
   first — profiles→auth.users is RESTRICT).

## Verification

- Hungry Lions manager = maninblack; 3 seats across Motsepe/CAF CC/Nedbank = maninblack;
  open tenure on Hungry Lions = maninblack (ended_at null).
- wamashudu phone = `27711063817`; hunger_ absent from profiles AND auth.users.
- Notifications now total 162 for maninblack (154 original + 8 moved);
  `poll_applications` for `c0586f56` now list maninblack twice (one per club slot).
- **0 managers in active tournaments now lack a phone** (previously 2).

## Cross-references

- Data-transfer mechanics: `.opencode/context/onboarding/manager-data-transfer_2026-08-25.md`
- Seat/tenure/reclaim conventions: `.opencode/context/onboarding/assign-vacant-season4-seats_2026-09-29.md`
- Phone storage format: `.opencode/context/check-fixtures/repair-270-prefixed-phone-numbers_2026-09-29.md`

## Restore File Section

- (none — no files recycled; the deleted accounts are unrecoverable by design per the user's instruction)