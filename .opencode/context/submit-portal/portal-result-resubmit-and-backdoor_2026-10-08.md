# Portal: result resubmission (2 max) + backdoor replacement tag

Restores the two "change a score" behaviours that were forgotten when the
submission portal replaced the WhatsApp flow: a manager can override an already
submitted result up to 2 times, and an approved backdoor result can be replaced
by the real score within 7 days, with a yellow tag shown under the match status
pill. Follows the bot behaviours documented in
`.opencode/context/app` — see the bot's `resetAndResubmit`
(`app/api/webhook/route.ts:6238`) and the backdoor Category 2 first-time list
(`app/api/webhook/route.ts:1397`).

## Problem
- The portal hard-blocked any result once one existed:
  `if (fixture.result && !fixture.postponed_confirmed) return error('...already has a result...')`
  in `app/api/submit-match/route.ts`, and `buildState` in `lib/submit-match.ts`
  set `resultBlock` for the same case. A manager who typed the wrong score could
  not correct it.
- The bot, by contrast, allows overriding a submitted score up to
  `MAX_WHATSAPP_RESETS = 2` via `fixtures.whatsapp_reset_count` (reset limit
  check + restoreAndResubmit), and an approved backdoor result can be replaced
  by the real score within 7 days (Category 2, treated as a first-time
  submission, NOT counted as a reset).

## Fix
### `lib/submit-match.ts`
- `loadFixture` now selects `whatsapp_reset_count` and the result `id`
  (`result:results!results_fixture_id_fkey(id, home_score, ...)`) so the portal
  can count resets and wipe previous stats/confirmations.
- `buildState` result gate now distinguishes three cases when a result exists
  and it is not a postponed placeholder:
  - Approved backdoor result on file → no block; `rules.resultNote`
    ("A backdoor result is on file... replaces the backdoor result. Open up to
    7 days after the deadline").
  - Admin → no block; note (admins not limited by the change count).
  - Manager with `whatsapp_reset_count >= 2` → `resultBlock`
    ("already changed twice, ask an admin").
  - Manager within limit → no block; note with `X of 2 allowed changes used`.
- Returns the note as `rules.resultNote` alongside `rules.resultBlock`.

### `app/api/submit-match/route.ts` `submitResult`
- Removed the blanket "already has a result" rejection.
- Query an approved `backdoor_submissions` row for the fixture; if present the
  existing result is a backdoor result and the real score is a first-time
  submission (no reset count).
- `isResubmit` = result exists && not postponed placeholder && not backdoor
  result. If resubmitting as a non-admin and `whatsapp_reset_count >= 2`,
  reject ("already changed twice").
- Any replacement of a non-placeholder result first deletes
  `match_stats` (by previous result id) and `result_confirmations` for the
  fixture (mirrors restoreAndResubmit steps 1-2).
- Upsert sets a distinct `override_reason`: `'postponement placeholder replaced'`
  (placeholder), `'result resubmitted by manager'` (reset), or
  `'backdoor result replaced by real score'` (backdoor).
- Fixture update increments `whatsapp_reset_count` when `isResubmit`, so the
  portal and the WhatsApp bot share the same 2-reset budget.
- Success `title` becomes "Result updated" and the message explains the
  override; audit details now include `is_replacement` + `why`.

### `app/submit-match/[code]/_portal.tsx`
- Yellow tag (`bg-feedback-warning/15 text-feedback-warning`) rendered under the
  status `<Pill />` in the header whenever `state.rules.resultNote` is set
  (backdoor-replace / resubmit guidance).
- `ResultPanel` accepts and shows `note` (the same guidance line above the
  form), while still honouring `block` when the 2-reset limit is exhausted.

## Verification
- `npx tsc --noEmit` passes.
- `npx next lint` reports only pre-existing warnings (none in the three edited
  files).
- Not yet deployed; push to `main` triggers Vercel.

## Files changed
- `lib/submit-match.ts`
- `app/api/submit-match/route.ts`
- `app/submit-match/[code]/_portal.tsx`