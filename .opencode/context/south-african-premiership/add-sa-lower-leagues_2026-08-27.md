# South African Lower Leagues — Motsepe Foundation Championship + ABC Motsepe League

## What was done
Extended the EFA platform with the two lower South African divisions below the Betway Premiership, making all three levels of South African football selectable.

## Logo Processing
- Source 1: `C:\Users\mqhel\Downloads\Motsepe Foundation Championship` (16 files, 2nd division)
- Source 2: `C:\Users\mqhel\Downloads\ABD Motsepe League` (20 files, 3rd division)
- Formats in source: png, jpeg, jpg, svg, webp — all converted to PNG
- Backgrounds removed, resized to 5 standard sizes (64x64, 128x128, 256x256, 512x512, 700x700)
- Converted to palette mode (P) with transparency (matching existing league logos)
- Normalized fill ratios to ~65% (matches Betway Premiership benchmark) — verified 63.9%–64.8% across both leagues
- SVG sources rasterized via sharp (used for University of Pretoria and The Spartans)
- Output folders:
  - `public/logos/motsepe-foundation-championship-2026-2027.football-logos.cc/`
  - `public/logos/abc-motsepe-league-2026-2027.football-logos.cc/`
- Processing script: `.recycle/process-sa-lower-leagues.py` (one-off, moved to recycle)

## Team slugs — Motsepe Foundation Championship (16)
```
cape-town-city, casric-stars, gomora-united, highbury, hope, hungry-lions,
the-bees, leicesterford-city, lerumo-lions, magesi, midlands-wanderers,
north-west-university, orbit-college, university-of-pretoria, upington-city, venda
```

## Team slugs — ABC Motsepe League (20)
```
ben-10, boipatong-young-pirates, dinoko-city, doornkop-students,
dube-continental, jbm, jomo-cosmos, leruma, lesco, mabopane-jm,
mm-platinum-la-masia, rrr-rams, supersport, tembisa-destroyers,
tembisa-hollywood-thunder, the-spartans, tshwane-south-college,
tut, uj, wits-sport
```

## Files modified
- `lib/efootball-2027-teams.json` — added `motsepe-foundation-championship-2026-2027.football-logos.cc` (16) and `abc-motsepe-league-2026-2027.football-logos.cc` (20) blocks
- `lib/logo-resolver.ts` — added both folders to `getLeagueFolders()` + display names "Motsepe Foundation Championship" and "ABC Motsepe League"
- `app/(public)/premiership/page.tsx` — now queries all three leagues and groups teams by league
- `app/(public)/premiership/_shell.tsx` — takes `leagues` prop
- `app/(public)/premiership/_desktop.tsx` — renders a section per league (header + tier + 4-column team grid)
- `app/(public)/premiership/_mobile.tsx` — renders a section per league (3-column team grid)
- `public/logos/motsepe-foundation-championship-2026-2027.football-logos.cc/` — 80 PNGs (16 × 5)
- `public/logos/abc-motsepe-league-2026-2027.football-logos.cc/` — 100 PNGs (20 × 5)

## Database
- 36 teams inserted into `teams` table (16 Championship + 20 ABC) — `npm run db` confirmed "INSERT (36 rows)"
- SQL insert: `.recycle/insert-sa-lower-leagues.sql` (one-off, moved to recycle)
- Added with `ON CONFLICT DO NOTHING` to avoid duplicates

## Announcement page
- Route: `/premiership`
- Now titled "South African Football Leagues", shows all three leagues each in its own section with tier labels:
  - Betway Premiership (Division 1)
  - Motsepe Foundation Championship (Division 2)
  - ABC Motsepe League (Division 3)
- Still uses `news_thumb` (256x256) context for logo rendering

## Promotion note
Hope and North West University are placed in the Motsepe Foundation Championship (not ABC) — consistent with their promotion from the ABC league for 2026-27.

## Key config values
- Championship folder: `motsepe-foundation-championship-2026-2027.football-logos.cc`
- ABC folder: `abc-motsepe-league-2026-2027.football-logos.cc`

## Typecheck / lint
- `npx tsc --noEmit` — clean
- `npm run lint` — only pre-existing warnings, none from this change

## Restore File Section
| Original Path | Purpose | New Path |
|---|---|---|
| `scripts/process-sa-lower-leagues.py` | One-off logo processing script | `.recycle/process-sa-lower-leagues.py` |
| `scripts/insert-sa-lower-leagues.sql` | One-off DB insert script | `.recycle/insert-sa-lower-leagues.sql` |
