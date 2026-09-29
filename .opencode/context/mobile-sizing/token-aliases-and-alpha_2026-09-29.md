# mobile-sizing — token aliases and alpha support (2026-09-29)

Restored the dead Tailwind colour utilities and added opacity-variant support across the codebase. This is the prerequisite layer for the per-screen mobile sizing pass in `.opencode/context/mobile-sizing/mobile-sizing-pass_2026-09-29.md`.

## Problem
- The theme colours in `tailwind.config.ts` were declared as plain `var(--color-*)` strings. Tailwind cannot synthesise opacity modifiers from that form, so every `/N` variant (`bg-accent/15`, `border-gold/40`, `ring-accent/20`) silently emitted **no CSS**. A repo-wide audit found ~296 dead accent-alpha and ~68 dead border-alpha references.
- The app was repainted from a navy/gold palette onto `bg`/`text`/`border`/`accent` tokens, but several hundred call sites were left on the old names (`bg-navy-light`, `border-navy-border`, `text-foreground-primary`, `bg-gold/10`, `text-navy`, ...). None of those names were in the theme, so they rendered completely unstyled. `ResultSubmitClient.tsx` alone had 71 such references.
- One file used `bg-bg-surface0/10`; there is no `surface0` colour at all, so it never rendered.
- `tailwindcss-animate` is not installed, but its class names are already used by `BottomSheet.tsx` (4x `animate-in`, 3x `zoom-in-95`, 1x `slide-in-from-bottom`), `DNABadge.tsx`, `TeamStateBadge.tsx` and nine admin modal components (9x `animate-scale-in`). All of them emitted nothing, so every dialog and bottom sheet opened with no transition at all.
- Fractional custom spacing was missing from `theme.extend.spacing` — `gap-space-2.5` / `p-space-2.5` were used in 18 places across 9 files but no `1.5` or `2.5` keys existed. (The `space-N` numeric keys already existed as a separate legacy set.)

## Solution
`app/tokens.css` — appended a `--color-*-rgb` channel triplet for every existing hex token (bg-base, bg-surface, bg-elevated, text-primary/secondary/muted, border, border-subtle, accent, accent-hover, accent-muted, feedback-success/warning/error), with a comment stating the hex tokens remain in use by `globals.css` and inline styles and the two sets must be kept in sync.

`tailwind.config.ts`:
1. Re-declared every semantic colour as `rgb(var(--channel) / <alpha-value>)` so Tailwind generates arbitrary opacity modifiers.
2. Added the legacy aliases: `gold.DEFAULT` -> accent, `gold.light` -> accent-hover, `navy.DEFAULT` -> bg-base, `navy.light` -> bg-elevated, `navy.border` -> border, `foreground.primary/secondary/muted` -> the matching text tokens. These make the old call sites render correctly without touching ~500 files, and they now support `/N` too.
3. Added the fractional spacing keys `1.5` (6px) and `2.5` (10px), both bare and `space-`-prefixed. The existing custom scale (`p-6`=32px, `p-8`=64px, `p-10`=96px, `p-12`=160px) was deliberately left untouched.
4. Added the four missing animation classes as **custom plugin utilities**, not via `theme.extend.animation`.

### Why the animations are a plugin, not a theme key
First attempt put them in `theme.extend.animation` with keys `animate-in`, `animate-scale-in`, `zoom-in-95`, `slide-in-from-bottom` and the built CSS contained none of them. Cause: `theme.extend.animation` keys are **suffixes** — a key of `scale-in` produces the class `animate-scale-in`, so those keys only ever produce `animate-animate-in`. The map also cannot produce unprefixed names at all, so `zoom-in-95` and `slide-in-from-bottom` are unreachable that way. They are now declared with `addUtilities` in `plugins: []`, along with their `@keyframes` (`efaModalIn`, `efaSheetUp`) so the keyframes are emitted with the utilities that reference them. The names are prefixed `efa-` to avoid colliding with the theme's own `slideUp`.

## Files changed
- `app/tokens.css`
- `tailwind.config.ts`

## Verification
- `npx tsc --noEmit` — clean.
- `npm run lint` — no new errors; only pre-existing unused-var warnings.
- `npm run build` — compiled successfully.
- Verified against the generated CSS, not just the config. A one-off Tailwind CLI run over the real `content` globs confirmed `.bg-accent/10`, `.border-accent/40`, `.text-text-muted/70`, `.bg-navy-light`, `.text-foreground-primary`, `.border-navy-border`, `.gap-space-2.5`, `.animate-in`, `.animate-scale-in`, `.zoom-in-95`, `.slide-in-from-bottom` and `@keyframes efaModalIn` are all emitted.

## Note
`PageWrapper` still had `bg-navy`, which was one of the dead classes; it is now `bg-bg-base` as part of `.opencode/context/mobile-sizing/mobile-sizing-pass_2026-09-29.md`.
