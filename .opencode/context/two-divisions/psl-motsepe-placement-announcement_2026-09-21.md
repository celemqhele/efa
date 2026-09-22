# PSL / Motsepe Division Placement Announcement — Based on EFA International Cup Group Stage

Created the official announcement document `public/EFA-PSL-Motsepe-Placement-Announcement.md` assigning all 32 managers to the two divisions based on their combined performance across the EFA International Cup group stage — top 16 → PSL (First Division), bottom 16 → Motsepe Foundation Championship (Second Division). This is the placement step that feeds the two-division season model from `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md`.

## Problem
- The user wanted an official announcement deciding who lands in which division for the upcoming season, instead of teams. Managers picked international sides for the EFA International Cup; the next season uses South African club teams, and the managers are not managers of those SA clubs yet, so team names are deliberately omitted — managers will be allowed to pick their own clubs.
- Ranking basis: combined 32-team league table built across all 8 groups (each team played 6 group games). Sort order mirrors the app's standalone logic in `lib/standings-core.ts` `sortStandingsRows` (points → GD incl. forfeit `gd_penalty` → goals for).

## Fix / Actions
- Queried Supabase (`npm run db`) for: `group_standings` (all 8 groups of tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a`), `teams`, and active `manager_tenures` (`ended_at IS NULL`) to map each team to its current manager.
- Wrote `public/EFA-PSL-Motsepe-Placement-Announcement.md` (same folder as the onboarding PDFs):
  - **Page 1** — full 32-row performance table (manager, P/W/D/L/GF/GA/GD/Pts), manager names only.
  - **Page 2** — the split: PSL top 16, Motsepe bottom 16 (rank 17–32), manager names only with a stated basis ("based on performance in the EFA International Cup group stage").
- Top: minenhle22 & uvesh (18 pts, 6/6 wins). Bottom: loneprsly & maninblack (0 pts).
- No code/DB changes — pure content document. Managers pick SA clubs later; no team mapping applied here.

## Notes / Caveats
- Group strength differs between pools; the flat 32-team board is the requested convention. Forfeit `gd_penalty` (−3 per no-show) affects some entries (e.g. Norway, Egypt, Sweden, Cote D Ivoire, Uzbekistan, Colombia), and some managers took over their international side mid-cup (e.g. `maninblack` started 2026-09-14, `jigsaw_rsa` 2026-09-05) yet the full group-stage record is attributed to the current manager per the request.
- If a manager is later assigned a club, that mapping is out of scope for this file.