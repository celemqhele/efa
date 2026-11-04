# Submit portal: direct-to-storage screenshot upload (2026-11-04)

Follow-up to `.opencode/context/submit-portal/portal-upload-budget-and-tesseract-deploy_2026-11-02.md`. Managers kept reporting "Could not send your screenshots. The upload stopped before it reached the server, so nothing was lost" even after the shared 3.2MB compression budget shipped. PVP/network worked fine, so the cause was the request body hitting Vercel's ~4.5MB platform cap (or a format the client compressor could not shrink), not the connection.

## Problem

- The portal POSTed screenshot bytes through `/api/submit-match`, whose multipart body must fit under Vercel's platform cap. Compression was best-effort and silent failures (HEIC/unsupported formats, backdoor and dispute panels never compressed at all) still pushed oversized bodies to the edge, where the request was dropped and surfaced as a bare `TypeError: Failed to fetch`.
- Backdoor and dispute proof uploads never went through `maybeCompressImage`, so any phone screenshot there could exceed the cap.

## Fix

- New `lib/upload-screenshot-client.ts`: `uploadScreenshotToStorage(bucket, file, folder)` compresses best-effort then uploads the bytes straight to Supabase Storage (no Vercel body cap) and returns the storage path.
- `_portal.tsx`: Result, Backdoor and Dispute panels now upload to Storage first and submit only storage paths (`screenshotPath` / `extraScreenshotPath`) to `/api/submit-match`. The old `fitScreenshots`/`TOTAL_PAYLOAD_BUDGET` body-budget flow is removed from the submit path.
- `route.ts`: `submitResult`, `submitBackdoor`, `disputeBackdoor` accept storage paths, create long-lived signed URLs via new `signedUrlForPath`, and download buffers via `downloadFromBucket` for the background stats OCR. `lib/submit-match.ts` gained those two helpers.
- Migration `110_backdoor_screenshots_manager_upload.sql`: authenticated managers may INSERT/SELECT on `backdoor-screenshots` (mirrors `match-screenshots`), so direct client uploads work for report/dispute proof.

## Verified

- `npx tsc --noEmit` clean; `npm run build` succeeds (`/api/submit-match` and `/submit-match/[code]` build).
- Migration applied to remote Supabase.

## Known gap / deferred

- Stale service-worker bundles may still run the old client code until the SW updates; the new bundle is content-hashed so the update propagates on next load.
- Existing server-side `uploadToBucket` is retained for any other callers; the portal no longer uses it.
