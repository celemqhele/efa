# Argentina upscale buckets moved to .recycle

**Date:** 2026-08-28
**Category:** logo-upscaling (follow-up to `logo-upscale-rollback-small-buckets_2026-08-27.md`)

## What happened

The working tree showed three **untracked** size folders under
`public/logos/argentina-primera-division-2025-2026.football-logos.cc/`:
`640x640/`, `1280x1280/`, `2560x2560/` (30 files: 10 teams x 3 buckets).

These were leftover from the AI-upscale experiment (`a1f9ee7`) — per
`logo-upscaling_2026-08-27.md`, "Argentina logos were processed during testing
but not included in the active commit." After the SIZE_MAP rollback
(`8c322f4`), the running code only uses the small buckets
(`64x64/128x128/256x256/512x512/700x700`); the 640/1280/2560 buckets for
Argentina were never referenced by any code and were untracked in git.

## Action taken

Moved the three untracked upscale buckets to the recycle directory (file
deletion policy — nothing permanently deleted):

- From: `public/logos/argentina-primera-division-2025-2026.football-logos.cc/{640x640,1280x1280,2560x2560}/`
- To: `.recycle/argentina-primera-division-2025-2026.football-logos.cc-upscale-buckets-2026-08-28/`

No restore-file section added to a context file because the files were never
committed to the repo (they existed only in the working tree).

## Result

- `git status` on the Argentina logo folder is now clean (only committed 150
  files remain: the small buckets).
- The committed small buckets (still in use by running code) are untouched.
- No code references the moved 640/1280/2560 buckets (repo-wide grep for
  `1280`/`2560`/`640x640` returned zero matches).

## Note

The 5 leagues that still have committed upscaled buckets (EPL, FIFA World Cup,
Serie A, SA Premiership, La Liga) also retain their unused `640x640` /
`1280x1280` / `2560x2560` folders on disk. They remain dead weight and can be
cleaned up at a later date if desired.

## Related files

- `.opencode/context/logo-upscaling/logo-upscale-rollback-small-buckets_2026-08-27.md` — the SIZE_MAP rollback (`8c322f4`) this cleanup follows; it declared the upscale buckets dead weight
- `.opencode/context/logo-upscaling/logo-upscaling_2026-08-27.md` — the AI-upscale ship (`a1f9ee7`) whose test run created the Argentina buckets
