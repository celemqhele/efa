# Logo Upscale Rollback — restore universal small size buckets

**Date:** 2026-08-27
**Category:** logo-upscaling
**Status:** Complete (deployed to production)

## Symptom (user report)
- `/premiership` (and effectively every page rendering logos) took a **long time to load**.
- Logos looked **cut / misaligned / shuffled**, not aligned with their placeholders.
- Confirmed started right after the AI-upscale deploy.

## Root cause
Commit `a1f9ee7` (AI-upscale active leagues) changed `lib/logo-resolver.ts` `SIZE_MAP` and 13 hardcoded logo URLs from the small buckets to the upscaled buckets:

- `standings_row/group_table` → `640x640`
- `fixture_card/profile_avatar` → `1280x1280`
- `news_thumb` → `2560x2560`

Only **6 leagues** were actually upscaled (English Premier League, La Liga, Serie A, FIFA World Cup 2026, PSL/South African Premiership, Argentina). The other **~20 leagues** — including the newly-added **Motsepe Foundation Championship** and **ABC Motsepe League** — have **no** `640x640` / `1280x1280` / `2560x2560` folders.

Consequences:
- Non-upscaled leagues: every logo image **404'd** → `components/ui/TeamLogo.tsx` `onError` sets the tile's parent `display:none` → grid slots disappear → "cut/misaligned/shuffled" look.
- Upscaled leagues: served giant `2560x2560` PNGs through `_next/image` on-demand → slow loads + heavy Vercel image optimization.

## Fix (commits `8c322f4`, `b4dbc36`)
Reverted the running code to the **small buckets that exist in every league**, which are more than enough for all display contexts (`TeamLogo`'s `SIZE_PX` max is 256px for `news_thumb`):

- `standings_row/group_table` → `64x64`
- `fixture_card/profile_avatar` → `128x128`
- `news_thumb` → `256x256`
- `match_detail_hero` → `512x512` (unchanged; all leagues have it)
- `broadcast_download` → `700x700` (unchanged; all leagues have it)

13 hardcoded `/.../1280x1280/...` references reverted to `/128x128/`:
- `app/(admin)/admin/dashboard/DueFixturesExportButton.tsx` (2)
- `app/(admin)/admin/export/page.tsx`, `_desktop.tsx`, `_mobile.tsx`
- `app/(admin)/admin/hall-of-fame/HallOfFameAdmin.tsx`
- `app/(admin)/admin/managers/ManagersClient.tsx`
- `app/(admin)/admin/polls/page.tsx`
- `app/(public)/managers/[id]/_desktop.tsx`, `_mobile.tsx`
- `app/(public)/polls/[share_code]/PollClient.tsx`, `_desktop.tsx`, `_mobile.tsx`

## Verification (production `efa-fxyk.vercel.app/premiership`)
- Page loads in ~2.7s (was 60s+ timeout).
- Logo URLs now use `256x256` (previously `2560x2560`).
- Motsepe + ABC league logo URLs return **HTTP 200** (previously 404 → hidden tiles).

## Infra note — alias 500
- Pushing to `main` auto-deployed the fix to production deployment `efa-7jkeeyyye` (serves 200 at its deployment URL).
- A **manual `vercel alias set`** to point the custom alias `efa-fxyk.vercel.app` at a specific deployment caused **persistent 500 `MIDDLEWARE_INVOCATION_FAILED`** on the alias (even the root).
- Fixed by running **`vercel --prod`** (clean production deploy), which properly re-bound **`https://efa-fxyk.vercel.app`** to the new deployment `efa-fxyk-81wf7aadv`. It now serves 200.
- **Lesson:** use `vercel --prod` (or push to `main`) to update the production alias; do NOT use `vercel alias set` to re-point `efa-fxyk.vercel.app` at an arbitrary deployment — it breaks the edge binding (500).
- This `MIDDLEWARE_INVOCATION_FAILED` 500 is the same `MIDDLEWARE_INVOCATION_*` failure family documented in `.opencode/context/deploy-performance/middleware-timeout_2026-08-28.md` (there reported as a timeout / 504).

## Current state of upscaled folders
- The upscaled `640x640` / `1280x1280` / `2560x2560` folders still exist for the 6 leagues but are **no longer referenced** by running code. They're dead weight (large) and can be cleaned up at your discretion.
- `match_detail_hero` → `512x512` and `broadcast_download` → `700x700` continue to serve full-res where relevant.

## Related files

- `.opencode/context/logo-upscaling/logo-upscaling_2026-08-27.md` — the AI-upscale ship (`a1f9ee7`) this file reverts (commits `8c322f4`, `b4dbc36`)
- `.opencode/context/logo-upscaling/logo-upscale-remove-2560-only_2026-08-28.md` — cleanup of the dead `2560x2560` buckets left behind
- `.opencode/context/logo-upscaling/argentina-upscale-buckets-recycled_2026-08-28.md` — cleanup of the dead Argentina upscale buckets left in the working tree
- `.opencode/context/deploy-performance/middleware-timeout_2026-08-28.md` — the `MIDDLEWARE_INVOCATION_*` failure family hit via the bad `vercel alias set` in the infra note above
