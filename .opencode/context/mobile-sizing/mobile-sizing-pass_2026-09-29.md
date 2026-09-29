# mobile-sizing — mobile spacing pass (2026-09-29)

Per-screen mobile sizing fixes for `/profile`, `/admin/fixtures/manage` and `/admin/results/submit`, plus the shared shell change that all three were inheriting. Builds on `.opencode/context/mobile-sizing/token-aliases-and-alpha_2026-09-29.md`, which had to land first because several of these files were still referencing the dead navy/gold palette names.

## Problem
- `PageWrapper` rendered `<main>` as `px-6 pt-12 pb-space-8 lg:pt-0`. That is 32px of gutters **plus** each page's own `px-4` (48px total per side), and 160px of top padding.
- The top padding was pure waste: `Nav._mobile` is entirely `position: fixed` (a `top-3` logo button and bell, no in-flow height), so nothing occupied that 160px. Only the desktop nav contributes in-flow height, and it already carries its own `hidden lg:block h-24` spacer.
- `BottomTabBar` and `AdminTabBar` each rendered `<div className="h-20 lg:hidden" />` to clear their own fixed bar. That spacer sat **before** `<main>` in `NavShell`, so it pushed 80px of blank space *above* the first heading rather than below the content — on every page.
- `NavSkeleton` (the Suspense fallback) rendered a 64px bar on mobile too, adding another 64px of phantom space that vanished on hydration.
- The three screens picked fixed sizes with desktop in mind: 160px card padding on submit, 48-56px logos, 80-90px name caps, 28-32px tap targets. At 360px these overflowed or shifted.
- `ResultSubmitClient` used `card p-12` (160px each side) in three places, plus `min-w-[240px]` + `p-6` on the "Fixture Completed" matchup panel, which cannot fit at any phone width.
- Admin fixture cards put time, round, matchday and status in one `flex flex-wrap` row, so the status pill jumped position depending on how long the round label was. The matchup was a `<p className="flex items-center gap-1.5">` with unbounded flex children, so long club names pushed the logos around.
- `/profile` playstyle and country `<select>` elements were flex children without `min-w-0`. A native select's intrinsic width is its widest `<option>` ("Set-Piece Specialists", "+389 North Macedonia"), so `flex-1` alone could not shrink them and they burst their cards.
- The result-submit fixture list used `truncate` on a flex child, which never engages while the parent has `min-width: auto`.

## Solution
### Shared shell
`components/ui/PageWrapper.tsx`
- `min-h-screen` -> `min-h-dvh`; `bg-navy` -> `bg-bg-base` (the `bg-navy` here was itself one of the dead classes).
- `NavSkeleton` -> `hidden lg:block`, so mobile no longer reserves 64px for a nav that is entirely fixed.
- `<main>` -> `max-w-[1440px] mx-auto px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:px-6 lg:pt-0 lg:pb-space-8`. Mobile gutters now live in the shell (16px instead of 32px), top padding is 16px instead of 160px, and bottom clearance matches the fixed tab bar's height plus the safe area. `fullWidth` still opts out entirely.

`components/ui/BottomTabBar.tsx`, `components/ui/AdminTabBar.tsx`
- Deleted the `h-20 lg:hidden` in-flow spacers, with a comment pointing at the shell's bottom padding. The bars are `fixed`, so the shell padding is the correct place for this.

Because the shell now supplies 16px, the three target screens dropped their own duplicate `px-4`. Other pages keep theirs and land at 32px instead of the previous 48px without needing edits.

### `/profile` — `app/(protected)/profile/_mobile.tsx`
- Playstyle: icon + select in one row, the conditional Save button full-width underneath. Select gets `flex-1 min-w-0 w-full h-11`; the Save button is `w-full min-h-[44px]` (it was a `py-1` chip sharing a row with the select, which is what forced the select to stay wide).
- Phone: same two-row restructure. The country select is `shrink-0 w-20 max-w-[5rem] tabular-nums` and renders `+{code}` as the option text, with the full label kept in `title` (the desktop variant still shows the full label). Input gets `flex-1 min-w-0 w-full h-11`. `phoneError` moved to `text-feedback-error`.
- Card `p-space-6` -> `p-space-5`, container `space-y-space-8` -> `space-y-space-5`, card gap `space-y-space-6` -> `space-y-space-5`.
- Last `text-gold` references converted to `text-accent`; the file now references no legacy palette names.

