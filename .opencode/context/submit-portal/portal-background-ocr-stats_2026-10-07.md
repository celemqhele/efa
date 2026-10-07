# Submit portal: background OCR match-stats from result screenshot (2026-10-07)

The submit-match portal (`app\api\submit-match\route.ts`) now runs OCR on the proof
screenshot in the background after a result is submitted, and writes `match_stats`
for the fixture. The user asked: stats should only appear on the fixtures page, never
inside the portal, and the OCR must run in the background so the manager isn't kept waiting.

## What changed

- Extracted the webhook's OCR pipeline into a shared server-only lib `lib\ocr.ts`:
  `analyzeImageBuffer` (Gemini vision primary + text-LLM fallback + tesseract fallback,
  with the stat-row-label debris guards), `match_stats` column mapping
  (`STAT_KEY_TO_DB`, `matchStatsToDbColumns`, `dbStatsToSessionFormat`).
- Updated `app\api\webhook\route.ts` to import those from `@/lib/ocr` (and dropped the
  local copies). The bot flow is byte-for-byte unchanged behaviour-wise; only the import
  location changed.
- In `app\api\submit-match\route.ts` `submitResult`, after saving the result + fixture
  update + notifications, the screenshot bytes are captured and OCR runs inside
  `after()` (Next.js 15.5 exports `after` from `next/server`), so the POST response
  returns immediately.
- Score-matching gating (the user's exact rule):
  - OCR score equals the typed score (`homeScore`/`awayScore`) → stats written as-read.
  - OCR score is the reverse of the typed score (screenshot reads 3-2 but the manager
    typed 2-3) → every stat's home/away is flipped before being written, so stats align
    with the typed (manager) sides.
  - Any other mismatch → no `match_stats` row is written at all.
  - No score / invalid screenshot from OCR → also no stats.
- The `match_stats` row is `delete` then `insert` keyed on `result_id`, mirroring the
  `finalise-result` flow (handles replacing a postponed placeholder result).
- The portal never displays stats: `lib\submit-match.ts` `buildState` does not select
  `match_stats`. The fixtures page (`app\(public)\fixtures\[id]\page.tsx` +
  `_desktop.tsx` / `_mobile.tsx`) already renders them via `results.match_stats`.

## Related context

- `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`
- The webhook flow this shares code with (older path) and the bot's `match_stats` write at
  `app\api\webhook\route.ts` `finalise`/`writeResultToDb` region.