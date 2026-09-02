# Remove 2560x2560 logo buckets only (dead weight cleanup)

**Date:** 2026-08-28
**Category:** logo-upscaling (follow-up to `logo-upscale-rollback-small-buckets_2026-08-27.md`)

## What happened

After the AI-upscale experiment (`a1f9ee7`) and the SIZE_MAP rollback
(`8c322f4`), the upscaled `640x640` / `1280x1280` / `2560x2560` folders for the 5
upscaled leagues were no longer referenced by running code but were still
committed and deployed — dead weight (~466 MB total).

The user decided to remove **only the `2560x2560` buckets** (the largest tier,
~310 MB) and keep `640x640` + `1280x1280` on disk for potential future use.

## Action taken

Moved 124 tracked PNGs (`git mv`, preserves history) from the `2560x2560`
folder of each of the 5 upscaled leagues into `.recycle/`:

| League | Files | Size |
|---|---|---|
| fifa-world-cup-2026.football-logos.cc | 48 | 117.7 MB |
| english-premier-league-2025-2026.football-logos.cc | 20 | 53.1 MB |
| spain-la-liga-2025-2026.football-logos.cc | 20 | 52.5 MB |
| italy-serie-a-2025-2026.football-logos.cc | 20 | 45.0 MB |
| south-african-premiership-2026-2027.football-logos.cc | 16 | 41.2 MB |

Also regenerated the service worker precache manifest via `npm run build` —
`public/sw.js` dropped all 134 `2560x2560` precache entries (now 0).

## Notes

- Code references to `2560` remain 0 across `app/`, `lib/`, `components/`.
- The other buckets (`64x64`/`128x128`/`256x256`/`512x512`/`700x700`) are
  unchanged and still the only official logo contexts.
- **Pre-existing quirk (not fixed, out of scope):** serwist config excludes
  `/\/logos\//` from the SW precache manifest, but this repo builds on Windows,
  so generated URLs use backslashes (`/logos\...\...`) and the exclude never
  matches — every small-bucket logo still gets precached (463 KB manifest).
  On Vercel (Linux, forward slashes) the exclude works, so the production
  `sw.js` is regenerated lean. Fixing the Windows quirk is a separate task.
- `640x640` + `1280x1280` buckets intentionally kept for all 5 leagues.

## Related files

- `.opencode/context/logo-upscaling/logo-upscale-rollback-small-buckets_2026-08-27.md` — the SIZE_MAP rollback that declared the upscaled buckets dead weight; this cleanup follows it
- `.opencode/context/logo-upscaling/logo-upscaling_2026-08-27.md` — the AI-upscale ship (`a1f9ee7`) that created the `2560x2560` buckets being removed

## Restore File Section

| Original Path | Purpose | New Path inside `.recycle` |
|---|---|---|
| `public/logos/fifa-world-cup-2026.football-logos.cc/2560x2560/` (48 PNGs) | AI-upscaled 2560px logos, no longer referenced after SIZE_MAP rollback | `.recycle/logo-2560x2560-buckets-2026-08-28/fifa-world-cup-2026.football-logos.cc/` |
| `public/logos/english-premier-league-2025-2026.football-logos.cc/2560x2560/` (20 PNGs) | same | `.recycle/logo-2560x2560-buckets-2026-08-28/english-premier-league-2025-2026.football-logos.cc/` |
| `public/logos/spain-la-liga-2025-2026.football-logos.cc/2560x2560/` (20 PNGs) | same | `.recycle/logo-2560x2560-buckets-2026-08-28/spain-la-liga-2025-2026.football-logos.cc/` |
| `public/logos/italy-serie-a-2025-2026.football-logos.cc/2560x2560/` (20 PNGs) | same | `.recycle/logo-2560x2560-buckets-2026-08-28/italy-serie-a-2025-2026.football-logos.cc/` |
| `public/logos/south-african-premiership-2026-2027.football-logos.cc/2560x2560/` (16 PNGs) | same | `.recycle/logo-2560x2560-buckets-2026-08-28/south-african-premiership-2026-2027.football-logos.cc/` |