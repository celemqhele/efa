# Submit portal: AI screenshot verification (score + stats) with a blocking check (2026-10-20)

The submit-match portal now verifies the proof screenshots with Gemini flash-lite
BEFORE the result is written: OCR the image first, then hand that OCR text to a
second task that answers true/false on whether this is a screenshot of a match
score. A green tick means accepted, a red X means "Submission declined", and the
manager can attach up to four screenshots (1 required + 3 optional for games that
had to be replayed because of network drops) whose stat tables are combined into
one stats set for the fixture page. The manager asked for all of this plus a
blocking loading animation while the AI works, lucide icons instead of emojis, and
had already been served by the old background OCR (see
`.opencode/context/submit-portal/portal-background-ocr-stats_2026-10-07.md`,
which this replaces for the web portal path).

## What changed

### 1. New `lib/screenshot-verify.ts` — the two-step AI check

- `verifyScreenshots(images, typedHome, typedAway)` returns
  `{ ok, reason, ocrText, stats, seenScore, failOpen, images }`.
- **Step 1 — OCR task** (vision): one Gemini call per screenshot with
  `VISION_PROMPT`, which transcribes every readable line into `ocrText` and
  extracts teams, scoreline and the 13 stat rows. JSON response mode, one retry
  with a 1.5s backoff on 429/503 (we are on the free tier).
- **Step 2 — assessment task**: a second call per screenshot with
  `ASSESS_PROMPT(ocrText, visionScore, typed)`. It receives the OCR text from
  step 1 AND the image, and must answer `{ ok, hasScore, hasStats, reason }`.
  The prompt is explicit that blurry / garbled / rotated / cropped / partially
  cut-off stat tables must NOT be declined, and that `ok=false` is reserved for
  "clearly no score at all" (menus, live clock with no scoreline, training,
  unrelated photos).
- **Verdict** (`images[].isScoreShot`): a screenshot counts when vision actually
  saw a scoreline, OR when the assessment says ok. The assessment can RESCUE a
  screenshot vision could not read (blurry), but it can never VETO a scoreline
  the pixels actually produced — that asymmetry is the main anti-false-decline
  guard.
- **Score comparison** (`scoreDistance`): per-side distance in BOTH orientations
  (2-3 typed vs 3-2 read = the same game, screenshot taken from the opponent's
  side), best orientation wins. Tolerance is `GOAL_TOLERANCE = 1` per side, so a
  1-goal difference passes and anything bigger declines: the user's exact rule
  ("1 goal difference is fine but anything more than that decline").
- **Merge**: the accepted screenshot with the smallest distance, then the most
  complete stat table, decides the scoreline; every accepted screenshot's stat
  rows are merged (first non-null wins) with per-screenshot home/away flipping,
  so a replay still yields one full stats set aligned to the typed sides.
- **Fail-open paths** (never punish a legitimate manager):
  - every screenshot unreadable (Gemini down/quota) → `ok: true, failOpen: true`,
    no stats;
  - a score is visible but no digits are readable → `ok: true, failOpen: true`;
  - the assessment call erroring → its own `ok: true` fail-open;
- **Declines** (the only two): no screenshot shows a score at all, or the best
  read scoreline differs by more than 1 goal per side. The reason strings are the
  user's wording: "Submission declined because this screenshot does not include a
  score..." (now also used for the multi-screenshot case) and "...the score in
  your screenshot (6-3) is too different from the score you entered (3-3)...".
  The `ocrText` of every screenshot rides along so the UI can show what the AI
  actually read.

### 2. `app/api/submit-match/route.ts` — check inline, before any write

- Removed the `after()` background OCR block that guessed stats from the typed
  score. The verification now runs synchronously in `submitResult` BEFORE the
  upload/upsert chain, so a declined submission leaves the result already on file
  completely untouched (no reset-count consumed, no balances touched).
- Declines return **HTTP 422** with `{ ok: false, declined: true, error,
  ocrText, seenScore, screenshots }`.
