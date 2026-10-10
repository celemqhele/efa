# Public upcoming listings include confirmed_pending

Added `confirmed_pending` to every public "upcoming" fixture filter so a
future-dated result submitted ahead of its matchday stays listed under
scheduled/confirmed (with its "Pending"/"Awaiting" pill) instead of vanishing from
the site. The user reported it while testing the portal flow home → fixtures →
match page → submit result: a result submitted early for a future game was accepted
but the fixture then disappeared from the upcoming lists. Follow-up to
`.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md` and
`.opencode/context/whatsapp-results/confirmed-pending-sast-day-release_2026-10-02.md`
(status + release rule), and to
`.opencode/context/home-upcoming-widget/home-upcoming-widget_2026-08-15.md` (which
removed `confirmed` from the widget and left the filter at
`scheduled`/`awaiting_confirmation`).

## Problem

`app/api/submit-match/route.ts` parks a future-dated (`isFuture`) submission as
`confirmed_pending` (line 292), correctly holding it out of the standings until the
day-of flip (`app/api/cron/flip-pending`). But the public "upcoming" queries only
included `scheduled` and `awaiting_confirmation` (plus `postponed_confirmed`), so a
`confirmed_pending` fixture matched neither the upcoming nor the past list and
became invisible. The fixtures page already had a `confirmed_pending` status pill
(`'Pending'`) defined in `app/(public)/fixtures/_desktop.tsx`, so the intent was to
show these — the filters were the oversight.

## Fix

Added `confirmed_pending` to the upcoming membership, everywhere it is defined:

- `app/(public)/fixtures/page.tsx` — `upcomingStatuses` set now
  `['scheduled', 'awaiting_confirmation', 'confirmed_pending']` (the "My Fixtures"
  page).
- `app/page.tsx` — both `.or('status.in.(...)...')` filters (next-matchday probe and
  the batch fetch) now include `confirmed_pending` (home "Upcoming" widget).
- `app/(public)/teams/[id]/page.tsx` — the team profile upcoming `.or(...)` filter.
- `app/(public)/teams/[id]/fixtures/page.tsx` — the `isUpcoming()` split predicate.

The public fixtures page renders the pre-submitted score with the `Pending` pill for
these fixtures (same as the existing confirmed_pending rendering in
`app/(public)/fixtures/_desktop.tsx` and the calendar), which is the intended
"still scheduled/confirmed but not yet released" display.

## Deliberately not changed

Admin-only "due"/"submittable" filters were left as-is, because a `confirmed_pending`
fixture has already been submitted and is not awaiting admin action:

- `app/(admin)/admin/dashboard/page.tsx` due-fixture query.
- `app/(admin)/admin/results/submit/page.tsx` + `ResultSubmitClient.tsx` "Sched."
  filter.
- `app/(admin)/admin/fixtures/manage/FixtureActions.tsx` submit-button condition.

`app/submit-match/[code]/_portal.tsx` already labels `confirmed_pending` as
"Pending release".

## Verification

- `npx tsc --noEmit` clean.
- `npx next lint` on the changed public files: no warnings/errors.

## Context chain (by path)

- Status introduced: `.opencode/context/whatsapp-results/confirmed-pending-result_2026-08-30.md`
- SAST day release: `.opencode/context/whatsapp-results/confirmed-pending-sast-day-release_2026-10-02.md`
- Home widget filter history: `.opencode/context/home-upcoming-widget/home-upcoming-widget_2026-08-15.md`

## Restore File Section
No repo files were deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
