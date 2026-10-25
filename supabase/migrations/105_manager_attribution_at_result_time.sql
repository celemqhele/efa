-- 105: A manager cannot inherit a result that was already decided before they arrived
--
-- Reported: "if I sack someone today and they get a backdoor loss due to the
-- automatic rules, and I assign someone today a few hours later, that backdoor
-- gets attached to the manager who got assigned that day, making it seem like
-- they got a loss before they even played."
--
-- Cause: manager attribution is resolved from the fixture's *date* only.
-- recalc_tenure_stats() (010, fixed in 054) counts every result on a fixture
-- whose scheduled_date falls inside the tenure, and lib/match-manager.ts picks
-- the latest tenure that overlaps the match day. A sack books 3-0 forfeits for
-- the club's remaining fixtures; the ones that confirm before the replacement
-- arrives stay on file, and a new manager who starts even hours later is inside
-- the same match day, so the loss is credited/shown against them.
--
-- Fix: a tenure may only own a result that came into existence after the tenure
-- started - `results.updated_at ?? results.created_at` (the moment the current
-- result was recorded). A same-day handover is then split by time:
--   * forfeit stamped while the old manager was still there -> old manager,
--   * a real result submitted after the new manager took over -> new manager,
--   * a forfeit stamped while nobody owned the club -> nobody.
-- The winner among overlapping tenures is the latest started_at (id breaks
-- ties), so a fixture is never counted twice. Fixtures with no result yet still
-- resolve to the latest tenure, so an upcoming match belongs to the new manager.
--
-- One deliberate exception: a HUMAN-entered result whose timestamp falls before
-- the fixture's own day is a pre-entry (backdoor/early submission or a
-- placeholder), not evidence of who played, so it is attributed by match day
-- alone. Without that carve-out, nine historical results whose score was keyed
-- in days early would lose their manager. System results (finalised_by null -
-- the managerless/vacant forfeits and auto 0-0 placeholders) get no exception:
-- they are exactly the results that used to be back-dated onto a newcomer.
--
-- results.updated_at is bumped by a BEFORE INSERT/UPDATE trigger so replacing a
-- forfeit with a real score counts as "decided now" instead of keeping the
-- forfeit's original timestamp.
--
-- The same rule is mirrored in lib/match-manager.ts (match/result page hero
-- attribution) and lib/manager-stats-engine.ts now delegates to
-- recalc_manager_stats() so SQL stays the single source of truth.

-- ── 1. results.updated_at ─────────────────────────────────────────────────────
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill with the real insertion time, not the migration time, otherwise
-- every historical result would look like it was decided today.
UPDATE public.results
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.results
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_results_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_results_updated_at ON public.results;
CREATE TRIGGER touch_results_updated_at
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_results_updated_at();

