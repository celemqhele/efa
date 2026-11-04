# Submit portal: service worker was aborting Supabase uploads (2026-11-04)

Follow-up to `.opencode/context/submit-portal/portal-direct-storage-upload_2026-11-04.md`. After shipping direct-to-storage uploads, managers still saw "could not upload screenshot: Failed to fetch". The direct uploads that did land in `storage.objects` were small/quick; large ones never arrived, pointing at a client-side abort rather than Supabase.

## Root cause

`app/sw.ts` used Serwist's `defaultCache`, whose cross-origin entry is a `NetworkFirst` with `networkTimeoutSeconds: 10`. That entry matches every request to `*.supabase.co`, including storage uploads. Any screenshot upload that took longer than 10s was aborted by the service worker and surfaced as a bare `TypeError: Failed to fetch` — exactly the message reported. This also explains the earlier intermittent "could not send" failures on large bodies.

## Fix

Prepended a `NetworkOnly` runtime-cache entry for `^https:\/\/.*\.supabase\.co\/.*` ahead of `defaultCache` in `app/sw.ts`, so Supabase requests (uploads, downloads, auth, data) bypass the service worker's cache and 10s timeout entirely.

## Verified

- Committed and pushed (`b6c5901`); Vercel rebuilds `public/sw.js` from `sw.ts`.
- Note: returning users may keep running the old service worker until it updates; `skipWaiting` + `clientsClaim` activate the new one on the next load.
