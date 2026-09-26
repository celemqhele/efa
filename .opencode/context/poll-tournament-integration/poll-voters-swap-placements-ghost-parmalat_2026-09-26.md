# Poll Voters — Swap Placements: ghost Out, parmalat_ Into Top-16 — 2026-09-26

Swapped the "2026 SA Club Selection" poll placement for two managers: `ghost` (Egypt) was dropped from the Premiership-only (top-16) group into the Motsepe+ABC group, and `parmalat_` (England) was promoted from Motsepe+ABC into the Premiership-only top-16. Mirrored the swap in the hardcoded announcement generator so the placement PDF stays consistent.

## Problem
- Follow-up to `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`, which opened the poll to all 85 profiles (16 Premiership-only / 69 Motsepe+ABC) based on the 32-manager EFA International Cup ranking.
- The user reported: remove `ghost` from the top-16 list and promote the best remaining bottom-16 manager (highest points, then GD) into the 16th slot. `ghost` = Egypt (`4a825dbb-5393-4b04-8531-eada461c3b92`, 10 pts, GD +9) was Premiership-only; `parmalat_` = England (`30269b88-9c4d-4779-8f24-1212adc585ef`, 9 pts, GD -11) was the #17 manager (highest of the bottom 16).

## Fix / Actions
1. Poll permission swap (the two managers' league folder allowlists) via `supabase/migrations/swap_ghost_parmalat_poll_voters.sql`: swaps the two `voter_restrictions->'<uuid>'` arrays on the SA poll (`share_code` `f79b9129`) so `ghost` gets the Motsepe+ABC folders and `parmalat_` gets the Premiership folder. Applied via `npm run db` → 1 row updated. Enforcement/serving is elsewhere (`.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`).
2. Placement script mirror (`scripts/guide/placement-announcement.tsx`): the 32-row `MANAGERS` array used by the announcement PDF generator (`npm run generate-announcement-pdf` → `public/EFA-Announcement-LeaguePlacement.pdf`) no longer has `ghost` in the top-16 block; `parmalat_` now sits at index 15 (16th, last Premiership slot) and `ghost` moved to index 16 (first Motsepe slot). So`MANAGERS.slice(0,16)` = PSL, `slice(16)` = Motsepe.
3. Regenerated the announcement PDF: `npm run generate-announcement-pdf` → `public/EFA-Announcement-LeaguePlacement.pdf` now reflects the new split.

## Verification
- Re-query of poll `voter_restrictions`: `ghost` → `motsepe+abc`, `parmalat_` → `premiership`; total voters still 85 (16 Premiership-only / 69 Motsepe+ABC).
- `placement-announcement.tsx` array: 32 entries, no duplicate manager names; PSL(0-15) ends `..., calvin, parmalat_`, MOTSEPE(16-31) starts `ghost, blessing_100sk, ...`.

## Context chain (by path)
- Prior poll-wide voter expansion: `.opencode/context/poll-tournament-integration/poll-voters-all-members-motsepe-abc_2026-09-26.md`
- Voter restrictions feature + poll creation: `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`
- Placement ranking the folders encode: `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md` and `.opencode/context/two-divisions/psl-motsepe-placement-pdf-announcement_2026-09-21.md`