-- 106: Tenure attribution follows the SAST match day, and an agreed-postponement
-- placeholder never lands on the manager who arrived afterwards.
--
-- Reported: the Highbury 3-0 Siwelele postponement placeholder (Highbury vs
-- Siwelele, match day 2026-10-25) was credited to the NEW Siwelele manager
-- `maskandi_mfana` (assigned 2026-10-26 00:13 SAST) instead of `Terrence`, who
-- was in charge when the postponement was agreed and was sacked at 23:43 SAST on
-- the match day. The new manager's tenure card read 0 wins / 0 draws / 1 loss,
-- 0 GF / 3 GA without him ever playing.
--
-- Two holes in 105_manager_attribution_at_result_time.sql:
--
-- 1. The "calendar day" arithmetic treated `fixtures.scheduled_date` — a plain
--    DATE holding the SAST matchday — as UTC midnight:
--      (scheduled_date::timestamp AT TIME ZONE 'UTC')
--    so the overlap window was [00:00Z, 24:00Z) of that date, i.e. 02:00 SAST to
--    02:00 SAST next day. Anyone appointed in the first two hours of the following
--    SAST day (00:00–02:00) counted as overlapping the PREVIOUS match day. SAST is
--    UTC+2 year-round (see lib/app-time.ts), so the day window must be built with
--    `AT TIME ZONE 'Africa/Johannesburg'`.
--
-- 2. The pre-entry carve-out ("a human result recorded before the fixture's day
--    is attributed by match day alone") keyed only on `results.finalised_by`.
--    The 3-0 placeholder written when a postponement is accepted is stamped with
--    the ACCEPTOR's id (app/api/submit-match/route.ts), so it looked like a human
--    result and the carve-out let match-day overlap alone decide — including for a
--    manager who arrived on the moved day after the placeholder was stamped. A
--    postponement placeholder is a system placeholder, not a result a manager
--    played out, so it is excluded from the carve-out: only a tenure that already
--    existed when it was stamped can own it.
--
-- The rule is mirrored in lib/match-manager.ts (plus the pages that build
-- `systemResult`) so the match/result hero and the team-page form agree with the
-- stored tenure stats. Follows
-- .opencode/context/manager-stats/forfeit-attribution-before-assignment_2026-10-25.md.

-- ── 1. Tenure stats: SAST match day + postponement placeholders are system ────
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
      -- tenure overlaps the fixture's SAST match day: a same-day start or sack
      -- still counts, which is what lets a mid-day handover be split.
      AND mt2.started_at < ((f.scheduled_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
      AND (mt2.ended_at IS NULL
           OR mt2.ended_at > (f.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg'))
      -- ...but the tenure must exist before the result was decided.
      -- A HUMAN result recorded BEFORE the fixture's day is normally "pre-entered"
      -- (an admin/backdoor result keyed in early), so its timestamp says nothing
      -- about who plays that match and the day overlap alone decides. System
      -- results (finalised_by null: managerless/vacant forfeits, auto 0-0
      -- placeholders) and agreed-postponement placeholders (finalised_by is the
      -- acceptor, but the 3-0 is booked by the system when the request is
      -- accepted) get no exception - they are exactly the ones that used to be
      -- back-dated onto a newcomer.
      AND (
        mt2.started_at < COALESCE(r.updated_at, r.created_at)
        OR (
          r.finalised_by IS NOT NULL
          AND COALESCE(r.override_reason, '') <> 'postponement agreed'
          AND COALESCE(r.updated_at, r.created_at)
              < (f.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg')
        )
      )
      -- Exactly one owner: a later tenure that also qualifies owns it instead.
      AND NOT EXISTS (
        SELECT 1
        FROM manager_tenures later
        WHERE later.team_id = mt2.team_id
          AND (later.started_at > mt2.started_at
               OR (later.started_at = mt2.started_at AND later.id > mt2.id))
          AND later.started_at < ((f.scheduled_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
          AND (later.ended_at IS NULL
               OR later.ended_at > (f.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg'))
          AND (
            later.started_at < COALESCE(r.updated_at, r.created_at)
            OR (
              r.finalised_by IS NOT NULL
              AND COALESCE(r.override_reason, '') <> 'postponement agreed'
              AND COALESCE(r.updated_at, r.created_at)
                  < (f.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg')
            )
          )
      )
  ) sub
  WHERE mt.id = p_tenure_id;
END;
$$;

-- Recalc every tenure whose window overlaps the fixture's SAST match day (a
-- tenure that started mid-day must be recalculated too). The ownership test
-- inside recalc_tenure_stats() decides the winner.
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
    AND mt.started_at < ((v_fixture.scheduled_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
    AND (mt.ended_at IS NULL
         OR mt.ended_at > (v_fixture.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg'));

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
    AND mt.started_at < ((v_fixture.scheduled_date + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
    AND (mt.ended_at IS NULL
         OR mt.ended_at > (v_fixture.scheduled_date::timestamp AT TIME ZONE 'Africa/Johannesburg'));

  RETURN OLD;
END;
$$;

-- ── 2. Rebuild every tenure with the corrected rule ───────────────────────────
SELECT public.recalc_manager_stats(NULL);
