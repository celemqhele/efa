# Submit portal: upload budget + shipping the tesseract score check (2026-11-02)

This change makes the portal's screenshot upload survive the platform's body limit and finally puts the tesseract score check into production. A manager reported "the checking of score is having too many issues. it says could not send the screenshots because of network. my network is fine"; the investigation found two separate faults, neither of which was the manager's connection. This follows `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md`, whose library files were committed in `3f2690e` but whose route/portal/next.config wiring never was, so production was still running the old Gemini check.

## Problem

**Fault 1: production was still calling Gemini.** `vercel logs --environment production --since 72h -q "submit-match"` showed every recent `POST /api/submit-match` returning 200 while logging `[verify] vision OCR failed: Error: Gemini check timed out` / `Gemini failed (503)`, followed by `[verify] every screenshot unreadable -> fail open`. The committed `app/api/submit-match/route.ts` still imported `verifyScreenshots` from `lib/screenshot-verify.ts`; the tesseract `verifyScores` switch existed only in the working tree. A fail-open saves the result, so the manager saw the overlay run for 10s and the check never actually verified anything.

**Fault 2: multi-screenshot uploads were too large for the platform edge.** A probe against the deployed endpoint with anonymous bodies of increasing size proved bodies up to ~4MB reach the function (JSON 401 `Please log in first.`) while 5MB is rejected before it with `HTTP 413 Request Entity Too Large FUNCTION_PAYLOAD_TOO_LARGE`. Requests that die there never appear in the function logs, and Chrome surfaces the refusal as a bare `TypeError: Failed to fetch`, which the portal reported as "Could not send your screenshots. Check your connection and try again." Four phone screenshots at 1-3MB each are comfortably over the cap, which matches the database evidence: `results.extra_screenshot_urls` is always null, so a replay submission with extras has never succeeded.

## Fix

- `lib/compress-image-client.ts`: added a shared upload budget. `TOTAL_PAYLOAD_BUDGET = 3_200_000` (3.2MB across every attached screenshot, with headroom under the ~4.5MB edge cap), `MAX_FILE_BYTES = 1_100_000` per file, and a five-rung quality ladder (1600px q0.8 → 1600px q0.7 → 1280px q0.75 → 1280px q0.65 → 1080px q0.6). New `fitScreenshots(files, opts)` divides the budget fairly in pass 1, re-splits unused headroom in pass 2, and returns `{ files, bytes, tooBig }` so the UI can ask for fewer screenshots instead of letting the platform drop the request. Files that already fit pass through byte-identical.
- `app/submit-match/[code]/_portal.tsx`: `ResultPanel` now runs `fitScreenshots([file, ...extras])` at submit time (not per pick, because four files that each pass a per-file cap still add up), shows a `sizeError` warning naming the total and the 3.2MB limit when the set cannot fit, and only then posts the fitted files. Both pickers compress with `MAX_FILE_BYTES`; a `fitting` flag disables the form while the set re-encodes. The repeated `extraScreenshot` key is preserved (the server reads it with `form.getAll`).
- `app/submit-match/[code]/_portal.tsx` `send()`: added `postScreenshots()` (one automatic retry 1.2s after a network-level failure, safe because a request that never arrived wrote nothing and a duplicate that did land is caught by the existing "is a result already on file?" re-read). Added explicit `res.status === 413` handling with plain advice (remove extras / lower resolution) because that reply is text, not JSON. Reworded the failure banner to "The upload stopped before it reached the server, so nothing was lost" instead of blaming the connection. The check overlay gained an optional `detail` line (`checkDetail`) that shows how many screenshots and how many MB are going up, cleared in `finally`.
- `app/api/submit-match/route.ts`: switched the import and call to `verifyScores` / `MAX_SHOTS` from `lib/score-verify.ts`, lowered `maxDuration` from 60 to 30 (matching the deterministic check's 15s cap), removed the `matchStatsToDbColumns` write, and dropped the now-unused `lib/screenshot-verify.ts` import.
- `next.config.mjs`: `outputFileTracingIncludes['/api/submit-match']` now traces `./node_modules/tesseract.js-core/*.wasm` and `./assets/ocr/*.traineddata` so the bundled model and wasm ship with the function.
- `lib/screenshot-verify.ts`: removed from the tree and archived at `.recycle/screenshot-verify_2026-10-30.ts` per the file-deletion policy (`.recycle/` is gitignored).

Mismatch handling is unchanged: `CONFIRM_ON_MISMATCH = false` in `lib/score-verify.ts`, so the route only acts on `verification.ok` and a mismatch still saves.

## Verified

- Local benchmark of `verifyScores` on 12 real production screenshots: exact score 9, within one goal 1, fail-open 1, declined 0, mismatch 1; per-image 259ms-3.1s, all inside the 15s check cap.
- Edge probe: 0.5/3/4MB bodies reach the route (401), 5MB returns 413 `FUNCTION_PAYLOAD_TOO_LARGE`, confirming the 3.2MB shared budget has headroom.
- `npx tsc --noEmit` clean; `npx next lint` clean on the touched files; `npx next build` succeeds (`/api/submit-match` and `/submit-match/[code]` both build).
- Production check after deploy: logs should show `[score-check]` lines from `lib/score-verify.ts` and no more `[verify] vision OCR failed` / `Gemini failed` fail-opens.

## Known gap / deferred

- Portal submissions no longer write `match_stats` (deliberate, carried over from `portal-deterministic-score-verify_2026-10-30.md`); existing rows are untouched, but new portal results have no stat table unless the bot writes one.
- The end-state fix for the body limit would be a direct-to-storage upload (the `match-screenshots` bucket is private, has no size limit, and already allows authenticated INSERT), with the route receiving only storage paths. That was evaluated and deferred; the shared budget was chosen as the smaller, immediately shippable change.

## Context chain

- Fixes the deploy gap left by `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md` (libraries committed, wiring not).
- Supersedes the oversized-body diagnosis in `.opencode/context/submit-portal/portal-failed-to-fetch-and-replay-toggle_2026-10-20.md` and the timeout handling in `.opencode/context/submit-portal/portal-check-timeout-504-and-lost-response_2026-10-25.md`.
- Related: `.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md` (the multi-upload widget whose extras could never fit).

## Restore File Section

| Original Path | Purpose | Recycled Path |
| --- | --- | --- |
| `lib/screenshot-verify.ts` | Old Gemini-based blocking screenshot verification (replaced by `lib/score-verify.ts`) | `.recycle/screenshot-verify_2026-10-30.ts` |
| `_bench-score.tmp.mts` | Throwaway benchmark harness for `verifyScores` against real screenshots | `.recycle/bench-score_2026-11-02.tmp.mts` |
| `_bench-one.tmp.mts` | Throwaway single-image OCR probe | `.recycle/bench-one_2026-11-02.tmp.mts` |
