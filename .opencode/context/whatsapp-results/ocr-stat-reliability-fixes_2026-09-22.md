# OCR stat reliability fixes — 3-digit misreads, zeroed stats, missing-stats rendering

Hardened the WhatsApp screenshot OCR pipeline so stats like "250 passes" are no longer
read as "25" and one-sided/tiny stats stop being dropped, plus UI rendering for null
stats. Runs after the logged-in first-time submission work in
`.opencode/context/whatsapp-logged-in/whatsapp-logged-in-first-submit_2026-09-22.md`.

## Problem

- The manager reported OCR unreliability: a 3-digit number like `250` passes was read as
  `25`, and stats sometimes came through as `0`. Root causes in the single-tesseract-pass
  parser (`lib/screenshot-parser.ts`) and single LLM text pass (`lib/whatsapp.ts`
  `cleanOcrWithGroq`): the crop window missed the stat edge, no-upscale pixel density, PSM
  defaults dropping digits, a 12-stat cap, and a `0`-disallow rule that rejected
  legitimate one-sided blanks. NULL DB stats were also rendered as `0` (`?? 0`) in the
  public results UI instead of showing as unknown.

## Fix

**Parser (`lib/screenshot-parser.ts`)**
- Crop window widened to x ∈ [22%, 78%] (was [30%, 70%]) so numbers near the column edge
  survive.
- Image upscaled 2× before OCR to densify digits.
- `tessedit_pageseg_mode: '6'` (assume uniform block) cast `as any` — the option is not in
  tesseract.js TS types.
- Stat cap raised from 12 to 13 lines (extra stat that used to be dropped).
- Zero rule relaxed: blank/absent values stay null, explicit `0` allowed (one-sided stat).

**LLM prompts (`lib/whatsapp.ts`)**
- All three analysis prompts (greeting, clean, analyze) now warn the model: `0` only when
  the screenshot clearly shows a zero; larger numbers must not lose trailing digits
  (250 not 25); output numbers verbatim.

**Per-key union merge (`analyzeImageBuffer`, `app/api/webhook/route.ts`)**
- For each stat key the candidate values come from three extractors (tesseract regex →
  LLM text → Gemini vision). Values are union-merged; Gemini vision acts as authority for
  any key it actually read. Regex/LLM-only guesses are guarded by a
  `statsLookPlausible`-style sanity class (e.g. cap `[0,999]`, drop a 3-digit read when
  the higher-confidence extractor disagrees).

**Physics guards (`matchStatsToDbColumns`)**
- Hard clamps: `shotsOnTarget ≤ shots`, `successfulPasses ≤ passes`, all stats `[0,999]`,
  so OCR noise can't produce impossible stat lines.

**Results UI rendering**
- `app/(public)/results/[id]/_mobile.tsx` — StatRow renders `–` when either value is null.
- `app/(public)/results/[id]/_desktop.tsx` — stat rows with `s.h == null && s.a == null`
  are hidden; otherwise missing side shows `–` (was `0`/garbage).

## Limitation
- Already-written rows with wrong OCR cannot be re-parsed (screenshots aren't persisted);
  those are corrected manually via the admin panel. Going forward the merge/guards apply.

## Files touched
- `lib/screenshot-parser.ts`, `lib/whatsapp.ts`, `app/api/webhook/route.ts`
  (`analyzeImageBuffer`, `matchStatsToDbColumns`),
  `app/(public)/results/[id]/_mobile.tsx`, `app/(public)/results/[id]/_desktop.tsx`.

## Verification
- `npx tsc --noEmit` (passes after `as any` on the PSM option), `npm run lint`,
  `npm run build` — all green, no new warnings.
- WhatsApp test: send a screenshot whose scoreboard includes a 3-digit stat (e.g. 250) and
  a one-sided 0 stat, confirm the confirm-menu preview shows 250 (not 25) and the 0.