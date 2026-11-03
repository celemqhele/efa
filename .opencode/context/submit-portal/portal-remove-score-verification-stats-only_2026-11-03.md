# Submit portal: score verification removed, OCR kept for match stats (2026-11-03)

Removed the blocking score check from the submit-match portal. A manager's score is now saved exactly as typed, with no comparison against the screenshot, no decline path and no checking overlay. The proof screenshots are still read with the existing OCR pipeline, but only in an `after()` background task that fills `match_stats`; it can never delay or fail the submission. The user reported that "the score verification causes too much errors" and asked for OCR for the inserted stats only, then submit.

## Problem

The portal's deterministic tesseract score check (`lib/score-verify.ts` + `lib/score-ocr.ts`, shipped in `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md` and wired to production in `.opencode/context/submit-portal/portal-upload-budget-and-tesseract-deploy_2026-11-02.md`) still produced the exact class of failure the managers were complaining about: the check ran inside the blocking POST, so every screenshot had to be read before anything was written. A slow/ambiguous read held the submit button for the whole OCR pass, and the 422 decline card rejected legitimate uploads when the reader picked the wrong pair of digits. The portal also had no stat table at all because the earlier verification switch deliberately dropped the `match_stats` write (see `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md`, "Stats writing has been dropped").

## Fix

- `app/api/submit-match/route.ts`
  - Removed the `verifyScores` import and the whole blocking check block, including the `422 { declined: true }` response and the `verification` result.
  - `MAX_SHOTS = 4` is now a local route constant (the old export lived in the deleted `lib/score-verify.ts`).
  - `maxDuration` raised back to 60 because a background stats read is the only remaining time consumer.
  - After the result, fixture status, standings, knockout progression, audit and admin notification are all written, the route captures the screenshot buffers and registers `after(...)`. The background task calls `readPortalStats`, deletes any existing `match_stats` row for the result and inserts the fresh one. Any error is logged and swallowed.
  - Walkovers (`givenWin`) skip stats entirely; a walkover has no played score to align against.
- `lib/portal-stats.ts` (new)
  - `readPortalStats(shots, typedHome, typedAway)` runs `analyzeImageBuffer` (the same vision + text-LLM + tesseract ladder the WhatsApp bot uses) on each attached screenshot.
  - A screenshot is used only when its read scoreline equals the typed score straight or reversed, so a wrong/old screenshot cannot attach stats to this fixture. Reversed reads have their home/away stat values flipped.
  - Stats from the main and replay screenshots are merged (first non-null wins) and mapped through `matchStatsToDbColumns`, which also keeps the existing physics guards (shots on target <= shots, successful passes <= passes).
- `app/submit-match/[code]/_portal.tsx`
  - Deleted `AiCheckOverlay` and `VerificationDecline`, plus the `checking`/`checkStep`/`checkDetail`/`decline` state, the step timer `useEffect`, the 3s minimum overlay and the `aiCheck` submit option.
  - The result form now submits straight to `POST /api/submit-match`; the existing button `isLoading` spinner covers the upload. The 413 oversize message, network retry, 502/504 wording and "lost reply but result landed" refresh check are unchanged.
  - Removed the "Your previous upload was declined" note from `ResultPanel` and the now-unused `XCircle`/`useEffect` imports.
- `lib/score-verify.ts` and `lib/score-ocr.ts` moved to `.recycle/` per the repository file-deletion policy. Nothing imports them any more.

## Verified

- `npx tsc --noEmit` clean.
- `npx next lint --file app/api/submit-match/route.ts --file "app/submit-match/[code]/_portal.tsx" --file lib/portal-stats.ts` clean.
- `npx next build` completes with the portal and `/api/submit-match` both built.
- No database migration: `match_stats` already exists and its columns are unchanged.

## Context chain (by path)

- Replaces the blocking check shipped in `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md` and wired by `.opencode/context/submit-portal/portal-upload-budget-and-tesseract-deploy_2026-11-02.md`.
- Restores the stats write that `.opencode/context/submit-portal/portal-deterministic-score-verify_2026-10-30.md` removed, using the original background OCR shape from `.opencode/context/submit-portal/portal-background-ocr-stats_2026-10-07.md`.
- The upload budget, 413 handling and retry kept here come from `.opencode/context/submit-portal/portal-upload-budget-and-tesseract-deploy_2026-11-02.md`.
- The timeout wording this simplifies was introduced in `.opencode/context/submit-portal/portal-check-timeout-504-and-lost-response_2026-10-25.md`.
- Multi-screenshot uploads and the extras widget remain as documented in `.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`.

## Restore File Section

| Original Path | Purpose | Recycled Path |
| --- | --- | --- |
| `lib/score-verify.ts` | Blocking deterministic tesseract score verification | `.recycle/score-verify_2026-11-03.ts` |
| `lib/score-ocr.ts` | Top-band tesseract reader used only by the deleted score check | `.recycle/score-ocr_2026-11-03.ts` |
