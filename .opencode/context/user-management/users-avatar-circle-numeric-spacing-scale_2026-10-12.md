# Users & Managers page: "no avatar" fallback circle was 80px

Fixed the oversized placeholder profile circle on `/admin/users/manage` for users with no `avatar_url`. The cause was not the page's own styling but the repo's custom Tailwind numeric spacing scale: `w-9 h-9` resolves to `var(--space-9)` = **80px**, while the real avatar image next to it renders at 36px. All avatar fallbacks on that page are now explicit pixel sizes matching their images.

## Problem

Reported: on `https://efa-fxyk.vercel.app/admin/users/manage`, when a user has no profile picture the placeholder circle is "really huge".

`tailwind.config.ts` overrides the **numeric** `theme.extend.spacing` keys (`1`…`12`) with the `--space-*` tokens, where `--space-5..12` are 24/32/48/64/80/96/128/160px instead of Tailwind's default 20/24/28/32/36/40/44/48px. Because `theme.width`/`theme.height` derive from that spacing scale, the width/height utilities are inflated too. Verified in the generated CSS (`.next/static/css`):

| class | emitted CSS | resolves to | image it pairs with |
|---|---|---|---|
| `.w-9` / `.h-9` | `var(--space-9)` | **80px** | `next/image` at 36px |
| `.w-8` / `.h-8` | `var(--space-8)` | 64px | 32px |
| `.w-7` / `.h-7` | `var(--space-7)` | 48px | 28px |
| `.w-10` / `.h-10` | `var(--space-10)` | 96px | 40px |

So every *fallback* circle (a `div` whose only size comes from the class) rendered at 2–2.7x the real avatar image beside it, and the mismatch was most obvious on the All Users rows, where an 80px circle sat next to a 36px image in the same column. The inflated scale itself is deliberate for padding/gap (see `.opencode/context/mobile-sizing/token-aliases-and-alpha_2026-09-29.md`, step 3: "The existing custom scale (p-6=32px, p-8=64px, p-10=96px, p-12=160px) was deliberately left untouched"), so this file fixes the call sites rather than the scale.

## Fix

Replaced the numeric size classes on the avatar fallbacks with explicit pixel arbitrary values (which bypass the spacing scale), and added `shrink-0` alongside so the circle can never be squashed into an oval in its flex row:

`app/(admin)/admin/users/manage/UsersAndManagersClient.tsx`
- Manager Applications (desktop table + mobile card) and Pending Team Change Requests (desktop table + mobile card) fallbacks: `w-7 h-7` (48px) -> `w-[28px] h-[28px] shrink-0`, matching the 28px `<Image>` (4 occurrences).
- All Users (desktop table + mobile card) fallbacks: `w-9 h-9` (80px) -> `w-[36px] h-[36px] shrink-0`, matching the 36px `<Image>` (2 occurrences).
- Matching `<Image ... width={28} height={28} />` and `width={36} height={36} />` avatars got `shrink-0` so both branches of the avatar render identically (6 occurrences).

`app/(admin)/admin/users/manage/ManagersClient.tsx`
- "Current Manager" fallback: `w-10 h-10` (96px) -> `w-[40px] h-[40px]`, matching the 40px `<Image>`.
- "Assign a Manager" list fallback: `w-8 h-8` (64px) -> `w-[32px] h-[32px]`, matching the 32px `<Image>`.
- The 40px `<Image>` in the Current Manager row got `shrink-0` (the 32px one already had it).

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — compiled successfully; `/admin/users/manage` still generated (12.2 kB). Only pre-existing lint warnings (e.g. the unused `pendingCount` in the same file) remain.
- Confirmed against the generated CSS, not just the config, that `.w-[28px]`, `.h-[28px]`, `.w-[32px]`, `.h-[32px]`, `.w-[36px]`, `.h-[36px]`, `.w-[40px]` and `.h-[40px]` are all emitted with literal pixel values.
- Not verified visually: `/admin/users/manage` is auth-gated (redirects to `/login`), so the page could not be screenshotted without an admin session. Sizing was verified by CSS emission, not by pixel inspection of the live page.

## Follow-up (not done here)

The same inflated numeric width/height utilities are used across the app for avatar/logo fallbacks, e.g. `components/ui/GlobalSearch.tsx` and `components/ui/GlobalNotifications.tsx` (`w-7 h-7` -> 48px), `app/(public)/teams/[id]/_mobile.tsx` (`w-9 h-9` -> 80px) and `app/(public)/fixtures/[id]/_mobile.tsx` (`w-8 h-8` -> 64px). Those pages have not been reported and were left alone; a global fix would mean overriding `theme.width`/`theme.height` (and `minWidth`/`minHeight`) back onto the default pixel scale, which would also move every `p-5`/`p-6`-adjacent layout that relies on the current custom scale.

## Files changed

- `app/(admin)/admin/users/manage/UsersAndManagersClient.tsx`
- `app/(admin)/admin/users/manage/ManagersClient.tsx`
