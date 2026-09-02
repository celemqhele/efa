# Admin Dashboard — Mobile Card-Stack Swipe + Admin Pill Tab Bar

## Intro
Reworked the mobile admin dashboard so the "Tournaments" and "Fixtures Due"
sections render as a stacked card deck that rotates with up/down swipes, and
replaced the normal bottom pill tab bar with an admin-specific one on all
`/admin/*` mobile pages (admin tabs + a drop-up "More" popover with Manager Mode).

## Problem
On mobile the admin dashboard felt inconsistent with the clean desktop version:
Tournaments and Fixtures Due were horizontal snap-scroll strips (only one row
peeked, weak affordance), and the bottom tab bar still showed the normal user
menu (Home / Fixtures / Results / More) while inside the admin area — its "More"
sheet even presented an "Admin" link to enter a place the user was already in.

## Fix

### 1. New `components/ui/SwipeCardStack.tsx` (client)
Reusable vertical swipe deck. Props: `items`, `renderCard(item, index)`, optional
`empty`, `minH`, `className`.
- One card visible on top of a stack; two cards sit behind it fanned with
  `translateY(11/22px) scale(0.97/0.94)` + reduced opacity for depth.
- Native touch listeners (`{ passive: false }`) on the container; `preventDefault`
  + `stopPropagation` only once the drag exceeds a 4px lock so it doesn't fight
  page scroll or the global pull-to-refresh handler in
  `components/ui/MobileGestures.tsx`. Taps stay clickable (links inside cards).
- Swipe up (≥60px) animates the top card off-screen up and rotates it to the
  bottom of the deck; swipe down reverses (`(top - 1 + count) % count`). Sub-
  threshold drags spring back. Moving top card tracks the finger with
  `translateY` + a slight `rotate(dragY * 0.04deg)`; 300ms ease-out transitions.
- Small HUD row: "Swipe up / down" + `n / total` counter. Renders `empty` for no
  items, plain single card for one item.

### 2. `app/(admin)/admin/dashboard/_mobile.tsx`
- Tournaments: replaced the horizontal `.overflow-x-auto` row with
  `<SwipeCardStack>` reusing the existing tournament card `<Link>` markup
  (name/season, badges, Teams/Fix/Done grid, progress). Kept the count header and
  "See All" link.
- Fixtures Due: replaced the strip with `<SwipeCardStack>` reusing `FixtureDueCard`
  (matchup, MD/time/status, `DashboardFixtureActions`) inside its card shell.
- Rest unchanged (QuickActions chips, Conflicts, Audit Log).

### 3. New `components/ui/AdminTabBar.tsx` (client)
Pill bar mirroring the home `BottomTabBar` style (`rounded-2xl`, backdrop blur,
`safe-area-bottom`, `h-14`, `lg:hidden`):
- Tabs: Dashboard (`/admin/dashboard`), Fixtures (`/admin/fixtures/manage`),
  Seasons (`/admin/seasons`), Applicants (`/admin/tournament-applications`),
  + More (`…`). Active tab highlighted via `usePathname`.
- More = compact popover anchored above the pill (`absolute bottom-full`, rounded
  panel, `animate-slide-up`) listing: Submit Result, Managers, Polls, Hall of
  Fame, Export, Send Push, Backdoor, Users; divider; then **Manager Mode** →
  `/` (exit admin back to the normal experience, replacing the old "Admin" entry)
  and **Logout** (`signOut` + `router.push('/login')`). Tapping outside closes it.

### 4. `components/ui/BottomTabBar.tsx`
Early return: when `pathname.startsWith('/admin') && profile?.role === 'admin'`,
render `<AdminTabBar profile={profile} />` instead of the normal bar. Applies to
every `/admin/*` mobile page automatically (bar is mounted globally via
`components/ui/NavShell.tsx`).

### Files changed
- `components/ui/SwipeCardStack.tsx` (new)
- `components/ui/AdminTabBar.tsx` (new)
- `app/(admin)/admin/dashboard/_mobile.tsx`
- `components/ui/BottomTabBar.tsx`

## Notes / Gotchas
- No animation library in the repo; the deck uses pure inline transforms + CSS
  transitions.
- `SwipeCardStack` uses one native `touchmove` listener per mounted stack; the
  dashboard mounts two (tournaments + fixtures due) — isolated per container.
- Card heights drive the stack container (`min-h` guards layout); behind cards
  are `absolute inset-x-0 top-0` so they fan but are clipped by `overflow-hidden`
  to avoid overlaying the next section.
- The `React.ReactNode` type reference needed an explicit `ReactNode` import
  (new JSX transform has no `React` global in scope).
- Verified: `npx tsc --noEmit`, `npm run lint` (only pre-existing warnings),
  `npm run build` all pass; build-regenerated `public/sw.js` reverted before
  commit. Desktop dashboard untouched (stack + tab bar are mobile-only).

## Related files
- Admin UI chain (mobile shell + admin bar context):
  `.opencode/context/admin-dashboard/tournaments-table-to-card-grid_2026-09-02.md`
  and `.opencode/context/admin-dashboard/tournaments-fixture-counts-pagination_2026-09-02.md`.
- Home (non-admin) pill bar that this mirrors / swaps with:
  `components/ui/BottomTabBar.tsx`.

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |