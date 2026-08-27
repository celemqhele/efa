# Vercel Function Size Limit (2) — api/polls/[share_code]/apply via lib/registry

## What happened
After fixing `admin/seasons` (see `vercel-function-size-admin-seasons_2026-08-27.md`), the next deploy failed on a different function:
> The Vercel Function "api/polls/[share_code]/apply" is 511.11mb uncompressed which exceeds the maximum uncompressed size limit of 250mb.

## Root cause
`api/polls/[share_code]/apply/route.ts` imports `LEAGUE_META` from `lib/registry.ts` for a one-line check (`meta?.isNational`). But `lib/registry.ts` ALSO contains `buildRegistry()`, which did:
```ts
const logosDir = path.join(process.cwd(), 'public', 'logos')
const files = await fs.readdir(folderPath)
```
Because Next.js traces at the module/folder level, **any function importing anything from `lib/registry.ts` got the entire 538MB `public/logos` directory traced into its bundle** — even though `apply` only used the pure `LEAGUE_META` object. This is the same class of bug as the `admin/seasons` one, but triggered via a shared lib import instead of an inline `fs.readdirSync`.

The polls page `app/(public)/polls/[share_code]/page.tsx` ALSO calls `buildRegistry()` directly, so it had the same bloat risk (would have been the next failure after `apply`).

## Fix
Made `buildRegistry()` disk-free so `lib/registry.ts` no longer imports `fs`/`path`, which removes the `public/logos` trace for **every** importer of the module (both the `apply` route and the polls page).

- Generated `lib/registry-data.json` (13.7 KB) — a baked `{ folder_teams: { "<league-folder>": ["<slug>", ...], ... } }` map for all 25 logo folders / 557 team slugs, produced from a one-off scan of `public/logos/*/128x128`.
- `lib/registry.ts`:
  - Removed `import { promises as fs } from 'fs'` and `import path from 'path'`
  - Added `import registryData from './registry-data.json'`
  - `buildRegistry()` now reads slug lists from the JSON and maps them to display names via the existing `slugToName()` (unchanged name logic), instead of `fs.readdir`.

## Behavior preserved
`buildRegistry()` returns the same full per-league TeamEntry[] lists as before (same slugs, same names via `slugToName`). `LEAGUE_META` unchanged.

## Maintenance note
`lib/registry-data.json` is a generated artifact. When new league logos are added (new folder or new teams), it MUST be regenerated:
```bash
# scan public/logos/*/128x128 and write { folder_teams: { folder: [slugs] } } to lib/registry-data.json
```

## Verification
- `npx tsc --noEmit` — clean
- `npx next lint` on changed files — no warnings/errors
- `buildRegistry` counts spot-checked: WC 48, EPL 20, SA Premiership 16, Motsepe Championship 16 — all correct
- Only remaining disk scan in server code is `app/api/search/route.ts`, which scans only the small fixed `fifa-world-cup-2026.../128x128` subfolder (~few MB) — not a limit risk, left as-is.

## Restore File Section
| Original Path | Purpose | New Path |
|---|---|---|
| (none — no files deleted; `lib/registry-data.json` is newly created and committed) | | |
