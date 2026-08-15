# Backdoor Link on Admin Dashboard

## Problem
There was no visible UI button linking to `/admin/backdoor-submissions`. The page
was only reachable by typing the URL directly.

## Fix
Added a `Backdoor` quick-action link to the admin dashboard (`/admin/dashboard`)
in both viewport variants, appended to the existing `ACTIONS` array:

- `app/(admin)/admin/dashboard/_desktop.tsx` — `{ href: '/admin/backdoor-submissions', label: 'Backdoor', variant: 'outline' }`
- `app/(admin)/admin/dashboard/_mobile.tsx` — same entry (mobile quick-action rail)

The `ACTIONS` array powers the sticky action bar (desktop) and `QuickActions`
horizontal rail (mobile), so the button appears in the same spot as the other
admin shortcuts.

## Notes / Gotchas
- The dashboard has no other admin sub-nav; `(admin)/layout.tsx` only renders an
  "Admin Panel" badge. The quick-action bar is the only place admin pages are
  surfaced, so this is the canonical spot for such links.
- Used label "Backdoor" to match the "Backdoor Submissions" page title while
  staying short enough for the action rail.
- `npx tsc --noEmit` passes. No API/schema changes.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
