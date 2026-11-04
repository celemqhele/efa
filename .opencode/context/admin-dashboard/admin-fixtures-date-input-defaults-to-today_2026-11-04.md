# Admin fixtures postpone date input defaulted to today

## What was done
Fixed the `datetime-local` "New Date & Time" input in `app/(admin)/admin/fixtures/manage/FixtureActions.tsx` so it no longer collapses to today for fixtures whose `scheduled_date` is date-only. Also reconciled the remaining admin fixture scheduling entry points (`schedule-fixtures`, `start-tournament`, `FixtureScheduler`, `export`) to derive "today" from `getSastDateKey()` instead of UTC/server-local `new Date()`.

## Problem
`FixtureActions` initialised its postpone input with `currentDate ? currentDate.slice(0, 16) : ''`. `currentDate` is `fx.scheduled_date`, which is a plain `YYYY-MM-DD` date string (no time component), so `slice(0, 16)` produced `YYYY-MM-DD` — an invalid value for an `<input type="datetime-local">`, whose required shape is `YYYY-MM-DDTHH:MM`. Browsers render an invalid `datetime-local` value as the current date, so the postpone dialog opened showing today for every fixture regardless of its actual matchday. That is what made "every date look tagged as today" under fixtures admin.

The secondary issue is consistency: several admin scheduling paths derived "today" with `new Date().toISOString().split('T')[0]` / `format(new Date(), 'yyyy-MM-dd')`, which on Vercel (UTC) can lag SAST by a day and mis-anchor newly scheduled fixtures.

## Fix
- `FixtureActions`: when `currentDate` has no `T`, append `T00:00` so the input receives a valid `datetime-local` value (`YYYY-MM-DDT00:00`).
- `schedule-fixtures/route.ts`, `start-tournament/route.ts`, `FixtureScheduler.tsx`, `export/page.tsx`: use `getSastDateKey()` instead of UTC/server-local date derivation.

## Related files
- `lib/app-time.ts` — `getSastDateKey()`
- `.opencode/context/link-previews/link-previews_2026-09-27.md` — documents the `scheduled_date` DATE driver trap.