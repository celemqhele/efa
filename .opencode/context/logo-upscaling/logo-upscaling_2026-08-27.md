# Logo Upscaling — AI upscale team logos for active leagues

**Date:** 2026-08-27  
**Status:** Complete

## What was done

### Goal
Upscale all football team logos and EFA brand logos using Real-ESRGAN AI upscaler, replacing old size folders (64x64, 128x128, 256x256) with new larger ones (640x640, 1280x1280, 2560x2560). Browser downscales at render time for sharper display.

### Key decisions
- Output sizes: **640/1280/2560** (not original 64/128/256) — larger stored files, browser downscales via CSS/Next.js Image
- Real-ESRGAN loses transparency (outputs RGB), so alpha channel is manually copied from original via raw pixel buffer approach
- Only **active leagues** upscaled: EPL, La Liga, Serie A, FIFA World Cup 2026, PSL (South African Premiership)
- EFA brand logo (`efa-logo-white.png`) upscaled from 980x980 → 1960x1960; icons (192, 512) left as-is
- Argentina logos were processed during testing but not included in the active commit (not in `efootball-2027-teams.json`)

### Files created/modified
- `scripts/upscale-logos.js` — batch upscaling script (Real-ESRGAN + sharp alpha fix + resize). Flags: `--test`, `--league`, `--efa-only`, `--skip-existing`
- `scripts/upscayl/realesrgan-ncnn-vulkan.exe` — AI upscaler binary (gitignored)
- `lib/logo-resolver.ts` — SIZE_MAP updated: `standings_row/group_table` → `640x640`, `fixture_card/profile_avatar` → `1280x1280`, `news_thumb` → `2560x2560`
- 12 component files with hardcoded `128x128` references updated to `1280x1280` (admin/dashboard, admin/export, admin/managers, admin/polls, admin/hall-of-fame, public/managers, public/polls)
- `.gitignore` — added `scripts/upscayl/`
- `public/efa-logo-white.png` — upscaled to 1960x1960 RGBA
- `public/logos/{league}/{640x640,1280x1280,2560x2560}/` — upscaled logos for EPL (20), La Liga (20), Serie A (20), FIFA World Cup (48), PSL (16)

### Results
- 154 team logos upscaled, 0 failures
- GPU: Intel UHD Graphics, ~50s per image for Real-ESRGAN 2x upscale
- TypeScript typecheck passes clean

## To upscale more leagues later
```bash
node scripts/upscale-logos.js --league "argentina-primera-division-2025-2026.football-logos.cc"
```
Then update `lib/efootball-2027-teams.json` to include the league, and the logo resolver will pick up the new sizes automatically.

## Old size folders
The old `64x64/`, `128x128/`, `256x256/` folders still exist on disk for all leagues (including un-upscaled ones). Code no longer references them. They can be deleted at your discretion.

## REGRESSION — Rollback of SIZE_MAP (follow-up, same day)
**Bug:** After `a1f9ee7` shipped, `/premiership` (and every stats/fixture/avatar/poll/export page) showed logos **cut / misaligned / shuffled / slow to load**.

**Root cause:** `a1f9ee7` flipped `lib/logo-resolver.ts` `SIZE_MAP` and 13 hardcoded refs from the small buckets (`64x64`/`128x128`/`256x256`) to the **upscaled** buckets (`640x640`/`1280x1280`/`2560x2560`). But only **6 leagues** were actually upscaled (EPL, La Liga, Serie A, FIFA World Cup, PSL/SA Premiership, Argentina). The other **~20 leagues** (including the new Motsepe Foundation Championship and ABC Motsepe League) have **no** `640x640`/`1280x1280`/`2560x2560` folders → every logo image 404'd → `TeamLogo`'s `onError` hid the tile → "cut/misaligned/shuffled". The upscaled leagues were slow because `_next/image` served giant 2560px PNGs on-demand.

**Fix (commit <FILL>):** Reverted `SIZE_MAP` so every context uses a small bucket that exists in ALL leagues: `standings_row/group_table` → `64x64`, `fixture_card/profile_avatar` → `128x128`, `news_thumb` → `256x256` (`match_detail_hero`→`512x512`, `broadcast_download`→`700x700` unchanged). Reverted the 13 hardcoded `/1280x1280/` refs (admin dashboard/export/managers/polls/hall-of-fame, public managers/polls) back to `/128x128/`.

**Lesson:** Do NOT point logo contexts at folder sizes unless you upscale **every** league. Either upscale all leagues or keep the universal small buckets. The AI-upscaled `640x640`/`1280x1280`/`2560x2560` folders still exist for the 6 leagues but are now unused by running code; they can be cleaned up at your discretion.
