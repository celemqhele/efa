# UCL QF tied 12–12 — Club Brugge advanced over Barcelona (away-goals ruling)

Date: 2026-08-25
Chain: `knockout-generation/` (follow-up to `knockout-webhook-progression_2026-08-23.md` and
`backdoor-dashboard-approve-progression_2026-08-24.md`)

## Symptom

All four UCL QF second legs confirmed on Aug 24. Admin noticed Club Brugge vs Barcelona
finished 12–12 on aggregate yet **Barcelona** had been auto-placed into SF md 202 vs Al Hilal,
and asked how a level tie is decided without penalties.

Same-day side report ("placeholders despite all games played"): today's EFA Europa League
list showed 5 fixtures, some with empty team slots. Diagnosis: UEL QF leg 2
Al Khaleej vs Liverpool (md 114) was scheduled onto Aug 25 by the KO scheduler's global
capacity spill while its three sibling legs landed Aug 24. It simply had not been played —
md 202's away slot (winner of that tie) and md 212 (mirror, needs both md 201+202 filled)
were correctly waiting on it. All seven legs actually played had advanced fine.
Admin chose to just play the game; no code/data change.

## Diagnosis

- Leg 1 md 104: Club Brugge 6–5 Barcelona · Leg 2 md 114: Barcelona 7–6 Club Brugge → agg 12–12.
  Neither result has `pen_home_score`/`pen_away_score`.
- `determineAggregateWinner` (`lib/aggregate.ts:80`) order: aggregate → pens on leg 2 →
  **fallback = winner of leg 2** → Barcelona. `advanceWinner` wrote Barcelona into md 202
  (`BRACKET_PROGRESSION[114]` away slot), then `mirrorLeg2Teams` filled md 212
  (Barcelona vs Al Hilal). System worked as coded; the code just has no away-goals rule.
- Tie-break options without pens: away goals (**Brugge**: 6 away goals vs Barca's 5),
  leg-2 winner (**Barca**, current platform rule), neutral-venue replay, extra time,
  coin toss/lots, fair-play record (not tracked). Admin ruled: **away goals → Club Brugge**.

## Data fix (applied 2026-08-24 ~22:21 UTC)

One-off SQL (temp file, not kept as migration):

```sql
UPDATE fixtures SET away_team_id = '<club-brugge>'
WHERE tournament_id = '7174e29f-64c7-4f77-97f2-0fefe15d7e35'
  AND matchday = 202 AND away_team_id = '<barcelona>';

UPDATE fixtures
SET home_team_id = '<club-brugge>', away_team_id = '<al-hilal>'
WHERE tournament_id = '7174e29f-64c7-4f77-97f2-0fefe15d7e35'
  AND matchday = 212 AND home_team_id = '<barcelona>';

INSERT INTO audit_log (action, target_type, target_id, details)
VALUES ('manual_bracket_override', 'tournament', '7174e29f-…',
  '{"reason": "UCL QF Club Brugge vs Barcelona finished 12-12 … admin ruled via away-goals …"}');
```

Verified after: md 201 PSG/Sporting · md 202 **Al Hilal vs Club Brugge** ·
md 211 Sporting/PSG · md 212 **Club Brugge vs Al Hilal** — all `scheduled` Aug 25.
No notifications sent (advancement paths don't notify either; managers see slots via app).

## Gotchas for next time

- Aggregate ties are silently broken by "whoever won leg 2" — this favours the leg-2 HOME
  team and nothing tells managers that rule exists. Pens only count if scores are written
  straight into `results.pen_home_score/pen_away_score`; there is no UI to enter them.
- If away-goals should become platform law, add it inside `determineAggregateWinner` BEFORE
  the pen check — remember `computeAggregate` is keyed to LEG-1 sides, so "away goals" must
  be computed per fixture side, not from the flipped aggregate.
- A manual bracket override must also patch the leg-2 mirror (`matchday + 10`) by hand;
  `advanceWinner` will never re-run for an already-decided tie unless a new confirmation fires.
- When diffing two query snapshots, re-check with a targeted `-c` query instead of eyeballing
  wide grids — a misread row index cost ten minutes of "someone changed the DB" panic here.

## Follow-up (same day): incremental leg-2 mirroring

Admin expected Newcastle to already show in BOTH UEL SF fixtures once its QF was done
(md 202 leg-1 home ✓, but md 212 completely blank). Cause: `mirrorLeg2Teams` was
all-or-nothing — it only copied the reversed pair after **both** leg-1 slots were full,
so a half-decided SF left its whole leg-2 fixture blank even though one side was known.

Fix in `lib/tournament-progression.ts`: mirror now copies each known side immediately
(leg1 home → leg2 away, leg1 away → leg2 home), skipping nulls; empty-patch guarded.
One-off data fix applied: UEL md 212 `away_team_id` = Newcastle United (reversed-pair side),
so today's list reads `? vs Newcastle`. Remaining "?" cells all represent the single
undecided Al Khaleej/Liverpool winner; when that result confirms, `advanceWinner` fills
md 202 away and the mirror completes md 212 automatically.
Verified: `npx tsc --noEmit` clean, `npm run lint` warning-only (pre-existing).

## Status

Applied to prod. Away-goals rule NOT implemented in code — future level ties still fall back
to leg-2 winner unless the admin overrides like this. Leg-2 mirroring is now incremental.

## Related files

- Follow-up (mirrorLeg2Teams + `advanceWinner`) to
  .opencode/context/knockout-generation/backdoor-dashboard-approve-progression_2026-08-24.md
  and .opencode/context/knockout-generation/knockout-webhook-progression_2026-08-23.md.
- Direct follow-up (reverts this manual override, real aggregate was 13–11):
  .opencode/context/knockout-generation/leg1-falsified-score-barcelona-advance_2026-08-25.md.

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
