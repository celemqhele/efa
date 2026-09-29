# WhatsApp logged-in pick list — window-based games, nearest-match fallback, free-text search

After the logged-in pick-list flow shipped in `.opencode/context/whatsapp-logged-in/whatsapp-logged-in-first-submit_2026-09-22.md`, the user reported that a manager trying to submit the AmaZulu 4-3 v Kaizer Chiefs result (Season 4, Motsepe Division 2, stored matchday 2026-09-29) "couldn't find the match" shortly after SAST midnight. This file documents the dead-zone root cause and the three-part fix (window-based Category 1, nearest out-of-window fallback, free-text "Team A vs Team B" search for identified managers); the requested result was submitted directly via `supabase/manual/amazulu-4-3-kaizer-chiefs-2026-09-29.sql`.

## Problem

- **Nightly dead zone**: `handleLoggedInFirstTimeList` Category 1 narrowed to fixtures with
  `scheduled_date = getSastDateKey()` (strictly *today*) — NO window look-back. Meanwhile the
  `auto-finalise-prev-day` cron (see `.opencode/context/auto-finalise/auto-finalise-cron_2026-09-17.md`)
  only runs at 00:00 UTC = 02:00 SAST. So between SAST midnight and 02:00, a manager's
  un-submitted *yesterday* game is still `scheduled` (valid to submit) but invisible in the pick
  list, and typing its name hits `handleLoggedInFirstTimePick` which rejects any non-number with
  "Pick a number between 1 and N." Proof: `whatsapp_sessions` for `27665582832` (goat_2, AmaZulu's
  manager) at `2026-09-30 00:04 SAST` had `state='loggedin_first_time_pick'`,
  `displayed_fixtures=["f2f7c39e-30cf-4429-8864-4ed8c050549d"]` = the 2026-09-30 AmaZulu v Cape
  Town City fixture ONLY — the 09-29 Kaizer Chiefs game had already left the list.
- **Misleading out-of-window fallback** (anonymous `awaiting_match_name` path): the
  not-in-window branch queried every fixture for the pair and `.find()`'d the FIRST row after an
  `scheduled_date DESC` order — i.e. the NEWEST, which can be a far-future fixture in another
  tournament (e.g. a CAF tie on 2026-10-31), producing "more than 7 days away… (Thursday,
  31 October)" for a match the user never mentioned.
- **Free-text search was a silent no-op**: with no active session, an identified manager typing
  "AmaZulu vs Kaizer Chiefs" reached `handleWelcomeMenu`, whose manager branch only handled
  numbers 1-6 and otherwise re-sent the menu. The team-name search only existed after a
  screenshot.
- Season-4 scheduling dense-ness made this acute: Motsepe rounds are scheduled one matchday per
  calendar day (MD1 2026-09-28 … MD234 2026-10-27 for the league leg), so "today's games" rotates
  every midnight.

## Fix

**1. Window-based Category 1** (`handleLoggedInFirstTimeList`, route.ts): replaced
`scheduled_date.eq.<todayKey>` with `scheduled_date.gte.<winStart>,scheduled_date.lte.<winEnd>`
using `getSubmissionWindow()` (today-7 .. today+7), keeping `status = 'scheduled'` and a
client-side `isInSubmissionWindow` filter on `fixtureDateKey`. The list is now grouped under
three headers rendered by `formatFixtureLine` with a shared running index: "Today's games",
"Earlier this week", "Later this week", then the unchanged "Backdoor-result games (last 7 days)"
category. This permanently removes the midnight-02:00 dead zone.

**2. Nearest out-of-window fallback** (`awaiting_match_name` empty-match branch, route.ts):
dropped the `.order('scheduled_date', {ascending:false})` + `.find(...)` and instead computed
`Math.abs(Date.parse(dateKey) - now(SastDateKey))` over all out-of-window fixtures for the pair,
picking the one NEAREST to today (past or future) before calling `submissionBlockReason`. The
block message is now about the actually-relevant fixture instead of the newest unrelated one.

**3. Free-text match search for identified managers** (route.ts): new
`handleLoggedInMatchNameSearch(from, manager, text, phoneNumberId)` — parses "Team A vs Team B"
via the same `cleanTeamInput` + score-strip + `resolveTeamName` logic as the anonymous search,
restricts the pair to the manager's own `teamIds` (so a manager can't start submissions for other
teams), queries in-window `scheduled` fixtures for the exact pair, and:
- 0 matches → explanatory message + hint, stays in welcome menu;
- 1 match → stores `matched_fixture_id` and jumps to `loggedin_first_time_screenshot` asking for
  the screenshot (with the backdoor-replacement note when the fixture is already confirmed);
- N matches → sets `loggedin_first_time_pick` with `displayed_fixtures` and a numbered list.
`handleWelcomeMenu`'s manager branch calls it before its final `sendWelcomeMenu` fallback, so
only non-numeric free text reaches it (numbered menu picks 1-6 still win).

## Files touched

- `app/api/webhook/route.ts` — `handleLoggedInFirstTimeList` (window query + grouped list),
  `awaiting_match_name` out-of-window fallback (nearest-distance), new
  `handleLoggedInMatchNameSearch`, `handleWelcomeMenu` manager-branch hook.
- No schema changes; states reused (`loggedin_first_time_pick`, `loggedin_first_time_screenshot`).

## Verification

- `npx tsc --noEmit` passes clean.
- Unaffected fixture states verified in DB: AmaZulu v Kaizer Chiefs (`339f8b4c-20d4-4abb-857e-bb0ad504231e`)
  is `confirmed`, standings applied once by the `on_result_insert` trigger.
- Manual WhatsApp checklist (owner):
  1. After SAST midnight, option 1 should still list the previous day's un-submitted game under
     "Earlier this week" before 02:00 (and grouped correctly generally).
  2. Typing "AmaZulu vs Kaizer Chiefs" from a known number with no active flow → straight to
     screenshot for the single in-window match; a wrong/other-team pair → explanatory message.
  3. Anonymous-number flows unchanged (screenshot-first).