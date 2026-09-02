# Safari Login Session Loss — window.location.href drops cookies

**Date:** 2026-08-26
**Reported by:** User Skooz420 (email: skoozz420@efa.local, iPhone Safari)

## Problem

After logging in on iPhone Safari, navigating to any page still showed the user as logged out. Chrome worked fine.

## Root Cause

The login form used `window.location.href = redirect` for hard navigation after `signInWithPassword()` set the session cookies. Safari (WebKit) drops recently-set cookies on `window.location.href` hard reloads due to its stricter SameSite/Lax redirect handling (WebKit Bug 219650). Chrome handles this correctly.

## Fix

Changed `window.location.href = redirect` to `router.push(redirect)` (soft/client-side navigation) in both login form components. `router.push()` uses a same-origin fetch request that properly carries the newly-set session cookies, even on Safari.

## Why this works
- `signInWithPassword()` sets session cookies via the Supabase browser client
- `router.push()` triggers a client-side navigation (RSC fetch) that sends cookies with the request
- The middleware sees the cookies, refreshes the session, and the page renders with correct auth state
- Safari handles this correctly because it's a fetch-based soft navigation, not a full page reload

## Files Modified
- `app/(auth)/login/_mobile.tsx` — `window.location.href = redirect` → `router.push(redirect)`
- `app/(auth)/login/_desktop.tsx` — same change

## Related fixes (same session)
- `.opencode/context/login-redirect/login-redirect_2026-08-26.md` — Added `?redirect=` param to login links on public pages
- `.opencode/context/login-redirect/public-layout-auth-session-loss_2026-08-26.md` — Added `force-dynamic` to `(public)` layout to prevent cached nav showing logged-out state
