# Poll Voters — All Profiles Get Motsepe + ABC Motsepe Access — 2026-09-26

Opened the "2026 SA Club Selection" poll (`share_code` `f79b9129`) to every existing profile: the original 32 Internationional Cup managers keep their placement folders, and all other profiles were added to `voter_restrictions` with Motsepe Foundation Championship + ABC Motsepe League folders only.

## Problem
- The poll's `voter_restrictions` map only listed the 32 EFA International Cup managers (`e2c61a3e-072e-4a07-8024-76de20c2a99a`), split 16 Premiership-only / 16 Motsepe+ABC (per `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`).
- The user asked to let the rest of the league's managers vote too — but only for the Motsepe division and the third division (ABC Motsepe League) teams, never the Premiership.

## Fix / Actions
- Confirmed via the question tool: add **all other profiles** (85 total profiles, 53 unmapped, 32 already mapped).
- New migration `supabase/migrations/add_poll_voters_motsepe_all.sql`: rebuilds `polls.voter_restrictions` for share_code `f79b9129` as a full `jsonb_object_agg` over every `profiles` row, preserving each existing entry's folders and defaulting new profiles to `["motsepe-foundation-championship-2026-2027.football-logos.cc","abc-motsepe-league-2026-2027.football-logos.cc"]`. Runner note: the first attempt with a `UNION ALL` inside `jsonb_object_agg` failed ("each UNION query must have the same number of columns"); switched to `LEFT JOIN LATERAL jsonb_each(...)`, which worked.
- Enforcement is unchanged — the public share page + `apply` route already honor `voter_restrictions` (allowlist + per-folder filtering), so new voters only see Motsepe/ABC teams.

## Verification
- Ran migration via `npm run db` → `UPDATE (1 rows)`.
- Re-query of `jsonb_each(voter_restrictions)`: total voters **85**, premiership-only **16**, motsepe_or_abc **69** (16 original bottom-split + 53 new).

## Context chain (by path)
- Voter restrictions feature + poll creation: `.opencode/context/poll-tournament-integration/poll-voter-restrictions-and-season-import-split_2026-09-22.md`
- Poll–season integration: `.opencode/context/poll-tournament-integration/poll-tournament-integration_2026-09-02.md`
- Placement ranking the folders encode: `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md`