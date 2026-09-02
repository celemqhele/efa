# Notification Sounds + Missing Notification Triggers

## Problem
- Several events had no in-app/push notification: backdoor submission (admins), backdoor approve/reject (reporting manager), result confirmed (admin push), sack via club-removal route, and postpone (admins).
- Web push notifications were **silent** — `showNotification` never set `renotify`, so replacing an existing notification with the same tag was silent on Android/iOS.
- User wanted a custom notification sound using their own MP3 file (fallback to OS default sound in background).

## Fix
- **Sound file:** copied `C:\Users\mqhel\Downloads\dragon-studio-new-notification-3-398649.mp3` → `public/sounds/efa-notify.mp3` (served at `/sounds/efa-notify.mp3`). Replace the file to change the sound (same filename keeps cache).
- **`app/sw.ts`** (compiles to `public/sw.js` via Serwist; SW disabled in dev, requires `next build`):
  - `showNotification` now sets `tag`, `silent: false`, `vibrate: [200,100,200]`, `renotify: true` (fixes silent Android/iOS notifications).
  - `push` handler posts `{ type: 'play-notification-sound' }` to open window clients so the **client plays the custom sound**; if no client, SW best-effort `new Audio('/sounds/efa-notify.mp3').play()` (OS default sound remains the background fallback).
- **`components/ui/GlobalNotifications.tsx`:** `playNotificationSound()` helper, SW `message` listener for `play-notification-sound`, plays sound on in-app popup (deduped via `lastSoundAtRef`, 2s guard; skips `custom:` manual toasts), added `backdoor_submitted/approved/declined` icons + colours, `handleItemClick` honours `data.url`.
- **`app/(protected)/notifications/_mobile.tsx` / `_desktop.tsx`:** added 3 `backdoor_*` icon entries.
- **New helper `lib/backdoor-notify.ts`:**
  - `notifyBackdoorSubmitted` — in-app + push to **all admins**, type `backdoor_submitted`, `data.url = /admin/backdoor-submissions`.
  - `notifyBackdoorDecision(submissionIds, 'approved'|'declined')` — notifies the **reporting manager**: the submitter answers "Who is NOT responding?" → `side_claimed`; the reporter is always the manager of the team OPPOSITE `side_claimed` (`home` → away manager, `away` → home manager). On approve also `sendAdminPush`. No phone/profile matching (users don't have numbers in the app).
  - `notifyAdminsOfResult` — **push-only** admin alert on result confirmed (tag `result-confirmed`). In-app admin rows already come from DB trigger `037_admin_result_notification_trigger.sql` — push-only avoids duplicate in-app rows.
- **`lib/notify.ts`:** added `AdminNotificationRow` interface + `notifyAllAdmins(supabase, rows)` (fetch admin ids → insert + push per admin).
- **Wired triggers:**
  - `app/api/webhook/route.ts`: `handleBackdoorSideSelect` → `notifyBackdoorSubmitted`; `handleBackdoorAdminDecision` → `notifyBackdoorDecision` (approve + decline, try/catch).
  - `app/api/admin/backdoor/notify/route.ts` (new): admin-auth POST `{ submissionIds, outcome }` → `notifyBackdoorDecision` (used by admin web client).
  - `app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx`: calls the notify route after approve/decline.
  - `app/api/admin/finalise-result/route.ts`: `notifyAdminsOfResult` after manager notifications.
  - `app/api/admin/managers/sack/route.ts`: added `insertNotificationsAndPush` type `sacking` / "You have been sacked" (the club-removal path was missing it).
  - `app/api/admin/postpone-fixture/route.ts` + `app/api/admin/batch-postpone/route.ts`: `notifyAllAdmins` (in-app + push, type `fixture_postponed`).
- No DB migration needed — notification types are just strings in `notifications.type`.

## Notes / Gotchas
- `session.matched_fixture_id` is `string | null` in TS — passed to `notifyBackdoorSubmitted` with `!` (guaranteed set by this stage of the backdoor flow).
- `notifyBackdoorDecision` fetches fixtures/teams with `new Map<string, any>` to avoid TS inference issues (value type defaults to `{}` otherwise).
- SW changes require a **production build + deploy** to take effect; dev server uses the old/inert SW.
- Push-only (no in-app row) notifications: `result-confirmed` for admins (DB trigger covers in-app). All other new notifications create in-app rows + push.

## Related files
- `.opencode/context/backdoor/backdoor-side-inversion_2026-08-16.md` — quotes the `side_claimed` semantics used by `notifyBackdoorDecision` here.
- `.opencode/context/notification-sounds/notification-sounds-mobile_2026-08-15.md` — follow-up: custom sound was silent on mobile (AudioContext unlock fix).

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
