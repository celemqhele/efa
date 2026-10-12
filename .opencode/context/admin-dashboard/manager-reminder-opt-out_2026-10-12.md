# Manager "open to match reminders" opt-out (greyed WhatsApp reminder icons)

Added a per-manager boolean consent flag, `profiles.open_to_reminders`, so a manager who does not want match reminders can be marked opted out. In the admin dashboard "Fixtures Due" table the H/A WhatsApp reminder icons for an opted-out manager now render greyed out and are not clickable, while everyone else is unchanged (default `true`). An admin toggle on the Users & Managers page flips the flag, and the first opt-out (`anele_arh`) is seeded false.

## Problem

Some managers asked not to be messaged with match reminders, but the admin dashboard reminder buttons (`components/ui/DashboardFixtureActions.tsx`) always opened a pre-filled WhatsApp reminder whenever the manager had a phone number. There was no per-manager way to mark "do not remind me", so admins had to remember who was off-limits.

## Fix

### Data

- New migration `supabase/migrations/100_open_to_reminders.sql`:
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS open_to_reminders boolean NOT NULL DEFAULT true;`
  - Seeds the first opt-out: `UPDATE public.profiles SET open_to_reminders = false WHERE username = 'anele_arh';`
  - Applied to the remote DB with `npm run db -- supabase/migrations/100_open_to_reminders.sql` (verified `anele_arh` = `false`). No extra grants needed: it is a column on the existing `profiles` table whose table-level grants already cover it.

### Dashboard reminder icons

- `components/ui/WhatsAppButton.tsx` — new optional `disabled` / `disabledTitle` props. When `disabled`, the component returns a greyed, non-clickable `<span>` (muted text/border, `cursor-not-allowed`, `role`/`aria-disabled`) instead of the green `wa.me` anchor. The icon SVG and size classes are shared between the two branches.
- `components/ui/DashboardFixtureActions.tsx` — new `homeManagerOpenToReminders` / `awayManagerOpenToReminders` props (default `true`); the H/A `WhatsAppButton`s get `disabled={!…OpenToReminders}`.
- `app/(admin)/admin/dashboard/page.tsx` — the due-fixtures manager embed now selects `open_to_reminders`.
- `app/(admin)/admin/dashboard/_desktop.tsx` and `_mobile.tsx` — pass `…OpenToReminders={fx.…_team?.manager?.open_to_reminders !== false}`.

### Admin toggle

- New route `app/api/admin/managers/set-open-to-reminders/route.ts` — admin-only POST `{ user_id, open }`, updates `profiles.open_to_reminders` and writes an `audit_log` row (`update_open_to_reminders`). Mirrors `app/api/admin/managers/set-phone/route.ts`.
- `app/(admin)/admin/users/manage/ManagersClient.tsx` — added `open_to_reminders` to the `Profile` interface, `handleToggleReminders`, and a switch under the manager's WhatsApp section ("Open to match reminders"). `remindersSaving`/`remindersError` state added.
- `app/(admin)/admin/users/manage/page.tsx` — profiles query now selects `open_to_reminders`.

## Notes / scope

- Default `true` means nothing changes for managers who have not opted out.
- Only the dashboard **match reminder** icons are gated. The generic "Message {username}" button on the managers page (`ManagersClient`) is regular admin contact, not a match reminder, so it stays enabled. The unused `WhatsAppButton` import in `BackdoorSubmissionsClient.tsx` is left as-is.
- No automated reminder sender exists (reminders are admin click-to-WhatsApp links only — see `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`), so no server-side send path needed the flag.
- Verified: `npx tsc --noEmit` clean; `npx next lint` on the changed files clean.

## Files touched

- `supabase/migrations/100_open_to_reminders.sql` (new)
- `components/ui/WhatsAppButton.tsx`
- `components/ui/DashboardFixtureActions.tsx`
- `app/(admin)/admin/dashboard/page.tsx`
- `app/(admin)/admin/dashboard/_desktop.tsx`
- `app/(admin)/admin/dashboard/_mobile.tsx`
- `app/api/admin/managers/set-open-to-reminders/route.ts` (new)
- `app/(admin)/admin/users/manage/ManagersClient.tsx`
- `app/(admin)/admin/users/manage/page.tsx`

## Cross-references

- `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md`
- `.opencode/context/admin-dashboard/whatsapp-reminder-opponent-number-bold-label_2026-10-08.md`
- `.opencode/context/admin-dashboard/whatsapp-reminder-player-target-fix_2026-09-22.md`
- `.opencode/context/admin-dashboard/admin-fixtures-manage-clickable-rows_2026-09-23.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
