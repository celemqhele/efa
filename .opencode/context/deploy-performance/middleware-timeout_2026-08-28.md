# Middleware Invocation Timeout — Vercel 504 + slow pages

**Date:** 2026-08-28
**Category:** deploy-performance

## Problem

Users reported pages taking a very long time to load and, on page changes, Vercel
throwing:

```
504: GATEWAY_TIMEOUT
Code: MIDDLEWARE_INVOCATION_TIMEOUT
```

## Root cause

`middleware.ts` used a near-catch-all matcher:

```js
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|logos|icons|api/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
],
```

This ran middleware on essentially every request (all public pages and most API
routes). Inside the middleware, `supabase.auth.getUser()` performs a **blocking
network round-trip to Supabase** to validate/refresh the session. Every page
navigation triggered this blocking call. On Vercel the middleware edge function
has a strict execution time limit, and the per-request Supabase auth call was
enough to exceed it → `MIDDLEWARE_INVOCATION_TIMEOUT`. It also made every
navigation slow regardless of a timeout.

The auth guard in middleware only ever mattered for a small set of routes, but
the matcher forced the `getUser()` call on the entire app.

## Fix

Narrowed the middleware matcher so it only runs on the routes where the auth
guard actually applies (`middleware.ts` config):

```js
export const config = {
  matcher: [
    '/profile/:path*',
    '/notifications/:path*',
    '/admin/:path*',
    '/login',
    '/login/:path*',
    '/register',
    '/register/:path*',
  ],
}
```

- Route groups `(protected)`, `(public)`, `(auth)`, `(admin)` do not affect URL
  paths, so these patterns map correctly to the real routes.
- All other routes (`/`, `/calendar`, `/standings`, `/results/...`, `/teams/...`,
  `/polls/...`, `/premiership`, `/rules`, `/hall-of-fame`, `/managers/...`,
  `/fixtures/...`) and all `api/*` routes no longer invoke middleware at all.
- The blocking `supabase.auth.getUser()` call now only runs on the routes that
  need session checks, eliminating the timeout and drastically speeding up all
  public navigation.
- Middleware body logic was left unchanged (session refresh + cookie rotation +
  redirect guards still intact for the protected/auth routes).

## Verification

- `npm run lint` — passes (only pre-existing unrelated warnings).
- `npm run build` — succeeds; middleware compiles cleanly (63.5 kB).
- `.next/server/middleware-manifest.json` confirmed the matchers now resolve to
  only `/profile`, `/notifications`, `/admin`, `/login`, `/register` routes.

## Notes / out of scope

- Chose matcher-only fix (no in-memory `getUser()` cache added).
- API route auth is enforced inside each route handler, not middleware — no
  change needed there.
