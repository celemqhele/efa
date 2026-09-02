# Onboarding guide refresh for the current WhatsApp bot UX

Refreshed the EFA Manager onboarding guide (`scripts/generate-onboarding-pdf.tsx`,
output `public/EFA-Onboarding.pdf`) so it documents the bot as it actually behaves
now: the simplified numbered welcome menu on first contact, the current result-
submission and backdoor copy, plus brand-new "Create an account" and "Tournament
applications" sections. This is a doc-facing follow-up to the bot UX changes the
user has been shipping — after the welcome-menu and cancel/restart-hint work, the
guide still described the old "just send a screenshot / type CANCEL" flow and
never mentioned that a conversation now starts with a simple numbered menu.

## Problem
- The guide jumped straight into "send a screenshot" and never mentioned the new
  numbered welcome menu a user gets on first contact — the key "it's simpler now"
  experience the user called out.
- Result-submission copy was stale: "Reply 1 to submit a scheduled fixture" vs the
  current "1. Submit this match's score for the first time / 2. Change a score that
  was already submitted", no numbered pick-when-several-matches step, no
  submission-window rule (today + last 7 days, future fixtures deferred as
  `confirmed_pending`).
- Escape hints were outdated: guide only documented the bare `CANCEL` word, not the
  `1. Cancel / 2. Start again` prompt footer or `CANCEL/START` on match lists.
- The guide had no coverage for two welcome-menu options: 3 (Create an EFA account)
  and 5 (Tournament applications).

## Fix (all in `scripts/generate-onboarding-pdf.tsx`)
1. **New `GettingStartedPage`** inserted in the `doc` tree between `InfoPage` and
   `AiGuidePage` (now 7 pages: Cover, Rules, Drops, Info, Getting Started, AI Guide,
   Backdoor). Three sections:
   - *Start a Conversation with the EFA AI* — reproduces the numbered welcome menu
     (1 Send a match result / 2 Opponent did not respond / 3 Create an EFA account /
     4 Check backdoor applications / 5 Tournament applications) and the
     `1. Cancel / 2. Start again` + `CANCEL/START` escape hints.
   - *Create Your EFA Account* — reply 3, choose a username (letters/numbers/
     underscores), already-registered case, and what you get back (username,
     password, login link, group invite, 7-day application window).
   - *Tournament Applications* — reply 5, pick an open season + club, confirm with 1,
     admin review + WhatsApp notification.
   - Added a `checkRowLast` style (like `checkRow` but no bottom margin) for the last
     numbered menu row.
2. **`AiGuidePage` — "Submit a Result" steps rewritten** to current copy: 1 send
   screenshot (or reply 1 at menu) → 2 choose first-time vs change-already-submitted
   (1/2) → 3 type "Team A vs Team B" → 4 pick the match by number if several match →
   5 confirm YES + forfeit question → 6 "Result submitted!" + standings link. Added
   a closing *Submission window* row (today + last 7 days; future fixtures saved and
   auto-confirmed on match day).
3. **`AiGuidePage` — Reply Commands**: `CANCEL` row expanded to name the
   `1. Cancel / 2. Start again` footer and `CANCEL`/`START` on match lists; added a
   `START` row (back to welcome menu).
4. **`InfoPage`** — "Submitting Your Result" now says reply 1 at the menu (or just
   send a screenshot); "Backdoor" row now says reply 2 at the menu (or send
   "backdoor").
5. **`BackdoorGuidePage`** — step 1 is now "Reply 2 at the welcome menu — or send
   'backdoor'"; "Check your applications" now also mentions replying 4 at the menu.

## Verification
`npm run generate-onboarding-pdf` writes `public/EFA-Onboarding.pdf` (rewritten
9 Sept 2026, ~428 KB); `npx tsc --noEmit` passes. PDF binary itself can't be
previewed in this toolchain — layout verified by code review of the doc tree.

## Context chain (by path)
- Welcome menu / first-contact behaviour documented here:
  `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md`
- Escape hints documented here:
  `.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md`
- Word-based CANCEL/START on match lists:
  `.opencode/context/whatsapp-ux/match-list-word-hint_2026-08-30.md`
- Numbered confirm menu + submission window:
  `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
- Account-creation flow the guide now covers (option 3):
  `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`