# Custom Notification Sound Silent on Mobile

## Problem
- The custom notification sound (`.opencode/context/notifications/notifications-sounds_2026-08-15.md`) worked on desktop but was **silent on mobile** (Android Chrome / iOS Safari).
- Root cause: `playNotificationSound()` did `new Audio('/sounds/efa-notify.mp3').play()` with **no user gesture** (it's fired from a SW `message` event or the 60s poll). Mobile browsers block autoplay-with-sound without a gesture, so the promise rejected and `.catch(() => {})` swallowed it → silent. Desktop Chrome allows autoplay after any past page interaction, so it worked.
- Secondary bug: `app/sw.ts` had a `new Audio('/sounds/efa-notify.mp3').play()` fallback inside the service worker. `Audio` is not available in `ServiceWorkerGlobalScope` on Chrome — it always throws and is caught. Dead code that can never play a custom sound.

## Fix
- **`components/ui/GlobalNotifications.tsx`** — Web Audio unlock pattern:
  - Module-level singletons: `audioCtx` (one `AudioContext`), `soundBuffer` (decoded MP3), `soundDecoding` (in-flight decode promise).
  - `ensureSoundDecoded()`: `fetch('/sounds/efa-notify.mp3')` → `arrayBuffer` → `ctx.decodeAudioData` (cached; resets itself on failure).
  - `unlockAudio()`: on the first user gesture, `ctx.resume()` (suspended → running) and kick off the decode. Registered as `pointerdown`/`touchstart`/`keydown` listeners (capture phase, removed on unmount).
  - `playNotificationSound()`: if `audioCtx` is `running` and the buffer is decoded, schedule via `createBufferSource` → `createGain(0.8)` → destination (`BufferSource.start()` plays without a gesture once the context is unlocked). Otherwise falls back to element-based `new Audio().play()` (covers desktop / already-unlocked media).
- **`app/sw.ts`**: removed the dead worker-side `new Audio()` fallback. Now the `push` handler only posts `play-notification-sound` to open window clients; with no open client the OS/browser default notification sound (`silent: false`) is the fallback.

## Notes / Gotchas
- The custom sound now plays on mobile **only while the page is open AND the user has tapped anywhere at least once** (which unlocks the `AudioContext`). The user tapping "Allow" on the push prompt is a gesture, so this is normally satisfied.
- **Android background**: custom sound is impossible for web apps in the background — the OS plays the site's default notification sound, governed by the notification channel in phone settings (Apps → Chrome → Notifications, or the site channel). Can't be changed from code.
- **iOS**: web push notifications are only shown when the PWA is NOT in the foreground (foreground notifications are suppressed entirely → no sound). Background/iOS notifications always use the default iOS sound; custom sounds aren't supported.
- If a user never interacts with the page, `AudioContext` stays `suspended` and playback falls back to the element path, which mobile blocks → silent. Acceptable, expected browser policy.
- SW change (`app/sw.ts`) requires a **production build + deploy**; the client change ships with any normal deploy.
- Verified with `npm run build` (SW compiled without `new Audio`; root layout chunk contains `AudioContext` + `decodeAudioData`). Only pre-existing lint warnings, no new ones.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
