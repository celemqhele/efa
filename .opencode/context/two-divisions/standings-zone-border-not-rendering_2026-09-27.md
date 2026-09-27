# Standings Zone Borders Never Rendered on Desktop (Tailwind `border-collapse`)

Fixed the standings zone colours, which the user reported as "all 5 of these are white … no yellow or red, just white" while the footnote legend dots did show yellow and red. The zone config and the data were both correct the whole time; the border was simply on the wrong element. Reported by the user on the `/standings` page after Season 4 was created by `.opencode/context/two-divisions/season-4-two-division-setup_2026-09-27.md`.

## Problem

`.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md` introduced per-division zone colours by putting `border-l-4` + `ZONE_BORDER_CLASS[zone]` on the `<tr>` element of the desktop standings table. That has never actually painted.

Tailwind 3.4.19's preflight sets `border-collapse: collapse` on `table` elements (`node_modules/tailwindcss/src/css/preflight.css`), and `app/globals.css` / `app/tokens.css` contain no override. Under collapsed borders, browsers do not paint borders declared on `<tr>`, so every row rendered white regardless of zone.

The asymmetry that made this confusing:

- The legend (`zoneLegend()`) renders colour as `bg-*` swatches on `<span>`/`<div>` elements, which paint normally — so the footnote showed yellow and red dots while the table itself showed nothing.
- The mobile table (`app/(public)/standings/_mobile.tsx`) is not a real table; each row is a `<Link>` with `border-l-4`, so mobile zone colours always worked.

Confirmed against production rather than assumed: `https://efa-fxyk.vercel.app/standings` HTML contained `border-l-red-500` and `border-l-yellow-400` (the classes were emitted correctly) and the legend text was present, so the failure was purely CSS. Pushing was ruled out as a cause — `git log origin/main..HEAD` was empty, so the zone code was already deployed.

## Fix

`app/(public)/standings/_desktop.tsx`: moved the zone border off the `<tr>` and onto the first `<td>` (the rank cell), which paints reliably under `border-collapse: collapse`.

```tsx
<tr className={`${index % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base'} hover:bg-accent/5 transition-colors cursor-pointer`}>
  {/* The zone border must live on a <td>, not the <tr>: Tailwind's
      preflight sets `border-collapse: collapse` on tables and browsers
      do not paint borders on collapsed <tr> elements, which left every
      zone row white while the legend dots still showed colour. */}
  <td className={`border-l-4 ${borderColor} text-center font-bold px-2 py-2 tabular-nums …`}>{index + 1}</td>
```

`_mobile.tsx` was left unchanged — it already worked.

## Verification
- `npx tsc --noEmit` clean.
- Correctness of the zone maths itself was re-confirmed in `lib/standings-core.ts`: Division 1 with `{ bottom_yellow: 2, bottom_red: 3 }` over 16 rows colours indices 13–15 red and 11–12 yellow, i.e. the 5 rows the user was looking at.

## Next steps / notes
- The same `border-collapse: collapse` trap applies to any future coloured border placed on a `<tr>`. Put it on a `<td>`.
- `lib/standings-core.ts` zone logic is unchanged and remains the single source of truth.
