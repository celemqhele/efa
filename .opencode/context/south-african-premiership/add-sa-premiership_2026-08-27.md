# South African Premiership — Betway Premiership

## What was done
Added the South African Premiership (Betway Premiership) as a new selectable league in the EFA platform.

## Logo Processing
- Source: `C:\Users\mqhel\Downloads\South African Premiership` (16 files)
- Formats in source: webp (2), svg (3), png (9), jpeg (1), jpg (1)
- All converted to PNG, backgrounds removed, resized to 5 standard sizes (64x64, 128x128, 256x256, 512x512, 700x700)
- Converted to palette mode (P) with transparency to match existing league logos
- Normalized fill ratios to ~65% (matching AmaZulu/Golden Arrows benchmark) so all logos appear consistent size
- Output: `public/logos/south-african-premiership-2026-2027.football-logos.cc/`
- Processing script: `.recycle/process-sa-logos.py` (one-off, moved to recycle)

## Team slug mapping
| File | Slug | Display Name |
|---|---|---|
| AmaZulu_logo.svg.webp | amazulu | AmaZulu |
| Chippa_United_FC_logo.png | chippa-united | Chippa United |
| Durban_City_FC.png | durban-city | Durban City |
| Kaizer_Chiefs_logo.svg | kaizer-chiefs | Kaizer Chiefs |
| kruger united.jpeg | kruger-united | Kruger United |
| Lamontville_Golden_Arrows_logo.svg | lamontville-golden-arrows | Lamontville Golden Arrows |
| Mamelodi_Sundowns_F.C.svg | mamelodi-sundowns | Mamelodi Sundowns |
| Marumo_Gallants_FC.jpg | marumo-gallants | Marumo Gallants |
| Milford-FC-Logo.png | milford | Milford |
| orlandi pirates.png | orlando-pirates | Orlando Pirates (typo fixed) |
| Polokwane_City_FC_logo.png | polokwane-city | Polokwane City |
| Richards_Bay_F.C._logo.png | richards-bay | Richards Bay |
| Sekhukhune_United_F.C._logo.png | sekhukhune-united | Sekhukhune United |
| Siwelele_F.C._logo.svg.webp | siwelele | Siwelele |
| Stellenbosch_FC_logo.png | stellenbosch | Stellenbosch |
| TS_Galaxy.png | ts-galaxy | TS Galaxy |

## Files modified
- `lib/efootball-2027-teams.json` — added SA Premiership league block
- `lib/logo-resolver.ts` — added folder to `getLeagueFolders()` + display name "Betway Premiership"
- `app/(public)/premiership/page.tsx` — announcement page (server component)
- `app/(public)/premiership/_shell.tsx` — viewport switch wrapper
- `app/(public)/premiership/_desktop.tsx` — desktop layout (4-column grid)
- `app/(public)/premiership/_mobile.tsx` — mobile layout (3-column grid)
- `public/logos/south-african-premiership-2026-2027.football-logos.cc/` — 80 PNG files (16 teams × 5 sizes)

## Database
- 16 teams inserted into `teams` table with `logo_league_folder = 'south-african-premiership-2026-2027.football-logos.cc'`
- SQL insert script: `.recycle/insert-sa-premiership-teams.sql` (one-off, moved to recycle)

## Announcement page
- Route: `/premiership`
- Shows "Betway Premiership — Now Available for Selection"
- Displays all 16 teams with logos in a responsive grid
- Uses `news_thumb` (256x256) context for crisp logo rendering

## Key config values
- League folder: `south-african-premiership-2026-2027.football-logos.cc`
- Display name: `Betway Premiership`
- Allowed teams key in `efootball-2027-teams.json`

## Restore File Section
| Original Path | Purpose | New Path |
|---|---|---|
| `scripts/process-sa-logos.py` | One-off logo processing script | `.recycle/process-sa-logos.py` |
| `scripts/insert-sa-premiership-teams.sql` | One-off DB insert script | `.recycle/insert-sa-premiership-teams.sql` |
