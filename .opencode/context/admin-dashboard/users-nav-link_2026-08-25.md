# Admin Dashboard — Users Nav Link + Password Reset

**Date:** 2026-08-25

## What was built
1. Added "Users" link to the admin dashboard navigation bar (both desktop and mobile) so the User Management page is accessible.
2. Reset passwords for GOAT@efa.local and Skooz420 (skoozz420@efa.local) to the default `Efootball@2026`.

## Files modified
- `app/(admin)/admin/dashboard/_desktop.tsx` — Added `{ href: '/admin/users/manage', label: 'Users' }` to ACTIONS array
- `app/(admin)/admin/dashboard/_mobile.tsx` — Same addition to ACTIONS array

## Context
The User Management page (`/admin/users/manage`) already existed with the Reset Password button (built in prior commit `a7533d7`), but had no link from the admin dashboard nav bar. This commit makes it discoverable.

## Password resets performed
| User | Email | Password |
|---|---|---|
| GOAT | GOAT@efa.local | Efootball@2026 |
| Skooz420 | skoozz420@efa.local | Efootball@2026 |

## Restore File Section
- Original path: `app/(admin)/admin/dashboard/_desktop.tsx`
- Purpose: Admin dashboard desktop nav bar
- New path: N/A (modified in place)

- Original path: `app/(admin)/admin/dashboard/_mobile.tsx`
- Purpose: Admin dashboard mobile nav bar
- New path: N/A (modified in place)
