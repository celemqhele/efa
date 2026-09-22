# WhatsApp "logged-in" state — first-time submission with combined category list

Implemented a signed-in WhatsApp experience: the bot detects the texting manager by
their stored profile phone number, greets them by username (`Hello @username 👋`), and
routes their results submission through a combined pick-list flow (Category 1 = today's
games, Category 2 = approved-backdoor games from the last 7 days) instead of the
anonymous screenshot → team-name → submission-type chain.

## Problem

- Anonymous users must send a screenshot first, then type team names, then choose
  "first time" vs "fix". A recognised manager does not need any of that — the bot knows
  who they are (`phoneNumbersMatch`), so the game can be picked straight from a list and
  the screenshot is only needed for the score/stats.
- Backdoor-result games (the system applied a win/loss/draw) were never re-submittable
  with the real score, and pending backdoor submissions were the only ones voided on a
  real result write (`.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`, `.opencode/context/backdoor/backdoor-void-on-play_2026-08-30.md`).

## Fix

**Identity + welcome (route.ts)**
- `getLoggedInManager(from)` resolves the sender against `profiles.phone` (reusing
  `phoneNumbersMatch`) and returns their `{ profileId, username, teamIds, teamNames }`.
  A manager can own multiple teams, so every call loops `teamIds`.
- `loggedInWelcomeMenu(username)` — "Hello @username 👋 … 1. Submit a match result / 2.
  Opponent did not respond / 3. Check my fixtures / 4. Check my backdoor applications /
  5. Tournament applications / 6. Reset my password" (option 3 swaps out the anonymous
  "Create an EFA account").
- `sendWelcomeMenu(from, phoneNumberId)` picks logged-in vs generic menu; used by
  `handleWelcomeMenu`, `handleFlowHint`, `handleStartAgain` and the LLM-fallback `default`
  / `correct` branches.
- `handleWelcomeMenu` branches on `getLoggedInManager`: logged-in option 1 opens the
  submission-type sub-menu (state `awaiting_submission_type`), option 3 calls
  `handleCheckFixturesCommand` (existing auto-detect flow).

**Combined first-time list (route.ts)**
- `handleSubmissionType` (state `awaiting_submission_type`) branches for logged-in
  managers: option 1 → `handleLoggedInFirstTimeList`; option 2 → `awaiting_fix_screenshot`.
- `handleLoggedInFirstTimeList` builds ONE numbered list:
  - Category 1 (options 1..N): fixtures where the manager's team plays today
    (`scheduled_date = getSastDateKey()`, `status = 'scheduled'`).
  - Category 2 (options N+1..): fixtures with an `approved` `backdoor_submissions` row in
    the last 7 days (−7d cutoff on `reviewed_at`) involving the manager's teams,
    `isFixtureConfirmed` and inside the submission window. Already-replaced games drop
    out because the write path voids the approved submission. Stored in
    `displayed_fixtures` under state `loggedin_first_time_pick` with
    `MATCH_LIST_HINT` typesetting.
- `handleLoggedInFirstTimePick` validates the number, looks up the fixture, stores
  `matched_fixture_id` and moves to state `loggedin_first_time_screenshot`, asking for
  the screenshot (noting the backdoor-replacement warning when the fixture is confirmed).
- `handleLoggedInScreenshotImage` handles an image arriving in state
  `loggedin_first_time_screenshot` (skip fix-handoff → `awaiting_match_name` for
  `awaiting_fix_screenshot`): runs `analyzeImageBuffer`, then for the pre-matched
  fixture sets score/stats/`matched_fixture_id` and jumps straight to the existing
  confirm menu (1 submit / 2 edit / 3 swap / 4 cancel), choosing
  `awaiting_override_confirm` when the fixture is already confirmed so the existing
  override → forfeit → `resetAndResubmit` path applies.

**Write path**
- `writeResultToDb` now voids `backdoor_submissions` with status `pending` **or**
  `approved` on a real result write (non-pending games), via
  `.in('status', ['pending', 'approved'])`. This is what makes Category-2 games
  "first-time" submissions that replace the system-applied backdoor score.

**Routing
- POST handler: the backdoor image branch is followed by a new logged-in image branch —
  if the session state is `loggedin_first_time_screenshot` or `awaiting_fix_screenshot`,
  the image feeds `handleLoggedInScreenshotImage` (before the multi-image scan).
- `handleText`: new state dispatch for `loggedin_first_time_pick` → pick handler, and
  `loggedin_first_time_screenshot` / `awaiting_fix_screenshot` → re-prompt for the
  screenshot.

## Files touched
- `app/api/webhook/route.ts` — identity, welcome menu, submission-type branch, combined
  list, screenshot handler, image routing, state dispatch, void-approved.
- No schema changes: the new states are plain-text session states.

## Verification
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass (no new warnings).
- Manual WhatsApp test checklist (for the owner):
  1. Verified number → greet + logged-in menu; option 1 → sub-menu.
  2. Option 1 → combined list shows today's games (1..N) then backdoor games (N+1...).
  3. Pick a number → screenshot → confirm menu → submit → result written; if cat 2, the
     approved `backdoor_submissions` row for that fixture is now `void_game_played`.
  4. Anonymous number → unchanged screenshot-first flow.