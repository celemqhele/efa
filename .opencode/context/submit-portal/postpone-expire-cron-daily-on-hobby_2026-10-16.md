# Postpone expiry cron moved to a daily schedule (Vercel Hobby cron limit) and the deploy pipeline repaired

Fixed the reason the earlier postponement work never went live: the hourly
`expire-postpone-requests` cron (`0 * * * *`) is rejected by the Vercel **Hobby**
plan, which only allows crons that run **once per day**. Because `vercel.json` is
validated at deploy time, every deploy attempt failed with
`Hobby accounts are limited to daily cron jobs`, so production kept running
2-day-old code. The cron is now daily (`30 23 * * *`), and production was
deployed and verified.

Follows up
`.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
and `.opencode/context/submit-portal/postpone-one-at-a-time-and-cooldown_2026-10-16.md`
- both of which had been pushed to `origin/main` but were **not actually live**
until this file's deploy.

## Problem

1. **The deploy was failing, silently from the app's point of view.** Running
   `vercel --prod` returned:
   `"message": "Hobby accounts are limited to daily cron jobs. This cron
   expression (0 * * * *) would run more than once per day."` Vercel validates
   `vercel.json` crons during deploy, so the whole deployment was rejected.
2. **`git push` does not deploy this project.** `vercel ls efa-fxyk` showed the
   newest deployment was 2 days old, and every deployment was authored by
   `celemqhele` via the CLI (no Git metadata). The project has **no Git
   integration** wired up, so pushing to `main` does nothing on Vercel. Combined
   with (1), both `b1404e8` (grace/24h + auto-backdoor, from
   `portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`) and
   `7966b89` (one-at-a-time + cooldown, from
   `postpone-one-at-a-time-and-cooldown_2026-10-16.md`) were live nowhere.
3. Symptom the user saw: `https://efa-fxyk.vercel.app/api/cron/expire-postpone-requests`
   returned **404** while `/api/cron/auto-finalise-prev-day` returned 401.

## Fix

### `vercel.json`

- `"/api/cron/expire-postpone-requests"` schedule changed from `"0 * * * *"`
  (hourly, rejected on Hobby) to **`"30 23 * * *"`** - once a day at 23:30 UTC
  (01:30 SAST). That is 30 minutes **before** `auto-finalise-prev-day`
  (`0 0 * * *`), so the dedicated expiry + requester notification fires first
  (see below for why the order matters).

### `app/api/cron/expire-postpone-requests/route.ts`

- Header comment updated from "Hourly (see vercel.json)" to "Daily (see
  vercel.json - the Hobby plan only allows one run per day)". Logic unchanged.

### `app/api/cron/auto-finalise-prev-day/route.ts`

- Comment only: "the hourly expire cron normally gets there first" -> "the daily
  expire cron normally gets there first". Logic unchanged.

### Why a daily cron is enough for the 24h rule

The "declined after 24 hours" contract is **not** dependent on the cron:

- `respondToPostpone` in `app/api/submit-match/route.ts` has the 24h guard and
  refuses a late accept outright ("this guard enforces the same rule in case the
  cron has not run"), so an opponent cannot accept after 24h.
- `auto-finalise-prev-day` (daily, allowed) also expires stale `pending` requests
  so a fixture can never hang forever on an unanswered request.
- The `expire-postpone-requests` cron's unique value is the **requester
  notification** (`Postponement declined` push + in-app, plus the
  `postpone_request_expired` audit row) - `auto-finalise-prev-day`'s stale-expiry
  block declines the row but does **not** notify. Running expire at 23:30 UTC,
  before auto-finalise at 00:00 UTC, is what keeps that notification firing.

## Verification

- `npx tsc --noEmit` clean.
- `vercel --prod --yes` -> `Deployment completed`, `READY`, production, and
  `Aliased https://efa-fxyk.vercel.app`. Build log shows every route including
  `/api/cron/expire-postpone-requests`.
- Live probes after deploy: `/api/cron/expire-postpone-requests` -> **401**
  (deployed; was 404), `/api/cron/auto-finalise-prev-day` -> 401, `/` -> 200.
- The deploy was run from the working tree that contained `7966b89` plus this
  file's uncommitted `vercel.json` / comment edits, so production matches this
  commit's content.

## Deploy process (important for future sessions)

- This Vercel project is **not** connected to GitHub. `git push origin main` does
  **not** deploy. To ship, run `vercel --prod --yes` from the repo root (the CLI
  is installed and authenticated as `celemqhele`; the project link lives in
  `.vercel/repo.json`, project `efa-fxyk`, team `celemqheles-projects`).
- Vercel **Hobby** plan: crons must run **once per day**. Never add an hourly (or
  more frequent) schedule to `vercel.json` or the deploy will be rejected.
- `vercel ls efa-fxyk` lists deployments; the token in
  `%APPDATA%\com.vercel.cli\Data\auth.json` is an OAuth token that the CLI
  refreshes (calling the REST API directly with it can 403 until refreshed).

## Context chain (by path)

- Grace + 24h window + auto-backdoor (first pushed but not deployed until now):
  `.opencode/context/submit-portal/portal-one-day-grace-24h-postpone-and-auto-backdoor_2026-10-16.md`
- One-at-a-time + cooldown (also only went live with this deploy):
  `.opencode/context/submit-portal/postpone-one-at-a-time-and-cooldown_2026-10-16.md`
- One-off limbo cleanup script referenced by the file above:
  `scripts/resolve-postpone-limbo-2026-10-16.ts`

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
