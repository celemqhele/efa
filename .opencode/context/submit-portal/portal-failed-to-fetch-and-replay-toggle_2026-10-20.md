# Portal: fix "Failed to fetch" on submit + replay block becomes a Yes/No toggle (2026-10-20)

Two fixes to the submit-match portal after the AI-verification release in
`.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`:
managers could not submit at all (the browser surfaced a bare "Failed to fetch")
and the optional multi-screenshot block confused people because it showed its
upload widget straight away. The upload fix addresses the real cause (an
oversized request body rejected at the platform edge), not the loading animation
the user initially suspected; the replay block is now an explicit Yes/No radio
(default No) that reveals the extra upload widget only on Yes.

## Problem 1 — "Failed to fetch" on submit

The manager reported submitting failing with a "failed to fetch" message and
guessed the loading animation was at fault. The animation was a red herring:

- `animate-scale-in` on the overlay IS defined (`tailwind.config.ts` `addUtilities`,
  `@keyframes efaModalIn`, a one-shot 0.18s), so it cannot block a request.
- The message is the browser's own `TypeError: Failed to fetch`, which `fetch`
  throws when no response ever arrives.

Root cause: **the request body exceeded the platform cap.** The multi-screenshot
feature sends up to 4 files in one POST. `next.config.mjs` sets
`experimental.serverActions.bodySizeLimit: '10mb'`, but that applies ONLY to
Server Actions — a Route Handler (`app/api/submit-match/route.ts`) has no such
knob and Vercel rejects a body over roughly 4.5MB at the edge, before Next.js
runs. The browser then sees a failed request, not a JSON error, so the old
`catch` leaked the raw JavaScript `"Failed to fetch"`.

Evidence that the multi-upload path was the trigger:
`select count(*) filter (where extra_screenshot_urls is not null) from results`
returned **0 of 1836** rows — no submission had ever carried an extra screenshot.
Before this feature only one screenshot was ever posted, which is why the
failure only appeared after the AI-verification deploy (`222958d`).

The old client compressor could not save it either: it only triggered **above
1MB per file** and stopped at 1920px / JPEG q0.9, so four busy eFootball stat
screens could still total well over 4.5MB.

### Fix 1

- `lib/compress-image-client.ts` rewritten: the per-file budget is now
  `DEFAULT_MAX_BYTES = 1_200_000` (1.2MB) — four of those stay under the platform
  cap — and the encoder walks a quality/edge ladder (`1600@0.8 → 1600@0.7 →
  1280@0.75 → 1280@0.65 → 1080@0.6`), keeping the smallest candidate and stopping
  at the first one that fits. Small files still pass through byte-identical, and
  any failure still returns the original file.
- `app/submit-match/[code]/_portal.tsx` `send()`: a network-level failure
  (`e instanceof TypeError`, or a `failed to fetch` / `networkerror` /
  `load failed` message) is now reported as plain words — "Could not send your
  screenshots. Check your connection and try again. If it keeps failing, upload
  fewer screenshots at a time." — instead of leaking `"Failed to fetch"`.

## Problem 2 — the animation felt stuck / the replay block confused people

- The overlay had no minimum lifetime and no visible progress: it sat on a
  spinner for as long as the AI took, and could vanish instantly on an immediate
  failure, so it read as "failing to render".
- The optional extras block showed a file input immediately under an "Optional"
  hint, so managers treated it as required and got lost.

### Fix 2

- `AiCheckOverlay` now takes a `step` prop and renders a real 3-line progress
  list (finished lines get a green lucide `Check`, the active line keeps the
  pulsing accent dot, later lines are dimmed).
- `MIN_CHECK_MS = 3000`: `send()` races the POST against a 3s `wait()` and
  `await`s it before dismissing, so the overlay is always visible for 3 seconds
  and then goes away — it still cannot outlive the request (dismissal is in
  `finally`), and a slower request simply keeps the overlay up with the last step
  active.
- The extras block is now a **Yes/No radio** ("Did you play many times due to
  network or disconnections?", default **No**) using the same filled-dot control
  as the forfeit / walkover questions (see
  `.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md`).
  The upload widget, the "Add your other game screenshots" heading and the picked
  file list only render on Yes; switching back to No clears `extras` so the POST
  never carries screenshots the manager just said do not exist.

## Verified

- `npx tsc --noEmit` clean.
- `npx next lint` on both touched files clean.
- `npx next build` succeeds (`/submit-match/[code]` 11.7 kB / 198 kB first load).
- `public/sw.js` restored with `git checkout --` after the build rewrote it.

## Context chain (by path)

- The AI check + multi-upload this fixes:
  `.opencode/context/submit-portal/portal-ai-screenshot-verification-and-multi-upload_2026-10-20.md`
- The Yes/No radio control pattern reused here:
  `.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md`
- The portal itself:
  `.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`
- Prior Vercel platform-limit incident on the same project:
  `.opencode/context/deploy-performance/middleware-timeout_2026-08-28.md`

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
