# Knockout brackets never advanced on WhatsApp/backdoor result confirmations

Date: 2026-08-23
Chain: `knockout-generation/` (follow-up to `knockout-daily-cap_2026-08-23.md` and
`knockout-autogen-removal_2026-08-23.md`)

## Symptom

UEL QF leg 2 — Manchester Utd 1–8 Newcastle (aggregate 15–2) — was confirmed via WhatsApp at
18:11 UTC, but the SF bracket stayed empty: admin expected Newcastle in the final four, saw TBC.

## Diagnosis

The result never went through `/api/admin/finalise-result`:

- Result row had `is_abandoned: true, abandoned_type: 'home'` + a matching `forfeit_balances`
  row ("Forfeit: 1-8 adjusted from 1-5") — written by the webhook forfeit path
  (`app/api/webhook/route.ts`, forfeit block after result upsert).
- No `audit_log` rows for the 18:08/18:11 confirmations. Only the admin finalise route writes
  `audit_log` (`finalise_result` action) — last entries were 13:26–13:27 that day.

Root cause: **only** `finalise-result/route.ts` called `advanceWinner()`. Three other paths set
fixtures to `status='confirmed'` without touching bracket progression:

1. Manager WhatsApp result submission — `writeResultToDb` in `app/api/webhook/route.ts`
   (fixture confirmed by the `on_result_insert` DB trigger from migration 003, plus a webhook
   verify/force block). Standings were recalculated, progression was not.
2. Backdoor approve (WhatsApp admin "approve" on backdoor submissions).
3. Backdoor win / override of an already-submitted result.

Long-standing gap: it only surfaced once KO results started arriving via WhatsApp instead of
admin finalisation.

## Fix

Commit `a20b9ee` — added non-fatal `advanceWinner` calls (try/catch, same pattern as the
finalise route) to all three webhook paths:

- `writeResultToDb`: fixture lookup extended with `round_type, tournament_id`; guarded call
  after the status-confirm block.
- Backdoor approve: `fixData` select extended; guarded call before the confirmation reply.
- Backdoor win/override: `existingFix` select extended; guarded call after standings recalc.

Guard shape everywhere:
`['r16','qf','sf','final'].includes(round_type)` → `advanceWinner(db, tournamentId, fixtureId, homeScore, awayScore, homeTeamId, awayTeamId)`.

## Immediate data fix

Newcastle was advanced manually via SQL (equivalent to what `advanceWinner` computes —
`BRACKET_PROGRESSION[113] → matchday 202 home slot`):

```sql
UPDATE fixtures SET home_team_id = '<newcastle-id>'
WHERE tournament_id = '<uel-id>' AND matchday = 202 AND round_type = 'sf';
```

Note: forfeits progress on recorded scores (1–8 here) which gave the right winner; forcing a
specific outcome regardless of score would be a separate rule change.

## Gotchas for next time

- `session.matched_fixture_id` is typed nullable → guard it before passing to `advanceWinner`
  or tsc fails (`string | null` arg).
- Supabase null-narrowing: `if (x?.tournament_id)` narrows the property, but a bare
  `includes(x?.round_type ?? '')` does NOT narrow `x` for later property access — check
  `x && ...` explicitly.
- The working tree often has unrelated WIP in flight (seasons page, SeasonManager); scope
  commits file-by-file so WIP type errors don't block or pollute a fix commit.
