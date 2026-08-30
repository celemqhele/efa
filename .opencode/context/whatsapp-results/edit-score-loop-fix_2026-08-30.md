# WhatsApp Edit-Score Loop Fix (raw score hijacked by numbered menu)

Fixed an infinite re-prompt in the WhatsApp edit-score flow: after a manager
chose "2. Edit score" and typed a raw aggregate like `2-3`, the bot kept asking
"What is the correct aggregate score? Type it as: 3-2" forever instead of
applying the new score. This surfaces right after the numbered confirm menu was
introduced in `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
and follows the same result-submit chain as `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`.

## Problem
Repro: user hits option 2 → state becomes `awaiting_edit_score` → user types
`2-3`. The bot replied "What is the correct aggregate score? Type it as: 3-2"
(again) instead of "Please type the score as: 3-2" or applying the score.

Root cause: the `awaiting_edit_score` handler lived **after** the "direct bypass"
block at `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
in `app/api/webhook/route.ts`. The direct bypass runs whenever
`matched_fixture_id` is set and both scores are non-null — which is true in the
edit-score state. It calls `extractNumber(text)`, and `extractNumber("2-3")`
returns `2` (it grabs the first digit run). `num === 2` maps to `actionByNumber
=== 'edit_score'`, which re-set the state to `awaiting_edit_score` and re-sent
the prompt. So every raw score whose first number was 1-4 got swallowed by the
numbered-action menu and looped.

## Fix (`app/api/webhook/route.ts`)
- Moved the `awaiting_edit_score` handler to run **before** the direct-bypass
  block (right after the forfeit handler, before the CANCEL check), so a raw
  score like `2-3` matches the score regex `^(\d+)\s*[-:]\s*(\d+)$` first and is
  applied correctly.
- Removed the old duplicate handler that sat after the direct-bypass block.
- No logic changes to the regex or to how the score is written — only ordering.

## Verification
`npx tsc --noEmit`, `npm run lint` (only pre-existing warnings), `npm run build`
all pass.

## Context chain (by path)
- Numbered confirm menu / submission window: `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
- Already-submitted handling: `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
