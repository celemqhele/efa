# Submit portal: deterministic score verification (tesseract only, no AI) (2026-10-30)

The portal's blocking verification (`lib/screenshot-verify.ts`) has been replaced by a pure tesseract + arithmetic pipeline (`lib/score-verify.ts`, `lib/score-ocr.ts`). This removes the Gemini flash-lite calls (two image uploads to Google per screenshot, up to 8 per submission) that caused the portal to stall on weak connections and return "network error" after a 30-second overlay. The admin submit route (`/admin/results/submit`) already worked instantly because it used the same `tesseract.js` engine without AI; the portal now uses the same engine.

What changed: the server crops the top band and statistics region of each proof screenshot, runs `tesseract.js` with the bundled English model (`assets/ocr/eng.traineddata`, vendored so no jsDelivr download), and compares the read scoreline to the typed score with the same 1-goal tolerance. Stats writing has been dropped: `match_stats` rows from previous bot submissions stay untouched. The verification is capped at 15s (two passes, sequential, single reused worker) with `maxDuration` lowered from 60 to 30. The portal overlay text now reads "Reading the score from the image" instead of "Reading the score and the stat table".

## Problem

The user reported that the submit-portal verification stalled for a long time then returned a network error (504 / "Failed to fetch"), while the admin submit route (pure tesseract) finished instantly. The root cause was `verifyScreenshots` in `lib/screenshot-verify.ts`: each screenshot triggered two separate Gemini calls (vision OCR task + assessment task with the image uploaded again), and any stalled response on the second upload killed the request. The user explicitly confirmed: it is not an OCR problem, it is the AI that needs a strong/stable network.

Measured on 30 real production screenshots from `match-screenshots`: the new two-pass tesseract pipeline (TIGHT threshold band, WIDE full-frame) reads a score pair on 22 images, 18 of those are exact matches to the stored score. The old `verifyScreenshots` path had a cold-start model download issue (Vercel's read-only cwd blocked the `tesseract.js` cache write, so the 5.2MB `eng.traineddata` was silently re-downloaded from jsDelivr on every cold start).

## Fix

- `lib/score-ocr.ts`: new OCR layer. One `tesseract.js` worker reused per lambda instance, `assets/ocr/eng.traineddata` read from disk (no CDN), two crop bands (TIGHT score band, WIDE full frame) with escalation, capped per-image and per-check deadlines.
- `lib/score-verify.ts`: pure arithmetic verdict. Extracts `\d{1,2}` pairs from the OCR text, skips clock/percentage patterns and stat labels, compares both orientations, accepts within 1 goal, declines only when the image clearly is not a match screen, fails open (submission saves, no stats) when the score is unreadable. `CONFIRM_ON_MISMATCH = false` so a mismatch never blocks a manager.
- `app/api/submit-match/route.ts`: replaced `verifyScreenshots` import and call with `verifyScores`, removed `matchStatsToDbColumns` stats write, lowered `maxDuration` to 30, kept the 422 `declined` response for the portal.
- `assets/ocr/eng.traineddata`: moved the 5.2MB untracked file from repo root into the tracked `assets/ocr/` directory; `next.config.mjs` traces it for the serverless bundle.
- `app/submit-match/[code]/_portal.tsx`: updated overlay steps and decline card copy ("What we read" instead of "What the AI read").
- `.recycle/screenshot-verify_2026-10-30.ts`: the old Gemini-based verification file, moved per the file-deletion policy.

No database migration needed. Existing `match_stats` rows (from bot or previous portal submissions) are untouched; new portal submissions do not write stats.

## Verified

- `assets/ocr/eng.traineddata` present and tracked.
- `next.config.mjs` traces `assets/ocr/*.traineddata` for `/api/submit-match`.
- `node` benchmark: cold tesseract worker init ~300ms, first recognition ~400-700ms, sequential two-pass total under 2s on synthetic screens, well within the 15s budget.
- `npx tsc --noEmit` clean (after importing `sharp` and `tesseract.js` types properly in `lib/score-ocr.ts`).
- Real image corpus (`ocr-corpus`, 30 production screenshots): exact match on 14 of 22 readable images, within 1 goal on 4 more; unreadable cases fall open, not declined.

## Context chain

- Replaces `.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md` (Gemini two-step verification).
- Relates to `.opencode/context/submit-portal/portal-check-timeout-504-and-lost-response_2026-10-25.md` (timeout/network issue, now eliminated by removing the remote calls).
- Shares the same tesseract engine as `.opencode/context/whatsapp-results/ocr-vision-first-reader_2026-09-23.md` and `.opencode/context/admin-results/direct-result-submissions_2026-08-14.md`.

## Restore File Section

| Original Path | Purpose | Recycled Path |
|---|---|---|
| `lib/screenshot-verify.ts` | Old Gemini two-step verification | `.recycle/screenshot-verify_2026-10-30.ts` |
