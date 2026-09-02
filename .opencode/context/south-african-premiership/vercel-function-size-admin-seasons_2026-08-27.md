# South African Leagues — Vercel Function Size Limit (admin/seasons 511MB)

## What happened
After adding the Motsepe Foundation Championship + ABC Motsepe League logos, the Vercel deploy failed on the `admin/seasons` function:
> The Vercel Function "admin/seasons" is 511.04mb uncompressed which exceeds the maximum uncompressed size limit of 250mb.

## Root cause
`public/logos/` had grown to **538 MB** after adding the two SA lower leagues (another 180 PNG files). 

`app/(admin)/admin/seasons/page.tsx` (a server component → serverless function) used `path.join(process.cwd(), 'public', 'logos')` + `fs.readdirSync()` to enumerate teams from the logo directories. Vercel's file tracer detects this filesystem read at build time and **bundles the entire `public/logos` directory into that server function**, so the function ballooned to 511 MB (>250 MB limit).

## Fix
Removed the filesystem scan entirely from both affected server functions. Team lists are now built from:
1. The season config (`lib/efootball-2027-teams.json` — the source of truth enumerating every allowed team/slug per league folder)
2. The `teams` DB table (for existing `id` and `manager_id`)

This yields the same full team set for team pickers without touching the disk, so nothing gets traced into the bundle.

`app/(admin)/admin/seasons/page.tsx`:
- Dropped `fs`, `path`, `getLeagueFolders()` imports
- `dbBySlug` → `dbByKey` (keyed `folder::slug` to avoid cross-league slug collisions on the picker)
- Build `clubMap` from `eFootballTeams.leagues` + DB enrichment; config-only teams get `id: ''` + a `slugToDisplayName()` name
- Kept a final loop adding DB teams not covered by config (legacy/`custom` league teams previously surfaced from the teams table)

`app/(admin)/admin/tournaments/create/page.tsx`:
- Same latent bug pattern (identical `fs.readdirSync` on `public/logos`) — fixed pre-emptively before it hit the same 250 MB limit.

## Other disk scans reviewed (NOT changed)
- `app/api/search/route.ts` — scans only the small fixed `fifa-world-cup-2026.../128x128` subfolder (~few MB), not a bloat risk. Left as-is.
- `app/(admin)/admin/teams/manage/AddTeamForm.tsx` — uses `getLeagueFolders()` (config only), client component. Fine.
- `scripts/*.js/ts` — one-off dev scripts, not bundled.

## Verification
- `npx tsc --noEmit` — clean
- `npx next lint` on both changed files — no warnings/errors
- Redeploy triggered by push to `main`; `public/logos` no longer traced into these functions

## Restore File Section
| Original Path | Purpose | New Path |
|---|---|---|
| (none — no files deleted; only in-place edits to two page files) | | |

## Related files

- `.opencode/context/south-african-premiership/add-sa-lower-leagues_2026-08-27.md` — the league/logo addition that caused the 511 MB `admin/seasons` function
- `.opencode/context/south-african-premiership/vercel-function-size-polls-apply_2026-08-27.md` — follow-up: same 250 MB limit class, hit via `lib/registry.ts` import tracing
