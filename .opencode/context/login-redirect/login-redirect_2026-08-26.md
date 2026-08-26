# Login Redirect — Public pages don't pass redirect param

**Date:** 2026-08-26
**Reported by:** User Skooz420 (email: Skooz420@efa.local)

## Problem

When an unauthenticated user clicks "Log in" on any public page (polls, fixtures, results, calendar), they navigate to bare `/login` with no `redirect` query parameter. The login page defaults `redirect` to `/` (home), so after successful login the user always lands on the home page instead of where they were.

User also reported "still appears logged out" — likely confusion from being dumped on home page instead of returning to the poll page.

## Root Cause

All public page login links used `href="/login"` without passing `?redirect=<current_path>`.

The login page (`app/(auth)/login/_mobile.tsx` and `_desktop.tsx`) reads:
```tsx
const redirect = searchParams.get('redirect') ?? '/'
```

Without the param, it defaults to `/`.

## Fix

Added `?redirect=` with the current page path to all login links across 9 files:

### Poll pages (use `poll.share_code` in scope):
- `app/(public)/polls/[share_code]/PollClient.tsx:165`
- `app/(public)/polls/[share_code]/_mobile.tsx:160`
- `app/(public)/polls/[share_code]/_desktop.tsx:158`

```tsx
href={`/login?redirect=${encodeURIComponent(`/polls/${poll.share_code}`)}`}
```

### Fixtures, Results, Calendar (use `usePathname()`):
- `app/(public)/fixtures/_mobile.tsx`
- `app/(public)/fixtures/_desktop.tsx`
- `app/(public)/results/_mobile.tsx`
- `app/(public)/results/_desktop.tsx`
- `app/(public)/calendar/_mobile.tsx`
- `app/(public)/calendar/_desktop.tsx`

Added `import { usePathname } from 'next/navigation'` and `const pathname = usePathname()` in each component, then:
```tsx
href={`/login?redirect=${encodeURIComponent(pathname)}`}
```

## Note

The Nav and BottomTabBar also have bare `/login` links, but those are global navigation elements where the user's intent is less specific — acceptable to land on home after login from those.

## Not related

- The middleware already correctly sets `?redirect=` when redirecting protected routes (`/profile`, `/notifications`, `/admin`). `/polls/*` is not a protected route, so middleware doesn't intercept it.
- The backdoor-admin-auth-fix (localStorage vs cookies) is a separate issue.

## Files Modified
- `app/(public)/polls/[share_code]/PollClient.tsx`
- `app/(public)/polls/[share_code]/_mobile.tsx`
- `app/(public)/polls/[share_code]/_desktop.tsx`
- `app/(public)/fixtures/_mobile.tsx`
- `app/(public)/fixtures/_desktop.tsx`
- `app/(public)/results/_mobile.tsx`
- `app/(public)/results/_desktop.tsx`
- `app/(public)/calendar/_mobile.tsx`
- `app/(public)/calendar/_desktop.tsx`