### `/admin/fixtures/manage`
`_mobile.tsx`
- Page wrapper `px-4 pb-8` -> `pb-8`. Empty state `p-8` -> `p-6`. Section meta `text-[9px]` -> `text-[10px] truncate`.
- Fixture card `p-4` -> `p-3`, internal `space-y-3` -> `space-y-2.5`.
- Header split into two stable groups: a `min-w-0 flex-1` left group (time / round / matchday, each `shrink-0` or `truncate`) and a `shrink-0` status pill. The pill no longer moves with the round label length.
- Matchup replaced the single `<p className="flex items-center gap-1.5">` with `grid grid-cols-[1.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_1.25rem] items-center gap-1.5`: fixed logo gutters, `minmax(0,1fr)` name columns, centred `auto` score column. Every card now has identical internal positions, and both names truncate.
- Aggregate / penalty chips moved inline (`flex items-center gap-1`) with `tabular-nums`.

`FixtureActions.tsx`
- Action buttons `py-1` (a ~28px tap target) -> `min-h-[44px] px-2.5 flex-1 min-w-[8.5rem] inline-flex items-center justify-center`, so they wrap two per row on a phone and fill the width on wider screens.
- These buttons deliberately remain **outside** the fixture `<Link>`, preserving the clickable-row fix from `.opencode/context/admin-dashboard/admin-fixtures-clickable-rows_2026-08-13.md` — nesting a button or anchor inside another anchor is invalid HTML.

### `/admin/results/submit`
`_mobile.tsx` — dropped the duplicate `px-4`; heading block gets `min-w-0`.

`ResultSubmitClient.tsx`
- All three `card p-12` -> `card p-6` / `p-5 sm:p-6` / `p-6 sm:p-8`.
- "Fixture Completed" panel: `p-6 ... inline-block min-w-[240px]` -> `p-4 ... w-full max-w-sm mx-auto`; logos `w-14` -> `w-12`; each logo column `flex-1 min-w-0`; "vs" `shrink-0`; status `break-words`; reset button `w-full sm:w-auto min-h-[44px]`. The red error styling also moved off `bg-red-50` / `border-red-100` (light-mode values on a dark surface) onto `red-500/10` equivalents.
- Fixture header: logos `w-10 h-10 sm:w-12 sm:h-12 shrink-0`; name caps `max-w-[64px] sm:max-w-[80px] truncate mx-auto`; tournament cap `max-w-[72px] sm:max-w-[90px]`; mode toggle `min-h-[40px]`.
- Fixture list rows: `min-h-[44px]`; the name span got `truncate min-w-0`; the conflict icon is `shrink-0`.
- Status filter tabs: `min-h-[40px]`.
- Token cleanup across the file (`text-foreground-*`, `bg-navy-light`, `border-navy-border`, `bg-gold`, `border-gold`, `text-gold`, `text-navy` -> canonical names) and the `bg-bg-surface0/10` typo -> `bg-bg-elevated`. The file no longer references any legacy palette name.

## Files changed
- `components/ui/PageWrapper.tsx`
- `components/ui/BottomTabBar.tsx`
- `components/ui/AdminTabBar.tsx`
- `app/(protected)/profile/_mobile.tsx`
- `app/(admin)/admin/fixtures/manage/_mobile.tsx`
- `app/(admin)/admin/fixtures/manage/FixtureActions.tsx`
- `app/(admin)/admin/results/submit/_mobile.tsx`
- `app/(admin)/admin/results/submit/ResultSubmitClient.tsx`
- `AGENTS.md` (registered the new `mobile-sizing/` category)

## Verification
- `npx tsc --noEmit` — clean.
- `npm run lint` — no new errors; only pre-existing unused-var warnings.
- `npm run build` — compiled successfully.
- Layout probed in a real Chrome at 360x740 and 360x844 / 390x844 against a running dev server, reading computed styles: `main` padding is `16px / 16px / 16px / 72px`, `main` top offset is `0` (was 80px from the spacer), `body` background resolves to `rgb(15, 17, 23)`, and `documentElement.scrollWidth === clientWidth` (no horizontal overflow) on the public pages.
- Confirmed in the generated CSS that `grid-cols-[1.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_1.25rem]`, `max-w-[64px]`, `min-h-[44px]`, `pb-[calc(4.5rem+env(safe-area-inset-bottom))]` and `min-w-0` are all emitted.
- Confirmed none of the removed constructs remain: no `p-12` and no `min-w-[240px]` in the submit client, no `h-20 lg:hidden` spacer in either tab bar, and no legacy palette names in any of the three target screens.

## Not verified
The three target routes all redirect to `/login` (HTTP 307), so they could not be screenshotted without a signed-in session. Layout there was verified by static CSS emission and computed-style probes on the public routes, not by visual inspection of the real pages. Same for the `BottomSheet` / modal animations, which only render behind auth.