- `form.getAll('extraScreenshot')` picks up the optional extra screenshots
  (max `MAX_SHOTS - 1 = 3`), size-checked at 8MB each.
- Extras are uploaded to the same `match-screenshots` bucket as
  `result-<fixture>-x<n>-<ts>.<ext>` and stored on the new
  `results.extra_screenshot_urls` jsonb column (`screenshot_url` keeps the main
  one, unchanged for every existing reader).
- Stats are written INLINE from `verification.stats` (already merged + aligned)
  via `matchStatsToDbColumns` into `match_stats` — no second OCR pass. Walkovers
  skip verification entirely and write no stats.
- `export const maxDuration = 60` because the check runs inside the request
  (4 screenshots × 2 Gemini calls).
- Drops the now-unused `analyzeImageBuffer` / `normalizeToLandscape` imports.
  `lib/ocr.ts` is untouched and still used by the WhatsApp webhook.

### 3. `app/submit-match/[code]/_portal.tsx` — animation, verdict card, multi-upload

- `AiCheckOverlay`: full-screen, non-dismissable overlay (accent spinner +
  pinging ring + 3 step lines) shown while the POST is in flight, so the manager
  cannot click off mid-check.
- `VerificationDecline`: red `XCircle` card titled "Submission declined" with the
  server reason, a per-screenshot `Check`/`X` breakdown, and a collapsible
  "What the AI read" block showing the OCR text. A "Try again" button clears it.
  A green `Check`/`CheckCircle` tick is used for accepted/positive states (lucide
  only — no emojis anywhere in this flow).
- Result panel: the main file input plus a new optional block headed "Did you
  play many times due to network or disconnections?" with a `multiple` file input
  (up to 3), an "Optional" hint, per-file remove buttons, and a
  "Preparing your screenshots…" spinner.
- Every picked file goes through `lib/compress-image-client.ts`
  (`maybeCompressImage`) BEFORE the POST: over 1MB is downscaled to 1920px on the
  long edge and re-encoded as JPEG q0.9, because four phone PNGs would blow past
  the serverless body limit in one request. Small/small-enough files pass through
  byte-identical, and any failure returns the original file.

### 4. `app/(public)/results/[id]/_desktop.tsx` / `_mobile.tsx`

The "Match Screenshot" card now also renders `result.extra_screenshot_urls`
under a "More screenshots from this match" label, each captioned "game 2/3/4".

### 5. Migration `104_extra_screenshot_urls.sql`

`alter table public.results add column if not exists extra_screenshot_urls jsonb;`
per the repository migration numbering (103 was the previous latest), applied
with `npm run db --` and recorded via `scripts/backfill-migration-history.ts`
(7 inserted, total tracked 103). It is a column on the already-granted `results`
table, so no new grants were needed.

## Verified

- `npx tsc --noEmit` clean; `npx next lint` on all touched files clean (one
  unused-import warning caught and fixed: dropped `CheckCircle2`).
- `npx next build` compiles successfully (the responsive filter caught no errors).
- `extra_screenshot_urls` confirmed as `jsonb` on the remote DB.
- No em dashes introduced into the verification reason strings / poster-style
  text; portal copy stays plain.

## Context chain (by path)

- The background-OCR behaviour this replaces for the portal:
  `.opencode/context/submit-portal/portal-background-ocr-stats_2026-10-07.md`
- The shared OCR ladder still used by the WhatsApp bot:
  `.opencode/context/whatsapp-results/ocr-vision-first-reader_2026-09-23.md`
- Cropped-screenshot rejection rules that informed the "no scoreboard" decline:
  `.opencode/context/whatsapp-results/pin-match-code-sessions-and-reject-cropped-screenshots_2026-10-03.md`
- The gallery upload fix this extends with extras:
  `.opencode/context/submit-portal/portal-screenshot-upload-gallery_2026-10-07.md`
- The portal itself:
  `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
