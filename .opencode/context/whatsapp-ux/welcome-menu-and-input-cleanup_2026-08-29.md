# Welcome menu on initial contact + input cleanup + plain-English prompts

Reworked the WhatsApp bot so first-time contact (no active flow) shows a numbered
welcome menu instead of the old "I only help with submitting match results"
rejection, and made every bot prompt tolerant of wordy/quoted input and written in
plain friendly English. This is a cross-cutting change touching the onboarding,
backdoor, check-fixtures and results flows, so it is registered under its own
`whatsapp-ux/` category.

## Problem
- A brand-new user who texted the bot with nothing active got
  "I only help with submitting match results..." — a dead end that offered no
  way to create an account, report a non-responding opponent, or check backdoor
  applications.
- Flows rejected valid human input: `"backdoor"` (quoted), "i want to submit a
  backdoor", "option 1 please", "can you swap" — keywords like `backdoor`,
  `swap` and trailing `please` broke exact-match regexes.
- Bot copy used South African slang ("Shot, let me take a look", "Lekker!",
  "howzit shot bru", "No stress") and vague messages ("I only help with ...",
  "Something went wrong. Start over.") that were hard to understand for
  non-native English speakers.

## Fix (all in `app/api/webhook/route.ts` unless noted)
1. **Welcome menu (`handleWelcomeMenu`)** — new `WELCOME_MENU` constant. Triggered
   only from the catch-all (`!session` OR scores both `null` in a non-backdoor
   state), i.e. initial contact. Menu replies: 1 → screenshot prompt for a result;
   2 → backdoor (window check → `awaiting_backdoor` / `backdoor_menu_step:
   'screenshot'`); 3 → `handleOnboardingStart`; 4 → `showUserBackdoorApplications`,
   then re-arms the menu. All mid-flow states are handled earlier in `handleText`,
   so the menu never re-triggers mid-flow.
2. **Deterministic re-prompt (`resultFlowReprompt`)** — the LLM `switch` default /
   `confirm`-without-match / `correct`-without-corrections cases now send a
   step-specific re-prompt (override confirm / forfeit / generic YES·SWAP·EDIT
   SCORE·CANCEL) instead of letting the LLM reply vaguely.

3. **Input normalization helpers** — `normalizeText` (strips quotes + trailing
   punctuation), `extractNumber`, `includesWord` (word-boundary), `isCancel`,
   `isYes`/`isNo` (tolerant word lists), `cleanTeamInput` (team answers), and
   ordered `COMMAND_PHRASES` + `findCommandHandler`. Command gateway at the top of
   `handleText` now dispatches through `findCommandHandler` (admin guards kept for
   `backdoor submissions` / `backdoor admin`; `submit_result` → screenshot prompt).
4. **Keyword-tolerant handlers** — number pickers use `extractNumber`
   (`handleSubmissionType`, backdoor menu, `handleBackdoorFixture`,
   `handleBackdoorFixtureSelect`, `handleBackdoorAdminReview`, manager-applications
   applicant/team, `awaiting_fixture_from_past`); team inputs use `cleanTeamInput`
   (`handleBackdoorSearch`, `handleBackdoorFixtureSearch`, `handleFixturesTeam`,
   `handlePhoneTeamConfirm`, `resolveBackdoorSide`, `awaiting_match_name`);
   yes/no/cancel/swap/approve-decline converted to `isYes`/`isNo`/`isCancel`/
   `includesWord` (`handlePhoneUpdate`, `handleFixturesPhoneConfirm`,
   `handleBackdoorOverrideConfirm`, `handleBackdoorAdminDecision`,
   `handleManagerApplicationsConfirm`, forfeit, direct-bypass affirmative,
   `awaiting_already_submitted`, `awaiting_edit_score`, SWAP, EDIT SCORE,
   "check other date").
   ⚠️ In `handleFixturesAction`, `parseUserDate` is checked BEFORE `extractNumber`
   so "15 Aug" is a date, never fixture 15. In `awaiting_already_submitted`,
   global `isYes` must NOT include `edit`/`fix` (would break direct-bypass EDIT
   SCORE) — that branch uses `isYes(lower) || includesWord(lower, 'edit')`.
5. **Plain-English sweep** — rewrote the backdoor menu ("Opponent not responding
   (backdoor win) …"), backdoor window message, screenshot acknowledgements,
   cannot-read-screenshot messages, team-not-found prompts, and cancel confirmations.
   Personality + tone examples in `lib/system-prompt.ts` (`CAT_SYSTEM_PROMPT`)
   dropped slang ("howzit/bru/lekker"); unknown-reply guidance simplified.
   `lib/whatsapp.ts` fallback strings ("I only help…", "brain freeze bru") reworded.

## Verification
`npx tsc --noEmit`, `npm run lint`, `npm run build` all pass (lint warnings
pre-existing).

## Context chain (by path)
- Onboarding entry point reused: `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`
- Backdoor states reused: `.opencode/context/backdoor/backdoor-both-absent-16aug_2026-08-17.md`
  and `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`
- Check-fixtures team/date flows: `.opencode/context/check-fixtures/check-fixtures-autodetect_2026-08-15.md`
  and `.opencode/context/check-fixtures/phone-update-and-check-fixtures_2026-08-15.md`
- Already-submitted handling: `.opencode/context/whatsapp-results/already-submitted-handling_2026-08-15.md`
- Forfeit messaging: `.opencode/context/forfeit-balances/forfeit-notification-clarity_2026-08-26.md`