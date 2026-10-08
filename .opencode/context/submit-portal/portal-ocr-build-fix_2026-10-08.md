# Fix: `'use server'` on lib/ocr.ts broke every Vercel build

Removed the top-level `'use server'` directive from `lib/ocr.ts`. The directive
made Next.js treat every export of the module as a server action, but server
actions must be async — the sync helpers `matchStatsToDbColumns` and
`dbStatsToSessionFormat` (and the `STAT_KEY_TO_DB` const) were rejected with
`Server Actions must be async functions.` during `next build`, so both this
resubmit push and the earlier background-OCR push (`portal-background-ocr-stats`,
commit `6db4456`) failed to deploy on Vercel.

## Problem
- `lib/ocr.ts` (created for the shared OCR pipeline in
  `.opencode/context/submit-portal/portal-background-ocr-stats_2026-10-07.md`)
  started with `'use server'`.
- It is only imported by server route handlers
  (`app/api/webhook/route.ts`, `app/api/submit-match/route.ts`), so it never
  needed the directive — that file does not expose actions to client components.
- `npx tsc --noEmit` and `next lint` both passed locally; only `next build`
  surfaced the webpack/server-actions error, so it slipped through until a
  Vercel production build failed.
- Vercel deployment history showed the previous push (`6db4456`, OCR) had
  ALSO failed to build for the same reason — the error pre-dated the resubmit
  work.

## Fix
- Deleted the `'use server'` line from the top of `lib/ocr.ts` and added a
  comment explaining it must not be re-added (it exports sync helpers that
  server actions forbid).
- `next build` now completes cleanly.

## Verification
- `npx next build` succeeds end-to-end (route handler output list generated).
- Deploy: push to `main` triggers Vercel.

## Files changed
- `lib/ocr.ts`