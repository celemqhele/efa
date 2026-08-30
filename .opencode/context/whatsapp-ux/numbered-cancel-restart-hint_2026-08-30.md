# Numbered "Cancel / Start again" Hint on Every Info Prompt

Added an explicit `1. Cancel` / `2. Start again` numbered footer to every
free-text info-request prompt in the WhatsApp bot (score, team names, date,
forfeit, team name, username, etc.) and wired the two numbers up centrally, so a
mid-flow user always sees and can use a clear way out instead of relying on the
implicit "type CANCEL" wording. This follows the block ordering fix in
`.opencode/context/whatsapp-results/edit-score-loop-fix_2026-08-30.md` and the
numbered confirm menu in
`.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`,
fits the UX work in `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md`.

## Problem
After a WhatsApp session had started, the info-request prompts (e.g. the edit-score
prompt "What is the correct aggregate score? Type it as: 3-2" and the match-name
prompt "What match is it for? Type the team names...") only hinted at cancel
implicitly via "Type CANCEL to stop" or not at all. There was no consistent,
visible "1. Cancel / 2. Start again" hint on every message, so mid-flow users
didn't have a clear escape hatch.

## Fix (`app/api/webhook/route.ts`)
1. **`FLOW_HINT`** constant `'\n\n1. Cancel\n2. Start again'` and a
   **`FLOW_HINT_STATES`** set naming the free-text info-request states. Deliberately
   excludes the numbered-selection states (confirm menu `awaiting_override_confirm`
   / `awaiting_forfeit_confirm` with `1. Submit result`, the multi-match pick
   `awaiting_fixture_from_past`, and `awaiting_backdoor_fixture`) because there the
   numbers already mean real actions and a `1. Cancel` would collide.
2. **`handleFlowHint()`** helper: for an exact `1` → clear session + "Cancelled...",
   for an exact `2` → clear session + show `WELCOME_MENU` (restart from the menu).
3. **Central intercept** at the top of `handleText()` before any state handler: if
   the session is in one of the `FLOW_HINT_STATES`, `1`/`2` are consumed there.
4. **Appended `FLOW_HINT`** to the info-request prompts in: result-flow match name
   (new/fix), edit score, forfeit question, already-submitted, "what date", backdoor
   search / side / override-confirm, check-fixtures team name, phone update,
   phone team confirm, and onboarding username.

## Notes / Gotchas
- `awaiting_forfeit_confirm` was initially included then removed: it shows a
  numbered menu (`1. Submit result\n4. Cancel`) from `handleForfeitYes`, so catching
  `1` as cancel would have broken submit.
- `awaiting_backdoor_fixture` is also excluded — it uses numbers 1..N to pick a
  fixture.
- Typing just `2` inside `awaiting_edit_score` now means "start again" (a bare `2`
  is not a valid score), which is the intended behaviour.
- No DB/schema changes; no migrations.

## Verification
`npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build`
all pass.

## Context chain (by path)
- Edit-score loop fix: `.opencode/context/whatsapp-results/edit-score-loop-fix_2026-08-30.md`
- Numbered confirm menu / submission window: `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
- Welcome menu / input cleanup: `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
