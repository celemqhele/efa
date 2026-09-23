# OCR vision-first reader + 0->null zero-bug fix + "no response" 200 fix

Reworked `analyzeImageBuffer` so Gemini vision is the PRIMARY screenshot reader
and the text-LLM/tesseract chain only back-fills what it missed, fixed a
`homeScore || null` bug that silently turned legit `0` scores into `null`, added
per-extractor logging, and made image branches return HTTP 200 instead of
returning nothing. This came after the stat-reliability work in
`.opencode/context/whatsapp-results/ocr-stat-reliability-fixes_2026-09-22.md`:
the user reported the bot could not read a screenshot AT ALL (score came back
`null null` -> "Sorry, I could not read the screenshot. Please send it again.").

## Problem

- Prod webhook log (efa-fxyk, 18:09) showed `final - team: Norway Brazil score:
  null null statsKeys: possession,fouls,offsides,crosses,cornerKicks,freeKicks,
  tackles` after a ~45s gap — every extractor returned null scores.
- Second failure (20:23, from 264814757719): `team: null null score: null null
  statsKeys: none` on a 39KB image.
- Root causes found:
  1. `homeScore = ocrResult.homeScore || null` (~old route.ts:4410) — a real `0`
     score (e.g. 1-0) became `null` and the final gate rejected the result.
  2. The wider crop (x 22–78%) + PSM 6 from the 09-22 change broke tesseract's
     header regex, so raw header scores were lost.
  3. Gemini vision ran LAST and only overrode when it returned BOTH scores; by
     then the sequential text-LLM calls had eaten the time budget, so vision
     often threw/timed out and the empty `catch{}` swallowed it.
  4. Several image/backdoor branches ended with bare `return` (no
     `NextResponse`) -> `Error: No response is returned from route handler` and
     the event/retry storm.
- Note: `OcrCleanedResult` in `lib/whatsapp.ts` is NOT exported, so the rework
  types locals via `Awaited<ReturnType<typeof analyzeScreenshot>>` /
  `Awaited<ReturnType<typeof cleanOcrText>>`.

## Fix

**`app/api/webhook/route.ts` — `analyzeImageBuffer` (~line 4371)**
- GEMINI VISION FIRST: `analyzeScreenshot` is called once, up front, with a
  `[ocr] vision` log line (`valid`, `reason`, `score`, `teams`, `statKeys`,
  ms). No more double-LLM before the pixels get read.
- If vision is valid and produced both scores -> authoritative: sets score +
  teams + stats, clears `invalidReason`.
- If vision explicitly said `valid === false`, its `reason` is kept as
  `invalidReason` — but only if the fallback chain below also finds no score
  (line 4460 clears it when any source produced a score).
- TEXT-LLM fallback runs ONLY when `homeScore === null` (vision failed/invalid/
  threw). It fills teams + stats and its score if present; never vetoes vision.
  Added `[ocr] text LLM failed` logging. Uses `cleanOcrText` -> `cleanOcrWithGroq`
  fallback in the same try/catch shape.
- TESSERACT fallback fills missing teams/stats. Raw header scores are the last
  resort but ONLY when `scoreMatched` is true (see parser change) — prevents a
  failed header regex's default `0,0` from becoming a fake 0-0. Preserves a
  legit `0` (no `|| null`).
- Final `[ocr] tesseract/text score:` log line with elapsed ms.

**`lib/screenshot-parser.ts` — `scoreMatched` flag**
- Added `scoreMatched: boolean` to `ParsedResult` (default `false`), set `true`
  in all three places a header/final-time regex actually assigned a score
  (standardHeader, efootballHeader, full-time fallback). Callers must not treat
  the default `0` `homeScore`/`awayScore` as a real read unless this is true.

**`app/api/webhook/route.ts` — bare-return -> 200**
- Replaced 5 bare `return`s inside the image/backdoor branches with
  `return new NextResponse(null, { status: 200 })` (duplicate backdoor
  screenshot, backdoor screenshot-with-caption, backdoor screenshot prompt,
  backdoor stray-image prompt, logged-in/fix-screenshot branch). The top-level
  handler already returned 200 on the normal paths, so this kills the "No
  response is returned from route handler" 500s / Meta retries.

## Files touched
- `app/api/webhook/route.ts` (`analyzeImageBuffer`, image/backdoor branches)
- `lib/screenshot-parser.ts` (`ParsedResult.scoreMatched`)

## Verification
- `npx tsc --noEmit` clean; `npm run lint` no new warnings; `npm run build`
  passed (all 68 pages generated).
- Deploy: push main -> Vercel (project `efa-fxyk`, git integration). Re-send the
  failing Norway/Brazil screenshot and check
  `vercel logs --project efa-fxyk --source serverless --query webhook` for
  `[ocr] vision` then `final - team: Norway Brazil score: n-n`.