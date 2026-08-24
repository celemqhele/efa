# Dashboard backdoor approvals skipped knockout progression + SF leg-2 slots never populated

Date: 2026-08-24
Chain: `knockout-generation/` (follow-up to `knockout-webhook-progression_2026-08-23.md` —
that fix covered the WhatsApp webhook paths but NOT the admin dashboard)

## Symptom

After the dashboard approve of Santos 0–3 Leverkusen (UEL QF leg 2, md 111, approved
2026-08-24 ~18:42 UTC), the SF stayed TBC. Same pattern in UCL. Also: SF leg-2 fixtures
(md 211/212) had existed for weeks with both teams null and nothing ever filled them.

## Diagnosis

1. **Dashboard gap**: `/admin/backdoor-submissions` approved results entirely client-side
   (`BackdoorSubmissionsClient.tsx`) — result upsert, standings recalc, WhatsApp notify —
   but never called `advanceWinner`. Evidence: `audit_log` showed only
   `recalculate_standings` at approval time (written solely by
   `/api/admin/recalculate-standings`) and zero `finalise_result` rows that day.
2. **Structural gap**: `BRACKET_PROGRESSION` only targets next-round LEG-1 matchdays
   (101–104 → 201/202, 201/202 → 301). Nothing anywhere populates next-round LEG-2
   matchdays (111–114, 211/212), so they stay null/null until a team reaches them —
   aggregate display and scheduling silently break one round later.

## Fix (two parts)

### Part 1 — server-side approve endpoint

New `app/api/admin/backdoor/approve/route.ts`: POST `{ submissionIds }`, admin-authed.
Loads submissions, computes scores (1 submission → 3–0 against `side_claimed`;
2 → 0–0), inserts confirmations, upserts finalised results, confirms fixture,
recalcs standings, then guarded `advanceWinner` for r16/qf/sf/final, notifies managers.
Client approve branch reduced to a single fetch; decline path untouched.

### Part 2 — mirror leg-2 teams in `advanceWinner`

`lib/tournament-progression.ts` reworked:

- Order-safe two-leg handling: waits until BOTH legs have results regardless of which
  is confirmed second; winner via `determineAggregateWinner(leg1Fixture, leg1Result,
  leg2Fixture, leg2Result)` (pens + forfeit fallback). Single-leg r16/final unchanged.
- New `mirrorLeg2Teams(db, tid, leg1Matchday)`: after writing a winner into a next-round
  leg-1 slot (101–104/201–202), copies the reversed pair into matchday+10 (111–114 /
  211/212) if both leg-1 slots are filled. Called from `advanceWinner`.

Immediate data fix applied manually: Leverkusen into UEL md 201 home slot.

## AGG display overhaul (same session)

User rules: show AGG only on second-leg games; orient it to the displayed sides;
place it under the FT score, never beside it.

- `lib/aggregate.ts`: added `flipAggregate()`. `computeAggregate` stays leg-1-oriented
  ({home} = leg-1 HOME team total = leg-2 AWAY team).
- Admin manage page (`page.tsx`): `_aggregate = flipAggregate(agg)`.
- Manage mobile (`_mobile.tsx`): chips moved from inline-right-of-names to their own row
  under the score line. Desktop was already under the score.
- Public results list (viewer-centric myScore–oppScore): flip when viewer is leg-2 HOME
  team (`isLeg2Home = teamIds.includes(f.home_team_id)` → `flipAggregate`), else raw;
  pens flipped the same way. Added `home_team_id` to the fixtures select. Mobile/desktop
  cards already rendered chips under the score.
- Detail pages (`fixtures/[id]`, `results/[id]`): aggregate now computed ONLY when the
  viewed fixture is leg 2 (`[111–114, 211, 212].includes(matchday)`) as
  `flipAggregate(computeAggregate(siblingResult, result))`; leg-1 views show no AGG.
  `fixtures/[id]/_desktop.tsx` hero restructured so AGG/pens sit in a column under the
  big FT score (was beside it). Mobile heroes were already vertical.

## Auto-advance coverage audit (all paths)

finalise-result ✓ · webhook writeResultToDb ✓ · webhook backdoor approve ✓ ·
webhook backdoor win/override ✓ · WhatsApp resetAndResubmit→writeResultToDb ✓ ·
dashboard approve route ✓ · admin submit page→finalise-result ✓.
`reset-fixture` leaves stale bracket slots by design — self-heals on resubmission.
No manual advancement should ever be needed again.

## Gotchas for next time

- `computeAggregate` orientation trips everyone: it is keyed to LEG-1 home/away, which
  is REVERSED relative to the leg-2 fixture's sides. Always flip for leg-2 display.
- Viewer-personalised pages need a second flip decision (leg-2-home vs leg-2-away view).
- Leg-2 sibling lookup key is `matchday - 10` for qf/sf (and ±10 generally); r16 two-leg
  mds are 61–68 vs single 51–58 — different offset scheme, don't mix.
- The dashboard previously duplicated approve logic client-side; keep such flows
  server-side so progression logic has exactly one choke point per action.
