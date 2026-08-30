# Word-based Cancel / Start-again hint on numbered match lists (30 Aug)

Applied the "Cancel / Start again" escape affordance to the **numbered
match-selection menus** (where a user picks a fixture by `1..N`) using **words**
instead of the colliding `1. Cancel / 2. Start again` footer. This is a follow-up
to `.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md`,
which deliberately excluded the numbered pick-lists from the `1. Cancel / 2. Start
again` hint because the numbers there are already taken by real match choices.

## Problem

The match-selection menus still showed the old `... Reply with the number of your
match. Type CANCEL to stop.` footer (no start-again affordance). The fixed
`1. Cancel / 2. Start again` numbered footer could not simply be appended because
a list like:

```
Found 2 matches:
1. Colombia vs Argentina - Sun 30 Aug · 02:00 - EFA International Cup (Pending)
2. Argentina vs Colombia - Sat 12 Sept · 02:00 - EFA International Cup (Pending)
```

already uses `1` and `2` for the matches — a numbered cancel/restart footer would
collide, making matches #1/#2 un-selectable.

## Decision (user)

"change it to reply X and reply Y etc" — use **words** for cancel / start-again on
these numbered lists (no colliding numbers).

## Fix (`app/api/webhook/route.ts`)

1. Added `MATCH_LIST_HINT = '\n\nReply CANCEL to stop, or START to start again.'`
   — reserved for numbered match-selection menus, separate from the `FLOW_HINT`
   used on free-text prompts.
2. Added `isStartAgain()` + `handleStartAgain()` helpers: consume a word-guided
   restart ("start", "start again", "restart", "begin", "again") by clearing the
   session and showing the welcome menu. Cancel is already handled by `isCancel()`
   in each menu's handler.
3. Appended `MATCH_LIST_HINT` to the numbered match/fixture list prompts:
   - backdoor fixture list (`handleBackdoorFixture`)
   - backdoor `fixture_select` list (`handleBackdoorFixtureSelect`)
   - result-submission match select & past-date fixtures (`awaiting_fixture_from_past`)
   - check-fixtures list (`sendFixturesForTeams`) + its re-prompt
     (`handleFixturesAction`)
4. Wired `handleStartAgain` into those same numbered-list handlers (right after
   the existing `isCancel` check, before number extraction).

## Notes / Gotchas

- Numbers `1..N` still select matches exactly as before; only the word-shaped
  cancel / start-again is intercepted first.
- The `1. Cancel / 2. Start again` numbered hint (`FLOW_HINT`) is untouched and
  still used on free-text info-request prompts.
- The "Found N matches, be more specific" disambiguation prompt (ambiguous input
  within the result flow) intentionally keeps its wording — it has no dedicated
  selection state to attach word handling to.
- No DB/schema changes; no migrations.

## Verification

`npx tsc --noEmit` clean; `npm run lint` reports only pre-existing warnings in
unrelated files (none in the touched code).

## Context chain (by path)

- Original numbered hint (added FLOW_HINT, excluded match lists):
  `.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md`
- Result-submission match selection (this file extends that flow):
  `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`
- Phone-update no-decline fix (same session):
  `.opencode/context/check-fixtures/phone-update-no-decline-fix_2026-08-30.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | Edit to existing file | N/A |
