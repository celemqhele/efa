-- 086: CAF continental cups qualify 2 per group, QF-first bracket, 2-leg final
--
-- Season 4 launched the CAF Champions League and CAF Confederations League with
-- qualifiers_per_group = 1 across 4 groups of 4, so only 4 teams reached the
-- knockout stage. generateTBCKnockouts()'s teamCount === 4 branch starts at the
-- semi-finals, which is why both CAF cups had no quarter-finals at all.
--
-- Raising qualifiers_per_group to 2 gives 8 qualifiers, which lands on the
-- teamCount === 8 branch: QF (matchday 101-104) -> SF (201-202) -> Final (301),
-- exactly the shape the user asked for.
--
-- num_legs = 2 also makes the CAF finals two-legged (final leg 2 at matchday
-- 311). That required code changes, recorded in
-- .opencode/context/knockout-generation/caf-two-qualifiers-and-two-leg-final_2026-09-30.md:
--
--   * generateTBCKnockouts() emits final leg 2 for the 8- and 4-team branches
--   * BRACKET_PROGRESSION has no entry for 301/311, so advanceWinner() resolves
--     the trophy off the aggregate and waits for the sibling leg
--   * lib/aggregate.ts KO_LEG1/KO_LEG2 matchday bands include 301/311
--   * mirrorLeg2Teams() covers matchday 301
--   * assignKnockoutDates() no longer lets a round share a date with the round
--     that feeds it (the Nedbank Cup had QF, SF and Final all on one day)
--
-- No CAF knockout fixtures exist yet, so nothing needs deleting here — the
-- bracket is generated on demand from the admin "generate knockouts" action
-- once the group stage finishes. This migration only fixes the settings those
-- fixtures will be generated from.

UPDATE tournaments
SET settings = jsonb_set(
      jsonb_set(settings, '{qualifiers_per_group}', '2'::jsonb, true),
      '{num_legs}',
      '2'::jsonb,
      true
    )
WHERE id IN (
  'a38a882b-04c7-4264-a1c8-9e84ee1cecf4',  -- CAF Champions League
  '81f77443-f442-4a5f-b7b8-6fabac3f92d8'   -- CAF Confederations League
)
  AND (settings->>'num_groups')::int = 4;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tournaments TO service_role, anon, authenticated;