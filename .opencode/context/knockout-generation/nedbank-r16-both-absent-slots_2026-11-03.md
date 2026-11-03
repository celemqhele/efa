# Nedbank Cup R16: four empty slots filled after both-absent R32 ties

Filled all four empty Nedbank Cup R16 slots on 2026-11-03 with a single guarded SQL
update, so the round can be played today instead of being auto-finalised as 0-0.
Three R32 ties had ended 0-0 with both teams absent and the tournament-GD tiebreak
could not separate them, and TUT FC's 1-0 win over Orlando Pirates had never been
written into the next round. No application code changed.

Chain: applies the 0-0 rule documented in
`.opencode/context/knockout-generation/knockout-0-0-gd-tiebreak_2026-09-23.md` to the
R32 band laid out in
`.opencode/context/knockout-generation/32-team-r32-round_2026-09-27.md`.

## Problem

Nedbank Cup tournament id: `ab37be7d-9882-463a-8011-620af9417ce1`.

Three R32 ties were confirmed 0-0 with `override_reason` marking both teams absent:

| R32 matchday | Tie | R16 slot left empty |
|---|---|---|
| 401 | Siwelele 0-0 Lamontville Golden Arrows | 51 home |
| 414 | The Bees 0-0 Gomora United | 57 away |
| 415 | Orbit College 0-0 Leicesterford City | 58 home |

`resolveTournamentGdLeader` in `lib/aggregate.ts` adds -3 GD to each side for a
both-absent row, so both teams sat on 0 GD and the helper returned null. Correct per
the existing rule, but it means nobody advanced.

Separately, matchday 405 **TUT FC 1-0 Orlando Pirates** was confirmed on 2026-10-31
yet the winner was never written to matchday 53 home. That is a progression miss,
not a tiebreak failure; root cause not confirmed.

All R16 fixtures are dated 2026-11-03 (SAST). The 02:00 auto-finalise cron does not
exclude null-team fixtures, so an unresolved slot would become another 0-0
both-absent row, the GD helper would return null again (one side null), and the QF
slot would stay empty as well.

## Decision

Picks use league position, goal difference, absence count and head-to-head, all read
from Supabase before the update.

| R32 | Advance | Evidence |
|---|---|---|
| 401 | **Siwelele** | Betway 1st, 73 pts (24W-1D-5L), GF 134 / GA 57 (+77), 0 absences. Arrows 6th, 47 pts, +24 GD, 3 absences. H2H: Siwelele 10-0 and 7-3. |
| 414 | **Gomora United** | Motsepe 7th, 45 pts, +24 GD, 4 absences. Bees 11th, 22 pts, -7 GD, 10 absences. H2H: Gomora 3-0; the other league meeting was also a both-absent 0-0. |
| 415 | **Leicesterford City** | Motsepe 1st, 76 pts (25W-1D-4L), GF 124 / GA 41 (+83), 0 absences. Orbit 2nd, 63 pts, +32 GD, 1 absence. H2H: Leicesterford 11-0 and 6-2. |
| 405 | **TUT FC** (miss fix) | Confirmed 1-0 winner over Orlando Pirates; slot 53 home was still null. |

Leicesterford changed manager to `ourfather_22` on 2026-11-02, after the Nedbank tie,
so the new manager inherits the R16 place.

## Fix

One atomic statement with `IS NULL` guards per slot (rerun-safe), executed with
`npm run db`:

```sql
UPDATE fixtures
SET home_team_id = CASE matchday
      WHEN 51 THEN '60fb79a7-dbb4-42e4-a040-34680092e204'::uuid
      WHEN 53 THEN 'ffcf490d-b9e9-4683-a7b5-3814ebf98147'::uuid
      WHEN 58 THEN '1943b538-a415-43cb-bf7f-4b76c0dd7666'::uuid
      ELSE home_team_id END,
    away_team_id = CASE matchday
      WHEN 57 THEN 'af46f9cb-1237-4b39-abc2-f35858af806f'::uuid
      ELSE away_team_id END
WHERE tournament_id = 'ab37be7d-9882-463a-8011-620af9417ce1'
  AND ((matchday = 51 AND home_team_id IS NULL)
    OR (matchday = 53 AND home_team_id IS NULL)
    OR (matchday = 57 AND away_team_id IS NULL)
    OR (matchday = 58 AND home_team_id IS NULL));
```

Result: `UPDATE (4 rows)`.

R16 bracket after the update:

| Matchday | Home | Away |
|---|---|---|
| 51 | Siwelele | Mamelodi Sundowns |
| 52 | Midlands Wanderers | Stellenbosch |
| 53 | TUT FC | Durban City |
| 54 | Highbury | Sekhukhune United |
| 55 | AmaZulu | Kaizer Chiefs |
| 56 | Ben 10 | University of Pretoria |
| 57 | Hungry Lions | Gomora United |
| 58 | Leicesterford City | Upington City |

## Verification

Re-queried matchdays 51-58 after the update: all eight fixtures have both teams and
remain `scheduled` for 2026-11-03. No participant ids were stamped, matching the
other R16 rows.

## Known follow-up

The TUT FC miss is fixed in data only. Why matchday 405's winner was not written to
slot 53 is still unknown; every submission path calls `advanceWinner`, so watch for a
repeat. No code change was made for this.

## Related files

- 0-0 rule: `.opencode/context/knockout-generation/knockout-0-0-gd-tiebreak_2026-09-23.md`
- R32 band/mapping: `.opencode/context/knockout-generation/32-team-r32-round_2026-09-27.md`
- Tiebreak helper: `lib/aggregate.ts` (`resolveTournamentGdLeader`)
- Progression mapping and winner write: `lib/tournament-progression.ts`
  (`BRACKET_PROGRESSION`, `advanceWinner`)
- Empty-slot auto-finalise risk: `app/api/cron/auto-finalise-prev-day/route.ts`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
