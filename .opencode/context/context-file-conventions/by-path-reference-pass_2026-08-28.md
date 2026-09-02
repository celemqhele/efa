# Context File Conventions — Full by-Path Cross-Reference Pass (efa + FMSG)

Retroactively applied the by-path cross-reference convention to **all existing context files** in both the `efa` and `FMSG` projects — every context file that relates to another now references it by its full `.opencode/context/...` path, so the context chain stays discoverable even though Glob/Grep silently skip `.opencode/`.

## What was done
- Introduced by `.opencode/context/context-file-conventions/references-and-intro_2026-08-28.md` (which added the opening-intro + cross-references-by-path rules to both AGENTS.md files), this pass went back over every existing context file and added the actual by-path references.
- **efa (~66 files):** added `## Related files` sections (or folded inline refs where that matched existing style) across all chains and cross-links:
  - `backdoor/` (10) — one-off scripts inter-link (mci-loss, psg-chelsea, betis-win, side-inversion, both-absent); the 4 files touching `app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx` cross-reference; betis-win ⇄ side-inversion (data-fix vs root-cause fix).
  - `knockout-generation/` (9) — full sequential chain 08-23 → 08-26, each file links predecessor/successor and the shared `advanceWinner`/`mirrorLeg2Teams` work.
  - `check-fixtures/` (4), `onboarding/` (4), `forfeit-balances/` (3), `admin-dashboard/` (4), `admin-results/` (2), `fixture-scheduling/` (2), `notification-sounds/` (2), `efootball-teams/` (3), `tbc-badge/` (2), `uel-no-name/` (1), `logo-upscaling/` (4), `deploy-performance/` (2), `login-redirect/` (3), `south-african-premiership/` (4), plus `migration-history/`, `season-cup-flow/`, `postgrest-embeds/`, `international-phone/`, `whatsapp-results/`, `home-upcoming-widget/`, `manager-stats/`.
- **FMSG (12 files):** ats-scoring/ (4), search-pipeline/ (4), job-boards/ (3) all got chain references; `supabase-access/supabase-direct-access_2026-08-09.md` got a "Referenced by" section listing its consumers. `branding/gbp-images_2026-08-18.md` was left untouched (truly standalone).

## Cross-category links added
- `notification-sounds/notifications-sounds` ⇄ `backdoor/backdoor-side-inversion` (`lib/backdoor-notify.ts` `side_claimed` semantics).
- `home-upcoming-widget` ⇄ `whatsapp-results/already-submitted-handling` (siblings split from one original `.recycle` file).
- `fixture-scheduling/` → `admin-results/submit-page-truncation-fix` (rescheduling caused the 1,000-row truncation).
- `tbc-badge` ⇄ `uel-no-name` (shared `TeamLogo.tsx` / `getPlaceholderIcon`, ShieldQuestion vs TBC Club badge).
- `logo-upscaling` ⇄ `deploy-performance/middleware-timeout` (MIDDLEWARE_INVOCATION_FAILED alias lesson).
- `south-african-premiership/vercel-function-size-polls-apply` → `efootball-teams` + `logo-upscaling` (registry/logo data sizes).
- `onboarding/manager-data-transfer` (062) ⇄ `forfeit-balances/forfeit-manager-migration` (061) — parallel team→manager migration, same date.
- `deploy-performance/middleware-zero-network-fix` ⇄ `login-redirect/public-layout-auth-session-loss` (shared PageWrapper/`getUser()` in layouts).
- FMSG: ats-scoring ⇄ search-pipeline (deterministic ATS enabled checkpoint removal; spec-dedup ⇄ PF title-ladder); supabase-access as shared infrastructure method.

## Files changed
- `efa/.opencode/context/**` — ~66 context files (references only, no structural changes).
- `FMSG/.opencode/context/**` — 12 context files (references only).

## Verification
- Wrote a PowerShell check extracting every `.opencode/context/...\.md` reference and confirming the target file exists. **efa:** 61 unique refs resolve (the one exception, `upcoming-and-whatsapp-already-submitted.md`, is a pre-existing Restore-section pointer to a recycled original — intentional). **FMSG:** 9 unique refs all resolve.
- No context-file prose was restructured; `## Restore File Section` tables untouched; each file's own voice preserved (`## Related files` section vs inline fold chosen per file).
