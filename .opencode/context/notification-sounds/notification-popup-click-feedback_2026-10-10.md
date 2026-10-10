# In-App Notification Popup: Dead Clicks + No Exit Animation + 5s Lag

The in-app notification popup (`components/ui/GlobalNotifications.tsx`, the modal
with the gold **OK** button) now closes with a fade-out animation and responds to
clicks instantly. The user reported that clicking a notification row did nothing
(no navigation, no animation, unsure if it worked) and that the OK button kept the
popup on screen with no feedback and then took ~5 seconds to "load the page".

## Problem
- **Row clicks felt dead.** `handleItemClick` called `router.push(...)` but **never
  closed the popup**, so the modal stayed mounted on top of the destination page and
  looked like nothing happened. Rows without a target (`match_reminder`,
  `fixtures_released`, etc. — many notifications only carry a `date`/`tournament_id`,
  not a `fixture_id`/`team_id`/`url`) were `disabled`, so clicking them was a literal
  no-op with no feedback. Verified in the DB: e.g. 4352 `match_reminder` rows have
  `data` but zero with `url`/`fixture_id`/`team_id`.
- **OK "hung".** `handleDismiss` was `async` and `await`ed the Supabase
  `notifications.update({ read: true })` **before** `setIsOpen(false)`, then called
  `router.refresh()` (full server re-render of the whole layout/page). So the click
  appeared to do nothing for the whole round-trip + refresh.
- **No exit animation.** Only enter animations existed (`animate-slide-up`,
  `animate-fade-in`); the popup unmounted with no transition.

## Fix
- **`tailwind.config.ts`** — added a `fade-out` animation (`fadeOut 0.18s ease-in
  forwards`) + `fadeOut` keyframes (opacity only, intentionally no transform so it
  does not fight the desktop `-translate-x-1/2 -translate-y-1/2` centering).
- **`components/ui/GlobalNotifications.tsx`**
  - New `isClosing` state + `closeTimerRef`. `closePopup()` sets `isClosing`, waits
    180ms (matching the CSS), then unmounts and clears `results`/`others`. The timer
    is cleared on unmount and cancelled if a fresh notification arrives.
  - Backdrop + popup use `${isClosing ? 'animate-fade-out' : 'animate-fade-in' /
    'animate-slide-up'}`.
  - `persistRead()` is fire-and-forget (`void (async () => { await update...
    })().then -> router.refresh()`), so the close animation is never blocked by the
    network / server re-render. `router.refresh()` is kept so the nav unread badge
    reconciles.
  - `dismissAll()` (used by OK and backdrop) adds every shown key to
    `dismissedKeysRef` first, closes, then persists read.
  - `handleItemClick` derives the URL (`data.url` ?? `/fixtures/{fixture_id}` ??
    `/teams/{team_id}`), closes the popup immediately, persists read (navigation
    refetches the server tree, so no extra `router.refresh()`), then `router.push`.
  - `ResultRow`/`OtherRow` are no longer `disabled`; added
    `active:scale-[0.98] active:bg-bg-elevated transition` so every row gives an
    immediate press response. A row with no target now still closes/dismisses
    (visible feedback) instead of silently ignoring the click.
- No DB change. Client-only (ships with a normal deploy; no SW rebuild needed for
  this specific fix).

## Related files
- `.opencode/context/notification-sounds/notifications-sounds_2026-08-15.md` — the
  original push/in-app notification wiring this popup renders.
- `.opencode/context/notification-sounds/notification-sounds-mobile_2026-08-15.md` —
  the AudioContext unlock fix for the custom sound played from this same component.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
