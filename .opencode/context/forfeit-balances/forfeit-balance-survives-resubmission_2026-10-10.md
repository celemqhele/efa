# Forfeit balances survive resubmission — re-opened and re-applied (10 Oct 2026)

Added a `consumed_by_fixture_id` column to `forfeit_balances` so a match tracks
which carry-over balance(s) it applied, and made every submission path re-open
those balances when the same match is resubmitted — so a corrected score still
includes the forfeit carry-over instead of silently dropping it. Also backfilled
the existing rows from the `forfeit_note:` citation already stored in
`results.override_reason`. This is a follow-up to
`.opencode/context/submit-portal/forfeit-notes-cite-all-applied_2026-10-10.md`:
the user reported that a first submission applied the balance but changing the
score and submitting again "will just use that score only".

## Problem

`forfeit_balances.remaining` was set to `0` the moment a balance was consumed,
and the apply loops only ever select `remaining > 0` balances. Nothing recorded
*which fixture* consumed a balance, so on a resubmission (portal upsert, or the
webhook `resetAndResubmit` which deletes the old result then rewrites it) the
balance was already `remaining = 0` and was therefore not re-applied. The
corrected score lost the carry-over entirely.

## Fix / Implementation

1. **Schema** — `supabase/migrations/098_forfeit_balance_consumed_by.sql`:
   - `ALTER TABLE public.forfeit_balances ADD COLUMN IF NOT EXISTS consumed_by_fixture_id UUID;`
   - Backfill: for already-consumed rows (`remaining = 0`), set
     `consumed_by_fixture_id = r.fixture_id` where the result cites the balance
     (`r.override_reason LIKE '%forfeit_note:' || fb.fixture_id::text || ':%'`).
     This pointed the reported match's two balances at `8aab9af9-…`.
   - Re-applied the table grant (belt-and-braces).
2. **Portal** — `app/api/submit-match/route.ts` (`submitResult`, carry-over branch):
   - Before applying, re-open balances this fixture already consumed:
     `update({ remaining: 1, consumed_by_fixture_id: null }).eq('consumed_by_fixture_id', fixture.id)`.
   - On consume: `update({ remaining: 0, consumed_by_fixture_id: fixture.id })`.
3. **WhatsApp webhook** — `app/api/webhook/route.ts` (`writeResultToDb`): same
   re-open step keyed on `session.matched_fixture_id`, and the consume update now
   stamps `consumed_by_fixture_id`.
4. **Admin dashboard** — `app/api/admin/finalise-result/route.ts`: the consume
   update now also stamps `consumed_by_fixture_id: fixture.id` so a later
   manager portal/webhook resubmission can restore it.

## Notes / Gotchas

- Interaction with the earlier multi-citation change is intentional: on
  resubmission the restored balances are re-applied, and the `forfeit_note:`
  lines are rebuilt from the full applied set, so the citations stay complete.
- The **self-application** flagged in
  `.opencode/context/submit-portal/forfeit-notes-cite-all-applied_2026-10-10.md`
  is *not* changed here: a match that was forfeited still creates a balance whose
  `fixture_id` is itself, and a later normal resubmission still re-applies it. We
  deliberately did not add `.neq('fixture_id', fixture.id)` (it would change the
  reported 12-0). Balances are stable across repeated resubmissions (re-opened
  once, re-applied once), so there is no compounding inflation.
- Admin-managed balances consumed before this migration that were never cited in
  a note cannot be backfilled (no record of the consuming fixture); only rows
  cited via `forfeit_note:` were recovered.
- The admin `/admin/results/submit` page still only lists `remaining > 0`
  balances when a fixture is selected, so re-finalising there won't auto-list a
  previously consumed balance; consumption now records `consumed_by_fixture_id`
  so a manager-side resubmission will restore it.

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` reports only pre-existing warnings (none new in touched files).
- DB check: after the migration, balances `3b2b9437` & `0366a757` both have
  `consumed_by_fixture_id = 8aab9af9-5684-4373-9973-94a676140def`.

## Context Chain (by path)

- Multi-citation display + parser:
  `.opencode/context/submit-portal/forfeit-notes-cite-all-applied_2026-10-10.md`
- Original carry-over apply + portal forfeit:
  `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
- Balance consumption origin:
  `.opencode/context/forfeit-balances/forfeit-balance-use-fix_2026-08-16.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
