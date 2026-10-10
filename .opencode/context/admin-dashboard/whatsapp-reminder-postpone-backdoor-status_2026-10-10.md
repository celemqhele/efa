# Dashboard WhatsApp reminders: acknowledge pending postponements and backdoor reports

The admin dashboard reminder templates (`components/ui/DashboardFixtureActions.tsx`) now add a status line when the fixture has a live postponement request or a backdoor report, per side. Previously every reminder read the same generic "message your opponent / submit" text, so a manager who had asked to postpone, or who had been reported as not responding, got a reminder that ignored what was actually happening. This is a follow-up in the reminder-template chain (`.opencode/context/admin-dashboard/whatsapp-reminder-single-bold-submit-cta_2026-10-08.md`, `.../whatsapp-reminder-opponent-number-bold-label_2026-10-08.md`), triggered by the user after the postpone/backdoor flows shipped in `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`.

## Problem

The due-fixtures reminder (the H/A WhatsApp buttons on the admin dashboard "Fixtures Due" table) used a fixed 4-line template: greeting, fixture, opponent number, submit link. It had no idea that:

- a manager had filed a postponement request that was still `pending` — the requester got no acknowledgement it was in progress, and the opponent (who must accept/decline) got no prompt;
- a backdoor "opponent not responding" report was live — the submitter got no acknowledgement, and the reported manager was never told a report existed (nor given the screenshot, even though the screenshot is their own chat).

## Fix / Implementation

- `components/ui/DashboardFixtureActions.tsx`
  - New optional props: `postponeRequest?: { requesterSide: 'home'|'away'; newDateLabel: string|null }` and `backdoorReports?: Array<{ reportedSide: 'home'|'away'; screenshotUrl: string|null }>`.
  - `buildReminder()` gained `postpone?: { role: 'requester'|'reviewer'; newDateLabel }` and `backdoor?: { role: 'submitter'|'reported'; screenshotUrl }`. It now pushes status line(s) after the fixture line and always keeps the opponent-number line and the single bold submit CTA last.
  - Per side (`postponeForSide` / `backdoorForSide`): the requester sees "Your postponement request is being processed. Waiting for your opponent to accept (asked for <date>)."; the reviewer sees "Your opponent asked to postpone this match to <date>." + "Accept or decline the request before the deadline.". The backdoor submitter sees "Your backdoor report is being processed. The admin will review it."; the reported side sees "Your opponent reported you as not responding for this match." + the screenshot (signed URL, else a link to the match page).
- `app/(admin)/admin/dashboard/page.tsx`
  - After the due-fixtures query, fetches `postpone_requests` (`status='pending'`) and `backdoor_submissions` (`status='pending'`) `.in('fixture_id', dueIds)`, then annotates each fixture row with `_postpone` (requester side resolved by comparing `requested_by` to the home manager id; `newDateLabel` via a new `formatDateLabel`) and `_backdoors` (mapping `side_claimed` → `reportedSide`).
- `app/(admin)/admin/dashboard/_desktop.tsx` and `_mobile.tsx`: pass `postponeRequest={fx._postpone ?? null}` and `backdoorReports={fx._backdoors ?? []}` into `DashboardFixtureActions`.

## Facts / model

- `postpone_requests.status` only has `pending|accepted|declined`; a `partial unique (fixture_id) where status='pending'` means at most one live request per fixture. `requested_by` is a profile UUID (portal path); there is also `requested_by_phone`.
- `backdoor_submissions.side_claimed` is the side that did NOT respond (the reported side); the submitter is the opposite side (`lib/backdoor-notify.ts`). Live statuses are `pending` (unreviewed), `approved`/`declined` (reviewed). A fixture is only `due` while its backdoor is still `pending` (an approval writes a result, taking it off the due list), so the dashboard filters `status='pending'`.
- `backdoor_submissions.screenshot_url` is a 1-year signed URL from `uploadToBucket`, so it can be linked directly.
- Accepted postponements no longer show here: the request flips to `accepted`, so it drops out of the pending map, and the fixture's `scheduled_date` moved to the new date (see `.opencode/context/submit-portal/portal-postpone-window-and-status_2026-10-08.md`).
- The manage page (`/admin/fixtures/manage`) also renders `DashboardFixtureActions`, but the new props are optional so it keeps the original 4-line template (out of the requested dashboard-only scope).

## Verification

- `npx tsc --noEmit` clean; `next lint` on the four touched files clean.
- Message output checked by replicating `buildReminder` for the four cases (requester / reviewer / backdoor submitter / backdoor reported).

## Files touched

- `components/ui/DashboardFixtureActions.tsx`
- `app/(admin)/admin/dashboard/page.tsx`
- `app/(admin)/admin/dashboard/_desktop.tsx`
- `app/(admin)/admin/dashboard/_mobile.tsx`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
