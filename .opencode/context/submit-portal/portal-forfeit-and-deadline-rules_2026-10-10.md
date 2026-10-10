# Portal forfeit option, carry-over balance application, deadline enforcement, and fixture submit CTA (10 Oct 2026)

Added a "Mark as forfeit?" yes/no option to the web submission portal result form with automatic +3 goal awarding and forfeit balance creation, wired portal result submission to apply active forfeit carry-over balances with applied-forfeit notes and "Open the match" CTAs across portal and public fixture/result pages, enforced post-deadline locks against postponing or changing settled results, wrapped the portal in the site shell (`PageWrapper`), and added a context-aware "Submit for this match" / "Change score" button under the hero view on public fixture pages. The user requested these additions following earlier attribution and export updates documented in `.opencode/context/submit-portal/portal-attribution-who-submitted_2026-10-10.md`.

## Problem

Managers needed a way to mark matches as forfeits directly on the submit match portal (`/submit-match/[code]`), have active forfeit balance carry-overs automatically applied when submitting results, prevent post-deadline postponements and score edits, and access the submission portal directly from their own fixture detail pages with clear "Submit for this match" or "Change score" CTAs.

## Fix / Implementation

1. **Portal Forfeit Submission**:
   - `app/submit-match/[code]/_portal.tsx`: Added a "Mark as forfeit?" yes/no dropdown field to `ResultForm`.
   - `app/api/submit-match/route.ts`: When `forfeit === 'yes'`, validated that scores are not level, identified the loser as the lower score side, added `+3` goals to the winner, recorded `is_abandoned=true` and `abandoned_type`, and inserted a `forfeit_balances` row carrying the final recorded winner score.
2. **Forfeit Balance Carry-Over Application**:
   - `app/api/submit-match/route.ts`: When submitting a normal result, checks for active forfeit balances (`remaining > 0`) for either fixture manager, adds the carried score to the result, marks balances consumed (`remaining = 0`), and records an override reason `forfeit_note:${bal.fixture_id}:${note}`.
   - Public pages (`app/(public)/fixtures/[id]` & `app/(public)/results/[id]` desktop/mobile views): parses `forfeit_note:` from `results.override_reason` and renders the descriptive sentence with an "Open the match" CTA link (`/fixtures/[fixture_id]`).
3. **Deadline Enforcement**:
   - `lib/submit-match.ts` (`deadlineBlock`) & `app/api/submit-match/route.ts`: Blocks new postponement requests and score modifications on settled (real) results once the match's scheduled date has passed (`dateKey < todayKey`) for non-admins.
4. **Site Shell & Fixture Submit CTA**:
   - `app/submit-match/[code]/page.tsx`: Wrapped the portal in `PageWrapper` to include the desktop pill navigation and bottom tab bar.
   - `app/(public)/fixtures/[id]/page.tsx`, `_desktop.tsx`, `_mobile.tsx`: Fetched match codes and admin/manager roles, rendering a "Submit for this match" or "Change score" button under the hero view for own-fixture managers and admins.

## Verification

- `npx tsc --noEmit` passes clean with zero errors.
- `npx next lint` passes clean on all modified files.

## Context Chain (by path)

- Prior portal attribution work:
  `.opencode/context/submit-portal/portal-attribution-who-submitted_2026-10-10.md`
- Forfeit balance history & display work:
  `.opencode/context/forfeit-balances/forfeit-adjusted-display_2026-08-30.md`,
  `.opencode/context/forfeit-balances/forfeit-notification-clarity_2026-08-26.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
