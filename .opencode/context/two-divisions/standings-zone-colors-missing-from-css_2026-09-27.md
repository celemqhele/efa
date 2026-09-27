# Standings Zone Colours Were Missing From The CSS Entirely (Tailwind `content` Never Scanned `lib/`)

Found the actual cause of the zone colours never appearing next to team names. The user re-reported after the fix in `.opencode/context/two-divisions/standings-zone-border-not-rendering_2026-09-27.md` deployed: "the footnote is there, but the colour next to the team names is not. it's still white." That earlier fix was necessary but not sufficient.

## Problem

`tailwind.config.ts` only declared three content globs:

```ts
content: [
  './pages/**/*.{js,ts,jsx,tsx,mdx}',
  './components/**/*.{js,ts,jsx,tsx,mdx}',
  './app/**/*.{js,ts,jsx,tsx,mdx}',
]
```

`./lib/` was **not** scanned. `ZONE_BORDER_CLASS` in `lib/standings-core.ts` — introduced by `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md` — is the only place these class names appear:

```ts
top_green: 'border-l-emerald-500',
top_yellow: 'border-l-yellow-400',
bottom_yellow: 'border-l-yellow-400',
bottom_red: 'border-l-red-500',
```

Since nothing under `pages/`, `components/` or `app/` contains those literal strings, Tailwind never generated the rules. The rendered row therefore had `border-l-4` (a *width*, which **is** referenced from `app/`) but **no colour**, so the border painted in the inherited/transparent default and looked white.

Verified directly against the deployed CSS bundle rather than by guesswork:

- `.border-l-4` → present
- `.border-l-accent`, `.border-l-border`, `.border-l-transparent` → present (used from `app/`)
- `.border-l-yellow-400` → **absent**
- `.border-l-emerald-500` → **absent**
- `.border-l-red-500` → **absent** (an earlier `border-l-red-500` grep "hit" was a false positive: the bundle contains `.border-l-red-500\/40`, a different 40%-opacity utility used elsewhere)

This is exactly why the footnote legend rendered correctly while the rows did not: `ZONE_SWATCH_CLASS` uses `bg-emerald-500` / `bg-yellow-400` / `bg-red-500` and lives in `app/(public)/standings/_desktop.tsx`, which *is* scanned.

So the zone colour feature had never actually rendered since it was added on 2026-09-02.

## Fix

`tailwind.config.ts`: added `'./lib/**/*.{js,ts,jsx,tsx}'` to `content`, with a comment explaining that `lib/` holds class-name maps referenced from `app/`.

This is the general fix — it also covers any other Tailwind class declared only in `lib/`, not just the three zone colours.

Both changes are needed and complementary:

- `tailwind.config.ts` makes the colour rules exist at all.
- `.opencode/context/two-divisions/standings-zone-border-not-rendering_2026-09-27.md` moved the border off the `<tr>` onto the first `<td>`, because Tailwind's preflight sets `border-collapse: collapse` and browsers do not paint borders on collapsed `<tr>` elements.

## Verification
- `npm run build` compiles successfully, and the emitted CSS now contains `.border-l-red-500{`, `.border-l-yellow-400{` and `.border-l-emerald-500{` — all three were missing before the change.
- Build output shows only pre-existing lint warnings (unused imports/vars in poll and admin pages).

## Next steps / notes
- When adding a Tailwind class in `lib/`, `components/`, or any other shared module, remember `lib/` only became a scanned path in this change; anything outside the four content globs is still silently dropped.
- If a colour "does nothing", check the built CSS for the class before suspecting CSS specificity — a missing rule means a purge problem, not a cascade problem.
- The `standings_zones` maths in `lib/standings-core.ts` was correct throughout and needed no change.
