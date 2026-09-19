# Split the single onboarding PDF into four topic guides

Replaced the one-file EFA onboarding PDF with **four separate PDFs** — Game Settings, Deadlines,
Website, AI — generated from a shared module refactor of
`scripts/generate-onboarding-pdf.tsx`, and fixed the Deadlines guide to document the current
**daily** fixture deadline (14:00 SAST) instead of the stale weekly "Sunday 23:30" copy. This is a
follow-up to the onboarding refresh in
`.opencode/context/whatsapp-ux/onboarding-guide-update_2026-09-01.md`: that pass updated the
welcome-menu/backdoor/account copy but kept the obsolete weekly-deadline text — and the user
wanted the single doc split by topic with a brand-new website section.

## Problem
- One `public/EFA-Onboarding.pdf` (7 pages) covered everything, and its deadlines page still said
  "play before Sunday, deadline 23:30" — contradicted by the code, where fixtures are **daily** and
  each fixture's deadline is `T12:00:00Z` (= 14:00 SAST) on its own date.
- The WhatsApp-AI behaviour (welcome menu, submit-result steps, backdoor) and the website UI were
  mixed into the same doc; the website itself was never documented at all (no coverage of login,
  fixtures/results/standings pages, profile/avatar upload, how tournaments and leagues work, or how
  to find and message managers).

## Fix
### New script layout (all under `scripts/`)
- `scripts/guide/shared.tsx` — fonts, colours, full `StyleSheet`, and reusable building blocks
  (`CoverPage`, `PageHeader`, `Footer`, `Section`, `Card`, `Row`, `CheckRow`, `Intro`, `Label`,
  `Gold`, `Warn`) extracted verbatim from the old script.
- `scripts/generate-guide-pdfs.tsx` — main entry: renders 4 documents to 4 files in `public/`.
- `scripts/guide/settings.tsx` → `public/EFA-Guide-GameSettings.pdf` (Doc 1).
- `scripts/guide/deadlines.tsx` → `public/EFA-Guide-Deadlines.pdf` (Doc 2).
- `scripts/guide/website.tsx` → `public/EFA-Guide-Website.pdf` (Doc 3).
- `scripts/guide/ai.tsx` → `public/EFA-Guide-AI.pdf` (Doc 4).
- `package.json` script renamed `generate-onboarding-pdf` → `generate-guide-pdfs`.

### Doc 1 — Game Settings
Match Settings (10 min, any/neutral stadium, injuries OFF, 6 subs, conditions excellent, team kit),
Gameplay Rules (no Smart Assist/cheating, quitting = loss, disconnect replay), Playing Your Match
(home team creates the matchroom), and the full connection-drops disconnect/restart table.

### Doc 2 — Deadlines (rewritten for the current daily system)
Sourced from code/copy: fixtures released by admins with per-day dates (up to 8/day per tournament,
max 1 match per team per day); **deadline 14:00 SAST on the fixture's own date**, no weekly Sunday
sweep; Report Waiting window 13:00–14:05 SAST with auto-settlement at 14:05 (reporter wins 3-0,
both absent → 0-0); backdoor window opens Thursday, submissions expire Tuesday; result submission
window today ± 7 days with future results auto-confirmed at 00:00 on match day; forfeit rule
(+3 score adjustment, −3 GD season-end penalty, carry-over to next meeting) and vacant-seat auto
0-3.

### Doc 3 — Website
Account/register/login, navigation (desktop bottom bar Home/Fixtures/Results/Standings; mobile tabs
+ More sheet), Home page widgets, My Fixtures + fixture detail (matchroom code/instructions, submit
score, banter board, disconnect rules), Results + result detail (stats, screenshot), Standings
(Competition switcher, league vs group tables, top-3 gold, zones), Teams & **finding managers**
(fixture opponent links, team-page "vs @manager" + Message button, calendar, manager profiles —
no `/managers` listing page exists, discovery only), Calendar, Polls, Hall of Fame, Rules,
Notifications, Profile & settings (**change profile picture**, phone, theme, change password, apply
to a season), and a "How tournaments & leagues work" page (PL round-robin league, UCL/EL groups →
two-legged knockouts with aggregate → pens, Super Cup single final, friendlies, vacant seats).

### Doc 4 — AI (all WhatsApp-bot content consolidated)
Numbered welcome menu (1–5), create-an-account (reply 3), 6-step submit-a-result flow + submission
window, reply commands (SWAP / EDIT SCORE / check other date / fixtures / CANCEL / START), check
fixtures, screenshot fallback, tournament applications (reply 5), and the full backdoor funnel +
check applications (reply 4).

## Verification
`npx tsc --noEmit` passes and `npm run generate-guide-pdfs` writes all four PDFs
(397–417 KB each, ~7-Sep timing). PDF binaries can't be previewed in this toolchain — layout
verified by code review of the doc trees. `next lint` clean for the changed files (pre-existing
warnings only).

## Context chain (by path)
- Prior onboarding refresh this replaces/supersedes:
  `.opencode/context/whatsapp-ux/onboarding-guide-update_2026-09-01.md`
- Welcome-menu / escape-hint copy reused in the AI guide:
  `.opencode/context/whatsapp-ux/welcome-menu-and-input-cleanup_2026-08-29.md` and
  `.opencode/context/whatsapp-ux/numbered-cancel-restart-hint_2026-08-30.md`
- Daily scheduling / deadline values documented here:
  `.opencode/context/fixture-scheduling/matchday-cap-5-to-8_2026-09-02.md`
- Submission window (today ± 7, confirmed_pending) documented here:
  `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`
  and `.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md`
- Backdoor window (Thursday open / Tuesday expiry) in:
  `.opencode/context/backdoor/backdoor-admin-override_2026-08-15.md`
- Account-creation flow covered in the AI guide:
  `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`
- Vacant-seat auto-forfeit covered in the website guide:
  `.opencode/context/user-based-competitions/vacant-display-and-auto-forfeit_2026-08-30.md`

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `scripts/generate-onboarding-pdf.tsx` | Old single-PDF generator (superseded by `scripts/generate-guide-pdfs.tsx` + `scripts/guide/*`) | `.recycle/onboarding-guide-split/generate-onboarding-pdf.tsx` |
| `public/EFA-Onboarding.pdf` | Old single onboarding PDF (replaced by the four `public/EFA-Guide-*.pdf`) | `.recycle/onboarding-guide-split/EFA-Onboarding.pdf` |