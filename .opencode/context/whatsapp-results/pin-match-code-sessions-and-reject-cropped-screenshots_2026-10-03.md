# Match-code sessions survive slow managers, and cropped screenshots stop being accepted

A manager submitted Hope vs Upington City through a match-code deep link. Screenshot at 17:10, bot read it and asked for confirmation at 17:10, confirmation "1" sent at 20:12 — and the bot dropped the whole session, bouncing back to "What are you submitting?". Separately, a screenshot of only the bottom stat rows was accepted as `Score extracted: i L Free Kicks 0-3 ?` — a stats-table row label read as a team name, with a stat-row number read as the score. Both are fixed.

## Problem
**1. The 60-minute idle sweep killed a legitimate submission.** `handleExpiredSession()` clears any session silent for more than `SESSION_MAX_IDLE_MS` (60 min) on the next inbound message. A match-code deep link is exactly the case where the manager has already committed: the link proves which fixture they are submitting, and the only thing left is for them to photograph a screen and confirm. They do that at their convenience, often hours later. The sweep threw all of that away and their "1" was read as a fresh start.

**2. A cropped screenshot passed OCR.** The precedence ladder in `analyzeImageBuffer()` ends with "if any source found a score, a vision/LLM *invalid* verdict is overruled". On a screenshot containing only the bottom of the eFootball stats table there is no scoreboard at all, and vision correctly returned `valid: false`. But the text-LLM fallback reads garbled tesseract output, found `0-3` in a stat row, and the blanket overrule promoted that junk to a submittable result. Vision's rejection was thrown away by the weakest reader in the chain. The same read produced the "team name" `i L Free Kicks`.

## Fix
### Session pin (migration 094)
- `whatsapp_sessions.pinned_until timestamptz` (migration `094_pin_match_code_sessions.sql`). A timestamp, not a boolean, so a forgotten pin still ages out — it cannot sit on a stale state and hijack a later "1" from an unrelated conversation. TTL is 7 days, matching the submission window, which is the longest a pinned flow is useful for.
- `handleMatchCentreLink()` stamps `pinned_until` when the deep link opens the session.
- `handleExpiredSession()` returns early while `pinned_until` is in the future, so the idle sweep skips a pinned session.
- `upsertSession()` omits `pinned_until` from the payload unless the caller passes it, so a partial upsert leaves the value alone. **This is load-bearing:** the flow walks through a dozen states (screenshot > OCR > confirm > edit score > swap stats) and each one upserts. Clearing the pin by default dropped it at the confirm step, which is the exact step that was timing out.
- New `unpinSession()` releases the pin without ending the session. Called from `handleWelcomeMenu()` and once in front of the command chain in `handleText()`, so starting an unrelated flow ("backdoor", "check fixtures", the main menu) cannot inherit a week-long exemption. `clearSession()` deletes the row and the pin with it.
- Safety: the submission path already re-validates the 7-day window via `submissionBlockReason()` before writing, so a long-lived pin cannot be used to submit an out-of-window result.

### OCR guards
- Track score provenance in `analyzeImageBuffer()`: `visionRejected`, `scoreFromVision`, `scoreFromHeaderMatch`. When vision rejected the image and the only score came from the text LLM, the rejection now stands and the score is cleared. Tesseract's header regex (`scoreMatched`) is a genuine scoreboard hit and still overrules, so the legitimate garbled-screenshot rescue path is preserved.
- `isImplausibleTeamName()` drops a "team name" that is really OCR debris or a stats-table row label. Uses a `STAT_ROW_LABELS` list plus a `STAT_ROW_WORDS` set, because "Free Kicks" splits into two words that are not labels on their own.
- `OCR_RETRY_MESSAGE` replaces "Sorry, I could not read the screenshot" at all three rejection sites and names the actual problem: the scoreline at the top, not just the stats table.

## Verified
- `npx tsc --noEmit` and `npm run lint` pass, no errors.
- `isImplausibleTeamName()` checked against 25 cases including the observed garbage (`i L Free Kicks`, `Free Kicks Passes`, `Interceptions Tackles`) and the real club names from the manager's own fixture list (Hope, Upington City, Kaizer Chiefs, Magesi FC, Ben 10, University of Pretoria, Casric Stars, Cape Town City, Hungry Lions). All pass. Script moved to `.recycle/tmp-check-team-name-guard.ts`.
- Migration 094 applied to live Supabase; `whatsapp_sessions.pinned_until` exists as `timestamp with time zone`.

## Incident note
While making these edits a PowerShell `Get-Content -Raw` / `WriteAllText` round-trip double-encoded `app/api/webhook/route.ts` (UTF-8 read as Latin-1), turning every box-drawing character and arrow in the file into mojibake. Caught by `git diff --stat` showing 248 insertions where ~110 were intended; reverted with `git checkout --` and redone with the Edit tool. **Do not bulk-edit files in this repo through PowerShell string replacement** — use the Edit tool, which handles encoding correctly.

## Key files
- `app/api/webhook/route.ts`: `pinned_until` in `SessionData`, `upsertSession()` payload rule, `unpinSession()`, `handleExpiredSession()` pin check, `handleMatchCentreLink()` pin stamp, `handleWelcomeMenu()` + command chain unpin, `analyzeImageBuffer()` provenance guards, `isImplausibleTeamName()`, `OCR_RETRY_MESSAGE`.
- `supabase/migrations/094_pin_match_code_sessions.sql`: the `pinned_until` column.

## Related files
- The match-code deep link and match-centre flow itself: `.opencode/context/match-codes/match-code-generation-and-backfill_2026-09-30.md` and `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`.
- The OCR precedence ladder (vision primary, text LLM and tesseract as fallbacks) and its reliability fixes: `.opencode/context/whatsapp-results/ocr-stat-reliability-fixes_2026-09-22.md`, `.opencode/context/whatsapp-results/ocr-vision-first-reader_2026-09-23.md`.
- The 7-day submission window that makes a long pin safe: `.opencode/context/whatsapp-results/date-submission-window-and-confirm-menu_2026-08-29.md`.
- The confirm menu wording reused by `resultFlowReprompt()`: `.opencode/context/whatsapp-results/edit-score-loop-fix_2026-08-30.md`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `scripts/tmp-check-team-name-guard.ts` | Throwaway harness asserting `isImplausibleTeamName()` against 25 OCR/club-name cases | `.recycle/tmp-check-team-name-guard.ts` |