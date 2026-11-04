# Knockout postpone grey-out + CAF Super Cup / QF date fix + fixture recommendations 2026-11-04

Date: 2026-11-04
Chain: `knockout-generation/` follow-up; also relates to `submit-portal/` and `fixture-scheduling/`.

## What was done (4 changes)

### 1. Knockout games grey out the postpone action
`lib/submit-match.ts`: added `isKnockoutFixture()` (reads `KO_ROUNDS` + `'super_cup'`) and blocked postpone in `postponeBlock` with the message: "Knockout games cannot be postponed. Play the match or report the opponent." `app/api/submit-match/route.ts`: same guard in `requestPostpone`. `FixtureActions.tsx`: `Postpone` / `Batch Postpone` buttons disabled (`cursor-not-allowed opacity-40`) when `roundType` is a knockout round; desktop/mobile fixtures pages pass `roundType={fx.round_type}`.

### 2. CAF Super Cup rescheduled off Nov 3
`supabase`: updated fixture `8250ccff` (`tournament_id 41548820`) — moved `scheduled_date` from 2026-11-03 to 2026-11-10 (`deadline` updated to `2026-11-10T20:00:00Z`). The fixture was originally created by `scripts/create-season4.ts` on the `nedbankEnd` date; once `checkAndCreateSuperCup()` adopts the shell it will set the date from the later CAF final + 1 day, but the shell needed an immediate fix so it stops colliding with the QF fixtures.

### 3. Type-check clean; deploy gap noted
`npx tsc --noEmit` clean. The hourly `expire-postpone-requests` cron (`/api/cron/expire-postpone-requests`) still returns 404 in production (only reaches production with the deploy of the commit that introduces it); daily `auto-finalise-prev-day` runs (401, 39 audit rows, latest 2026-10-16 00:42).

### 4. Fixture recommendations for the unplayed Nov 3 knockout fixtures
The fixtures scheduled 2026-11-03 (yesterday, session date 2026-11-04) that have no confirmed result and no playing-manager action yet:

| Fixture | Round | Tournament | Status (Nov 3) | Recommendation |
|---|---|---|---|---|
| 101 (CCL) | QF leg 1 | CAF Champions | Midlands vs Highbury — `scheduled` | Play or submit real score; bracket feeds QF 111-114 |
| 102 (CCL) | QF leg 1 | CAF Champions | Stellenbosch vs Durban City — `scheduled` | Play / submit |
| 103 (CCL) | QF leg 1 | CAF Champions | Orlando vs Sekhukhune — `scheduled` |
| 104 (CCL) | QF leg 1 | CAF Champions | Lamontville Golden Arrows vs Sundowns — `scheduled` (date 11-04, so this is the only CCL QF not on 11-03; it needs the R32 401/402 winners) |
| 101 (Conf) | QF leg 1 | CAF Confed | Upington City vs Ben 10 — `scheduled` |
| 102 (Conf) | QF leg 1 | CAF Confed | Kaizer Chiefs vs Gomora — `scheduled` |
| 103 (Conf) | QF leg 1 | CAF Confed | Univ. Pretoria vs Leicesterford — `confirmed` (DB shows `confirmed`, but no real result — likely both-absent 0-0 or backdoor; needs resolution by admin or managers) |
| 104 (Conf) | QF leg 1 | CAF Confed | Venda FC vs Hope — `scheduled` |
| 101-104 (Nedbank) | QF leg 1 | Nedbank | Sundowns vs Midlands; Durban vs Sekhukhune; AmaZulu vs (null — wait, AmaZulu R16 was 55 confirmed 7-4 Kaizer Chiefs, so AmaZulu should be QF 103 home, but QF 103 shows AmaZulu vs null — missing away slot from 102 or 104?) | The bracket progression needs to be verified; the missing away slot at 103 suggests the R16 winner was not written to the QF. Check `advanceWinner` or admin backdoor approve for the missing R16-to-QF progression. |
| 201-202 (Nedbank SF) | SF leg 1 | Nedbank | Both still `scheduled` (null slots) — bracket has not been fed any QF winners yet. Once QF fixtures (101-104) are settled, `advanceWinner()` writes the SF slots. |
| Final 301 (Nedbank) | Final | Nedbank | Still `scheduled` (null). Same dependency — needs QF + SF resolution. |
| Super Cup (1) | super_cup | CAF Super Cup | Moved to 2026-11-10. Needs both CAF CCL + CAF Conf final trophies awarded before `checkAndCreateSuperCup()` can fill participants. The CCL final leg 1 is 2026-11-08, leg 2 2026-11-09; Conf final leg 1 2026-11-07, leg 2 2026-11-08. So the earliest the Super Cup can be settled is 2026-11-09 (Conf final leg 2) + 1 = 2026-11-10 — the new date aligns. |

Key point: the knockout fixtures on Nov 3 (QF, SF, Final, Super Cup) were all unplayed. They must be resolved (played/submitted/backdoor approved/admin finalised) before the bracket can progress. The `postponeBlock` gate ensures managers cannot postpone them; the `FixtureActions` buttons enforce it in the admin UI.

## Decisions / open questions

- For the three 0-0 Nedbank R16 fixtures (51, 52, 56 — both absent): apply the `resolveTournamentGdLeader()` tiebreak (tournament GD sums from `standings`, with `-3 gd_penalty` for both-absent rows). Recommended: Siwelele (better GD / standings vs Sundowns), Midlands Wanderers (better record vs Stellenbosch), Ben 10 (higher tournament position vs Univ. Pretoria). The two backdoor-approved fixtures (54 Highbury 0-3 Sekhukhune, 57 Hungry Lions 0-3 Gomora) already have clear winners.
- QF fixtures with missing slots (e.g. Nedbank QF 103 shows AmaZulu home but null away — missing R16 winner from 102 or 104) need the `advanceWinner()` call or a direct `update fixtures` to fill the slot, then the SF slots (201-202) will propagate once QF is complete.
- The CAF Super Cup fixture should stay on 2026-11-10 (updated); the `tournaments.settings` show `is_continental: true` on both CAF cups; `checkAndCreateSuperCup()` reads the trophy table for both tournaments and will adopt the existing shell when called.

## Verify / next steps
- Confirm the `FixtureActions` greyed-out buttons render correctly on `/admin/fixtures/manage` for knockout fixtures (check desktop/mobile tables).
- Once QF fixtures are settled, verify `advanceWinner()` writes SF fixtures 201-202; confirm `assignKnockoutDates()` respects `floorDate` so no future round collapses onto the previous one (the fix from `.opencode/context/knockout-generation/caf-two-qualifiers-and-two-leg-final_2026-09-30.md` already tracks `floorDate` per `lastKey`).
- Deploy: `git push origin main` so the new `postponeBlock` rule reaches production; re-check `/api/cron/expire-postpone-requests` returns 401 (not 404) after deploy.

## Restore File Section
No files deleted.
