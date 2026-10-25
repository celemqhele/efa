# Submit portal: "Checking your screenshots" failed with a 504 / error while the result was on file (2026-10-25)

The blocking AI screenshot check in the submit portal no longer runs unbounded.
Its Gemini calls now have a hard per-attempt timeout and a shared budget, the
web-push notify that runs AFTER the result write is capped too, the portal
re-reads itself before showing an error (a lost reply for a saved result now
shows the success panel), and the replay screenshots are actually attached
(this was silently broken by a form-key mismatch). This is a follow-up to the
AI-verification release in
`.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`
and its upload fix in
`.opencode/context/submit-portal/portal-failed-to-fetch-and-replay-toggle_2026-10-20.md`.
After those, managers kept reporting that the "Checking your screenshots"
overlay ended in an error even though the result was already saved.

## Problem

### Evidence from the Vercel runtime logs (2026-10-25)

```
19:00:01 POST /api/submit-match 504 error Vercel Runtime Timeout Error: Task timed out after 60 seconds
19:01:06 POST /api/submit-match 504 error Vercel Runtime Timeout Error: Task timed out after 60 seconds
18:52:24 POST /api/submit-match 200 [verify] vision OCR failed: Error: Gemini failed (503) high demand
18:51:45 POST /api/submit-match 200 [verify] assessment failed: Error: Gemini failed (503) high demand
```

So there were two separate stalls that both surface on that overlay:

1. **Before the write: Gemini can hang.** `callGemini` used a bare `fetch`
   with no timeout. A Gemini request that opens the socket but never answers
   (503 "high demand" behaves exactly like this) kept the POST alive until the
   platform killed the function at `maxDuration = 60`. The browser then got a
   504 HTML page instead of JSON, and `send()` fell back to the generic
   "Something went wrong. Try again." The fail-open design was already right,
   it was just never reached because the fetch never settled.
2. **After the write: web-push has no timeout.** `notifyAllAdmins` is awaited
   after the result is upserted, and `webpush.sendNotification` has no time
   limit. A slow push endpoint held the response open for the rest of the
   function window. Past 60s the request 504s even though the result, fixture
   status and audit row are already on file, which is exactly "it threw an
   error but the result was saved". The 18:52 run shows the shape of it: the
   result row was written at 18:52:07, the audit row at 18:52:10, but the
   response only logged at 18:52:24 (14s of post-write tail for one
   screenshot).

### Also found while in this flow

The replay screenshots never reached the server. `ResultPanel` built the form
with keys `extraScreenshot0`, `extraScreenshot1`, ... (via `formFor` /
`fd.set`), but `app/api/submit-match/route.ts` reads
`form.getAll('extraScreenshot')`. `getAll` cannot see suffixed keys, so every
"play many times" upload was dropped without any error (`extra_screenshot_urls`
stayed null on every result).

## Fix

### `lib/screenshot-verify.ts`: bounded Gemini calls

- New constants `CALL_TIMEOUT_MS = 10_000`, `VERIFY_BUDGET_MS = 30_000`,
  `MIN_ATTEMPT_MS = 1_500`.
- `geminiAttempt(parts, timeoutMs)` runs one request under an `AbortController`
  timer that also covers reading the body (`res.text()`), so a stalled
  connection or a stalled body read is aborted instead of hanging.
- `callGemini(parts, deadline)` clamps each attempt to
  `min(CALL_TIMEOUT_MS, deadline - now)`, refuses to start with less than
  `MIN_ATTEMPT_MS` left, and keeps the existing single retry on 429/503 (the
  sleep is clamped to the remaining budget).
- `readScreenshot` / `assessScreenshot` take the deadline;
  `verifyScreenshots` creates one deadline (`startedAt + VERIFY_BUDGET_MS`) for
  both waves. Worst case the whole check answers in roughly 30s, leaving 30s of
  the 60s function for uploads, result writes, standings and notify. A timed
  out screenshot is treated exactly like any other unreadable one: skipped,
  incomplete stats, submission allowed (fail open).

### `lib/push.ts`: each push capped at 5s

- New `sendWithTimeout()` helper (`PUSH_TIMEOUT_MS = 5_000`) wraps each
  `webpush.sendNotification` call in both `sendPushToUser` and
  `sendPushToUsers`, clearing its timer in `finally`.
- `Promise.allSettled` treats a timed-out device as a rejected result, so the
  existing logging reports it and the 410/404 dead-endpoint pruning is
  unaffected. Notifications are written to the DB before the push, so only the
  live push for that device is skipped.

### `app/submit-match/[code]/_portal.tsx`: honest verdicts + extras

- `refresh()` now returns the fresh portal state (still swallowing errors and
  keeping the last known state).
- `send()` remembers the result on file before the POST
  (`screenshotUrl` + scores). On a 502/504 it sets a specific message ("The
  screenshot check took too long to answer and the connection closed...")
  instead of leaking the failed JSON parse. Then, before showing ANY error, it
  refreshes and compares: if the match now carries a different result (new
  `screenshotUrl`, or different score), the submission landed and the success
  panel is shown as "Result saved ... The reply did not reach your browser, but
  the result is on file and the match page is up to date." An error banner is
  only shown when nothing was written.
- The replay upload builds the `FormData` then `fd.append('extraScreenshot', f)`
  once per extra, so the repeat key matches the server's
  `form.getAll('extraScreenshot')`.

## Verified

- Ad-hoc harness against `verifyScreenshots` with a mocked `fetch`:
  hanging socket -> `ok: true, failOpen: true` after 10.0s; immediate 503 x2 ->
  fail open after 1.2s; normal response -> accepted with stats, 0ms.
- `npx tsc --noEmit` clean.
- `npx next lint` on the three touched files clean.
- `npx next build` succeeds (`/submit-match/[code]` 12 kB / 199 kB first load).
- `public/sw.js` restored with `git checkout --` after the build rewrote it.

## Context chain (by path)

- The AI check this bounds:
  `.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`
- The "Failed to fetch" / replay toggle fix this follows:
  `.opencode/context/submit-portal/portal-failed-to-fetch-and-replay-toggle_2026-10-20.md`
- The old background-OCR behaviour it replaced:
  `.opencode/context/submit-portal/portal-background-ocr-stats_2026-10-07.md`
- Push delivery / logging on the same project:
  `.opencode/context/whatsapp-delivery/webhook-send-and-status-logging_2026-10-07.md`
- Prior platform-limit incident on the same project:
  `.opencode/context/deploy-performance/middleware-timeout_2026-08-28.md`

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