-- ── 2. Tenure stats: only the tenure that owns a result counts it ─────────────
CREATE OR REPLACE FUNCTION public.recalc_tenure_stats(p_tenure_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE manager_tenures mt
  SET
    wins = COALESCE(sub.wins, 0),
    draws = COALESCE(sub.draws, 0),
    losses = COALESCE(sub.losses, 0),
    goals_for = COALESCE(sub.gf, 0),
    goals_against = COALESCE(sub.ga, 0)
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE
        (f.home_team_id = mt2.team_id AND r.home_score > r.away_score) OR
        (f.away_team_id = mt2.team_id AND r.away_score > r.home_score)
      ) AS wins,
      COUNT(*) FILTER (WHERE r.home_score = r.away_score) AS draws,
      COUNT(*) FILTER (WHERE
        (f.home_team_id = mt2.team_id AND r.home_score < r.away_score) OR
        (f.away_team_id = mt2.team_id AND r.away_score < r.home_score)
      ) AS losses,
      SUM(CASE WHEN f.home_team_id = mt2.team_id THEN r.home_score ELSE r.away_score END) AS gf,
      SUM(CASE WHEN f.away_team_id = mt2.team_id THEN r.home_score ELSE r.away_score END) AS ga
    FROM manager_tenures mt2
    JOIN fixtures f ON (f.home_team_id = mt2.team_id OR f.away_team_id = mt2.team_id)
    JOIN results r ON r.fixture_id = f.id
    WHERE mt2.id = p_tenure_id
      -- tenure overlaps the fixture's calendar day (UTC): a same-day start or
      -- sack still counts, which is what lets a mid-day handover be split.
      AND mt2.started_at < ((f.scheduled_date + 1)::timestamp AT TIME ZONE 'UTC')
      AND (mt2.ended_at IS NULL
           OR mt2.ended_at > (f.scheduled_date::timestamp AT TIME ZONE 'UTC'))
      -- ...but the tenure must exist before the result was decided.
      -- A result recorded BEFORE the fixture's day is normally "pre-entered"
      -- (an admin/backdoor result submitted early, or a placeholder): its
      -- timestamp says nothing about who plays that match, so for human-entered
      -- results the day overlap alone decides. System results (finalised_by is
      -- null: managerless/vacant forfeits and auto placeholders) are never given
      -- to a manager who arrived after they were stamped - that is the bug this
      -- migration fixes.
      AND (
        mt2.started_at < COALESCE(r.updated_at, r.created_at)
        OR (
          r.finalised_by IS NOT NULL
          AND COALESCE(r.updated_at, r.created_at)
              < (f.scheduled_date::timestamp AT TIME ZONE 'UTC')
        )
      )
      -- Exactly one owner: a later tenure that also qualifies owns it instead.
      AND NOT EXISTS (
        SELECT 1
        FROM manager_tenures later
        WHERE later.team_id = mt2.team_id
          AND (later.started_at > mt2.started_at
               OR (later.started_at = mt2.started_at AND later.id > mt2.id))
          AND later.started_at < ((f.scheduled_date + 1)::timestamp AT TIME ZONE 'UTC')
          AND (later.ended_at IS NULL
               OR later.ended_at > (f.scheduled_date::timestamp AT TIME ZONE 'UTC'))
          AND (
            later.started_at < COALESCE(r.updated_at, r.created_at)
            OR (
              r.finalised_by IS NOT NULL
              AND COALESCE(r.updated_at, r.created_at)
                  < (f.scheduled_date::timestamp AT TIME ZONE 'UTC')
            )
          )
      )
  ) sub
  WHERE mt.id = p_tenure_id;
END;
$$;

-- Recalc every tenure whose window overlaps the fixture's day. A tenure that
-- started mid-day must be recalculated too (the old '<=' date test skipped it),
-- and the ownership test inside recalc_tenure_stats() decides the winner.
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE id = NEW.fixture_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM recalc_tenure_stats(mt.id)
  FROM manager_tenures mt
  WHERE mt.team_id IN (v_fixture.home_team_id, v_fixture.away_team_id)
    AND mt.started_at < ((v_fixture.scheduled_date + 1)::timestamp AT TIME ZONE 'UTC')
    AND (mt.ended_at IS NULL
         OR mt.ended_at > (v_fixture.scheduled_date::timestamp AT TIME ZONE 'UTC'));

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_on_result_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixture fixtures%ROWTYPE;
BEGIN
  SELECT * INTO v_fixture FROM fixtures WHERE id = OLD.fixture_id;
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  PERFORM recalc_tenure_stats(mt.id)
  FROM manager_tenures mt
  WHERE mt.team_id IN (v_fixture.home_team_id, v_fixture.away_team_id)
    AND mt.started_at < ((v_fixture.scheduled_date + 1)::timestamp AT TIME ZONE 'UTC')
    AND (mt.ended_at IS NULL
         OR mt.ended_at > (v_fixture.scheduled_date::timestamp AT TIME ZONE 'UTC'));

  RETURN OLD;
END;
$$;

-- ── 3. One call to rebuild every tenure (or just one manager's) ───────────────
CREATE OR REPLACE FUNCTION public.recalc_manager_stats(p_manager_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM manager_tenures
    WHERE p_manager_id IS NULL OR manager_id = p_manager_id
  LOOP
    PERFORM recalc_tenure_stats(r.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_manager_stats(uuid) TO service_role, authenticated;

-- ── 4. Repair the stored stats with the corrected rule ───────────────────────
SELECT public.recalc_manager_stats(NULL);
