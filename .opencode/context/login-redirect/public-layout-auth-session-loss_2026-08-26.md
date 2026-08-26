# Public Layout Auth Session Loss — Missing force-dynamic

**Date:** 2026-08-26
**Reported by:** User Skooz420 (email: skoozz420@efa.local)

## Problem

After logging in successfully, navigating to any `(public)` route group page (polls, fixtures, results, calendar, standings, etc.) showed the user as logged out — both the nav bar and page content.

The home page (`app/page.tsx`) correctly showed the user as logged in. All `(public)` pages showed logged out.

## Root Cause

`app/(public)/layout.tsx` did not have `export const dynamic = 'force-dynamic'`. This layout wraps `PageWrapper` (which calls `cookies()` → `supabase.auth.getUser()`), but Next.js was **statically caching the layout shell** including the nav with a "logged out" state.

The home page (`app/page.tsx`) worked because it directly imports `PageWrapper` and has its own `export const dynamic = 'force-dynamic'`.

## Fix

Added `export const dynamic = 'force-dynamic'` to `app/(public)/layout.tsx`. This forces Next.js to always render the layout server-side, so `PageWrapper` always calls `cookies()` and reflects the actual auth state.

## Files Modified
- `app/(public)/layout.tsx` — added `export const dynamic = 'force-dynamic'`
