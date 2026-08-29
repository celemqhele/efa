# Date Submission Window + Numbered Confirm Menu

Limited WhatsApp result submissions so non-admin players can only submit games due
**today or within the last 7 days** (games in the future or older than 7 days are
blocked with a friendly message; admins can submit any date), and reworked the
result-confirmation footer into a numbered action menu (1 = submit, 2 = edit
score, 3 = swap, 4 = cancel) while keeping the typed keywords working. This is the
first time the result-submit flow enforces a date window; it follows the input
cleanup work in `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md`
and the already-submitted handling in `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`.

## Problem
The WhatsApp result-submit flow deliberately removed any date window when
matching a team pair (`app/api/webhook/route.ts`), so a non-admin could submit a
result for any fixture — a game not yet played (future) or one older than 7 days.
Admins needed the ability to submit/override on any date (used by the backdoor /
direct-submission flows). Separately, the confirmation prompt ("Reply YES to submit,
Type SWAP ... EDIT SCORE ... CANCEL") was awkward to use; numbered options are much
easier for users submitting results.

## Fix (`app/api/webhook/route.ts`)
1. **Submission-window helpers** (near `getWeekRange`):
   - `getSubmissionWindow()` → `{ start, end }` (today-7 .. today, YYYY-MM-DD).
   - `fixtureDateKey(f)` → normalises a fixture's `scheduled_date` (timestamp or
     date-only) to a YYYY-MM-DD key.
   - `isInSubmissionWindow(dateKey)` → range check.
   - `submissionBlockReason(f, now)` → returns `null` if allowed, otherwise a
     human-readable message: future = "This game has not been released yet. Please
     submit the screenshot at {date}." older-than-7-days = "This match is older
     than 7 days, so it can't be submitted here. Please send the screenshot on the
     match day."

2. **Window gating (non-admins only)** via `isAdminPhone(from)`:
   - Exact-pair search in `awaiting_match_name` now applies `.gte/.lte` on
     `scheduled_date` for non-admins; admins query any date.
   - The "already submitted" lookup is likewise window-gated for non-admins.
   - The "check other date" / `awaiting_date` handler blocks non-admins from
     requesting a date outside the window.
   - Final safety gate added at the top of both `writeResultToDb()` and
     `resetAndResubmit()` so the restriction cannot be bypassed through the
     direct-bypass or LLM-confirm paths.

3. **Friendly block messages at the required points**: after typing the match name
   (single-match path) and after clicking a number in a multiple-match list
   (`awaiting_fixture_from_past`), plus the direct-number-select and text-match
   paths. If the team pair exists but is out of window, the bot clears the session
   and sends the "not released yet" / "older than 7 days" message instead of a
   generic "no match found".

4. **Numbered action menu** in every result confirm footer:
   ```
   1. Submit result
   2. Edit score
   3. Swap the stats
   4. Cancel
   ```
   - A fixture is always already matched when this menu shows, so numbers map to
     actions (never to a fixture pick, which happens earlier while
     `matched_fixture_id` is null — no conflict).
   - The direct-bypass handler now routes: `1`/affirmative → forfeit question then
     write; `2`/“edit score” → `awaiting_edit_score`; `3`/“swap” → swap;
     `4`/CANCEL → cancel. Typed keywords (`yes`, `swap`, `edit score`, `cancel`)
     and the "check other date" hint are preserved.
   - Updated confirm footers at: single-match path, past-date/multi-match pick,
     direct-number-select, text-match, after SWAP, after EDIT SCORE, the forfeit
     confirm, and the `resultFlowReprompt` default.

## Notes / Gotchas
- Admins are identified by `isAdminPhone(from)` (`ADMIN_PHONES`); they bypass every
  new restriction so the backdoor/direct-submission flows still work on any date.
- Backdoor flow itself is untouched (it has its own window logic + admin review).
- The forfeit-applied confirm shows a reduced menu (submit + cancel) since a forfeit
  score is already adjusted.
- No DB/schema changes; no migrations.
- The dual-role handling (`isAdmin` var + repeated `isAdminPhone(from)` checks)
  keeps the window gate at both the query layer and every write entry point.

## Verification
`npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build`
all pass.

## Context chain (by path)
- Input cleanup / welcome menu: `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md`
- Already-submitted handiing: `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`
- Backdoor override / admin-any-date behaviour: `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
