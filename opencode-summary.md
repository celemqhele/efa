## Summary

### Done
- **Theme system**: 12 CSS custom properties in `tokens.css`, 7 base presets merged with 29 auto-generated presets, `ThemeProvider`, `ThemeSettings`, API routes (save + extract), 2 migrations.
- **29 preset images batch-processed** — 1920x1080 max, 80% JPEG → `public/themes/` (6.4MB total).
- **Float mode removed** — overlay always 0.65; toggle UI + `floatMode` state deleted.
- **Nav logo reverted** — text badge restored; PNGs deleted; `getLogoForTheme()` etc removed.
- **Stale closure bug fixed** — `saveTheme()` accepts `presetId`/`overlayOverride` directly.
- **Container padding increased** — `px-4` → `px-6` in `PageWrapper.tsx`.
- **Phase 1: Bottom Tab Bar** — `BottomTabBar.tsx` (5 tabs + More sheet), `Nav.tsx` simplified (desktop-only links), `PageWrapper` renders both.
- **Phase 2: Bottom Sheets** — `BottomSheet.tsx` (slide-up on mobile, centered modal on desktop); `ConfirmDialog`, `TeamChangeModal`, `ChangePasswordModal` converted.
- **Phase 3: Mobile Content Reflow**:
  - Standings: card-per-team on mobile (`sm:hidden`), compact table on desktop (`hidden sm:block`).
  - Team Profile: horizontal snap scroll for Season Stats on mobile (`snap-x snap-mandatory`), responsive hero (smaller logo/gradient/padding).
  - Fixture Detail: all supplementary sections wrapped in `<details>` collapsible on mobile, always-open on desktop (`lg:pointer-events-none`).
- **Phase 4: Touch Feedback** — `active:scale-[0.99]` on `.card`, `active:opacity-80` on standings mobile links, `active:scale-95` on BottomTabBar tabs.
- **Coach's Notes visibility fix** — now only shown to the relevant manager (`isManager` gate + `isHomeManager`/`isAwayManager` checks per team).

### Blocked
- User to re-provide correct EFA logo files (white + black variants, transparent background).

### Key Decisions
- `useIsMobile()` uses `matchMedia('max-width: 1023px')` (matches `lg` breakpoint).
- `details[open]` pattern for mobile collapsibles: `lg:pointer-events-none` on summary prevents toggling on desktop.
- `.card` uses `active:scale-[0.99]` for subtle press feedback without layout shift.
