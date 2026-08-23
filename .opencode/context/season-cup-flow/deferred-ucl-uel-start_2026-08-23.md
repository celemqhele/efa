# Deferred UCL/UEL start — cups created after league finishes

Date: 2026-08-23

## What changed

Previously, `/api/admin/start-phase` created the season, league fixtures AND both cup
tournaments (`EFA Tournament (Clubs)` = tournament_club / UCL, `EFA Tournament
(International)` = tournament_international / UEL) in one go. Teams were picked manually in
wizard step 4 of the Start Phase dialog, defaulted from the previous completed season's top 12
(UCL) and 13–20 (UEL).

Now:

1. **Start Phase** creates ONLY the season + league tournament + round-robin league fixtures.
   The wizard is 4 steps ("UCL & Europa" step removed). No DB schema changes needed.
2. Once every league fixture of an active season is completed, each missing cup tile on the
   season card (`/admin/seasons`) shows a **Start** button (Champions League and Europa League
   separately, either order).
3. Pressing Start opens a dialog that lists the final league standings with positions; admin
   picks team count (defaults 12 for UCL, 8 for UEL), groups (default 2) and qualifiers per
   group (default 2). Teams are auto-selected top-N from standings, skipping teams already in
   the other cup.
4. The API validates server-side: season active, all league fixtures done (status set:
   confirmed / abandoned_home / abandoned_away / abandoned_both), no duplicate cup type per
   season, teams ⊆ league participants, no overlap with the other cup, team count divides
   evenly across groups (min 2/group).

## Key files

- `app/api/admin/start-phase/route.ts` — league-only launch (cups stripped out)
- `app/api/admin/start-tournament/route.ts` — NEW. Creates one cup from final standings:
  - Standings sorted like the public page via `sortStandingsRows` (points → GD incl.
    gd_penalty → GF → name); league position becomes the draw rank so top finishers seed pot 1
    across groups (`drawGroups` in `lib/tournament-draw.ts`)
  - Replicates the old creation flow: participants, seeded draw, `group_name`/`seed_pot`,
    zeroed `group_standings`, group fixtures via `generateGroupFixtures`
  - Fixtures scheduled from max(today, day after last league fixture)
  - Notifies participating managers (`fixtures_released`), audit log action `start_tournament`
- `app/(admin)/admin/seasons/page.tsx` — loads `final_standings` + `cup_taken` map per active
  season into the Shell data (replaces removed `prevSeasonStandings`)
- `app/(admin)/admin/seasons/SeasonManager.tsx` — 4-step wizard; fixed cup tile slots
  (tournament_club / tournament_international) with Start buttons when `cupsStartable`;
  new `StartCupDialog`; also removed pre-existing dead state (scLoading/uclTeams/europaTeams/
  selectedUcl/selectedEuropa)

## Deliberately unchanged

- `end-season/route.ts`: still gated on league fixtures only; still completes the season,
  clears ALL manager tenures and sends qualification notifications. Admin chose to keep this
  as-is — pressing End Phase right after the league ends will clear managers before cups run;
  that's accepted.
- Legacy routes untouched: `start-season`, `create-tournament`, `generate-fixtures`,
  `tournament-draw`, knockout generation, Super Cup flow.
- Current/older seasons unaffected: their cup tournament rows already exist, so tiles render
  exactly as before (Start buttons only appear when a cup row does not exist yet).

## Follow-up notes

- Knockout generation (`knockout_ready` = all group fixtures done + no sf fixtures) works
  unchanged because it only depends on the cup tournament existing.
- Super Cup generation requires both cups to exist (`clubTs.length >= 2` gate).
