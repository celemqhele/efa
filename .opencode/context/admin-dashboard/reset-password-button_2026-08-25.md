# Admin Reset Password Button

**Date:** 2026-08-25

## What was built
Added a "Reset Password" button to the admin User Management page (`/admin/users/manage`). Admins can reset any user's password to the default `Efootball@2026` with a single click + confirmation dialog.

## Files created
- `app/api/admin/reset-password/route.ts` — POST endpoint that uses Supabase GoTrue admin API (`auth.admin.updateUserById`) to set the password, with audit logging

## Files modified
- `app/(admin)/admin/users/manage/UserActionButtons.tsx` — Added purple "Reset Password" button + ConfirmDialog + success message

## How it works
1. Admin clicks "Reset Password" button (violet/purple styled, next to Make Admin/Sack)
2. ConfirmDialog asks: `Reset "${username}"'s password to the default? They should change it after logging in.`
3. On confirm, calls `POST /api/admin/reset-password` with `{ user_id }`
4. API route verifies admin role, calls Supabase admin API to set password to `Efootball@2026`, logs to audit_log
5. On success, shows green message: "Password reset — remind them to change it"

## Key details
- Default password is hardcoded as `Efootball@2026` in the API route
- No self-reset restriction (admins can reset their own password)
- Audit log entry: `action: 'reset_password'`, `target_type: 'profile'`
- Works on both mobile and desktop (UserActionButtons is shared)

## Restore File Section
- Original path: `app/api/admin/reset-password/route.ts`
- Purpose: API route for admin password reset
- New path: N/A (file was created, not moved)

- Original path: `app/(admin)/admin/users/manage/UserActionButtons.tsx`
- Purpose: Client component with user action buttons (Sack, Make Admin, Reset Password)
- New path: N/A (file was modified in place)
