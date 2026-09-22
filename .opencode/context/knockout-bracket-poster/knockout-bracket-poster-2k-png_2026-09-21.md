# Knockout Bracket Poster (2K PNG) — EFA International Cup 2026 — 2026-09-21

Created a landscape 2560x1440 (2K) PNG poster of the EFA International Cup 2026 knockout bracket, showing both halves meeting at the final, with TBC shielding icons (the same lucide `ShieldQuestion` used for vacant clubs) on every QF/SF/FINAL winner slot and the "Fixtures will be released 21 September 23:30" footer note.

## Problem
The user had just run the knockout draw for the EFA International Cup 2026 and wanted a page/image visual of the bracket (left side vs right side meeting at the final), for posting on the league's WhatsApp group. Requirements answered by the user:
- High-quality **2K resolution PNG**
- Teams only, with the current manager in brackets underneath (e.g. `Norway` / `(wandile)`)
- Show the **full TBC structure** so people know who faces who if they progress
- Same navy/gold EFA design as the league-placement announcement (`.opencode/context/two-divisions/psl-motsepe-placement-pdf-announcement_2026-09-21.md`)
- Footer note: fixtures will be released 21 September 23:30

## Researched data (Supabase, `npm run db`)
- Tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a` (EFA International Cup 2026, active).
- R16 fixtures from `fixtures` (matchday + teams): 51 Norway vs Brazil; 52 Tunisia vs Switzerland; 53 Belgium vs England; 54 Morocco vs Sweden; 55 France vs Cabo Verde; 56 Spain vs USA; 57 Egypt vs South Korea; 58 Senegal vs Cote D Ivoire.
- Progression paths from `lib/tournament-progression.ts` `BRACKET_PROGRESSION`: 51,52 → QF1; 53,54 → QF2; 55,56 → QF3; 57,58 → QF4; QF1,QF2 → SF1; QF3,QF4 → SF2; 201,202 → 301 FINAL.
- Current managers from `manager_tenures` (`ended_at IS NULL`): Norway→wandile, Brazil→tildedot, Tunisia→jobe, Switzerland→minenhle22, Belgium→siyethemba_, England→parmalat_, Morocco→Terrence, Sweden→siyambonga23, France→goat_2, Cabo Verde→uvesh, Spain→calvin, USA→tbhotouch, Egypt→ghost, South Korea→skoozz420, Senegal→loki, Cote D Ivoire→blessing_100sk.

## Implementation
- `scripts/guide/knockout-bracket.tsx` — new @react-pdf/renderer doc. Canvas 1280x720pt (1:2 ratio → 2560x1440 at 144 DPI). Navy/gold palette reused from `scripts/guide/shared.tsx`. Layout: title header + EFA logo, R16 match cards at far left/right (home VS away with manager brackets), QF/SF boxes converging inward to a center FINAL box, gold elbow connectors drawn as SVG `<Line>`s, footer note pill.
- Added an inline `TbcIcon` component that re-draws the lucide `ShieldQuestion` icon (same icon `components/ui/TeamLogo.tsx` uses for vacant/"No Name" clubs, per `.opencode/context/tbc-badge/tbc-club-to-shield-and-empty-string-fix_2026-08-25.md`) as react-pdf `<Path>`s in gold — used on every winner slot so all unpredictable places read as TBC.
- `scripts/generate-bracket-png.tsx` — renders the doc to a PDF via `renderToFile`, then converts to PNG with local Ghostscript `gswin64c.exe` at `-r144`, producing exactly 2560x1440px; output `public/EFA-InternationalCup-KnockoutBracket.png`.
- `package.json` — added `"generate-bracket-png": "tsx scripts/generate-bracket-png.tsx"`.

## Verification
- `npx tsc --noEmit` — clean.
- Ghostscript `txtwrite` of the intermediate PDF confirmed every team (16), manager (16), round label (QF 1–4, SF 1–2, FINAL), winner labels (Winner 51–58, Winner QF1–4, Winner SF1–2) and the fixtures-release footer are present.
- `sharp` pixel-region sampling of the PNG confirmed: navy page bg, gold connector segments on both left and right halves, and each box's border/text at expected coordinates.

## Note
- A bug was caught during pixel verification: the connector builder iterated the coordinate array with `i += 4` (skipping every vertical elbow segment); fixed to `i += 2` so all three segments of each elbow render. Caught by checking gold pixels along the vertical connector columns (left half showed 45 [128,..] hits after fix, right half expected positions re-checked).