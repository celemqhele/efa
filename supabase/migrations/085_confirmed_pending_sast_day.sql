-- 085: Release confirmed_pending results at the START of the fixture's matchday
--
-- The rule being enforced: a result submitted for a game due in the future stays
-- 'confirmed_pending' (captured, but out of the standings) until 00:00 SAST on
-- the fixture's own scheduled_date - the beginning of that matchday - NOT at the
-- end of the deadline window.
--
-- Root cause: every "is this fixture still in the future?" comparison in the
-- database used CURRENT_DATE. This database runs on UTC (SHOW timezone = UTC)
-- while the app's day rolls at SAST midnight (UTC+2, no DST), so for the first
-- two hours of every matchday the database's idea of "today" is a day behind.
-- Two separate comparisons were affected:
--
-- 1) flip_pending_results() released on CURRENT_DATE. The flip cron is
--    scheduled "0 22 * * *" (vercel.json) = 00:00 SAST - the exact moment
--    CURRENT_DATE is still the PREVIOUS utc day. So for a fixture whose matchday
--    had just begun, `scheduled_date <= CURRENT_DATE` was false, the UPDATE
--    matched 0 rows, and the release slipped a full 24 hours. Live proof from
--    live data: a fixture due 2026-10-01 whose result was submitted
--    2026-09-30 21:41 UTC stayed pending until 00:00 SAST on 2026-10-02, even
--    though flip_pending_results() is the only thing that can promote a pending
--    fixture, which proves the cron did run - it just no-oped.
--
-- 2) update_standings_after_result()'s parking guard also used CURRENT_DATE, so
--    a submission made between 00:00 and 02:00 SAST on the matchday itself was
--    treated as future-dated and parked. The webhook had already classified
--    that same submission as on-time (it uses getSastDateKey() from
--    lib/app-time.ts), so the two halves of the submit path disagreed for that
--    2-hour window. This was already flagged as a known limit in
--    .opencode/context/auto-finalise/auto-finalise-cron_2026-09-17.md and
--    .opencode/context/user-based-competitions/sack-keeps-club-managerless-forfeits_2026-09-30.md.
--
-- The fix introduces one canonical "today" inside the database -
-- app_current_date(), SAST - and routes both comparisons through it.
-- flip_pending_results() also gains an explicit p_today parameter so the caller
-- (app/api/cron/flip-pending/route.ts) passes the same getSastDateKey() it
-- already uses to SELECT the work, which makes the two halves of that cron
-- agree by construction instead of by coincidence. p_today defaults to NULL ->
-- app_current_date(), so any other/no-arg caller gets the corrected behaviour.
--
-- Nothing is flipped by this migration: flip_pending_results() also needs the
-- app's recalculateStandings()/advanceWinner() follow-up, which no pg_cron or
-- SQL migration can perform, so the pending rows are left for the next cron run
-- to release (at 00:00 SAST, correctly, from now on).

-- ─────────────────────────────────────────────────────────────
-- 1) One canonical "today" for the app: SAST, not UTC
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.app_current_date()
RETURNS date AS $$
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')::date;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.app_current_date() IS
  'Current date in SAST (Africa/Johannesburg). The canonical "today" for comparing against fixtures.scheduled_date, which holds the matchday a manager sees. CURRENT_DATE is wrong here: this DB runs on UTC, so it is a day behind between 00:00 and 02:00 SAST.';

-- ─────────────────────────────────────────────────────────────
-- 2) Park future results by SAST day, not UTC day
-- ─────────────────────────────────────────────────────────────
-- Patched in place off its own live definition rather than re-declared, so this
-- migration cannot drift from the deployed body (the same technique, and for the
-- same reason, as 080_fix_both_absent_case_sensitive.sql). pg_get_functiondef()
-- emits CREATE OR REPLACE, so the trigger object on_result_insert stays attached
-- to the same function OID.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'update_standings_after_result';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'update_standings_after_result() not found';
  END IF;

  -- Idempotent: already patched, nothing to do.
  IF v_def LIKE '%app_current_date()%' THEN
    RETURN;
  END IF;

  IF v_def NOT LIKE '%(v_fixture.scheduled_date)::date > CURRENT_DATE%' THEN
    RAISE EXCEPTION 'expected CONFIRMED PENDING guard not found in trigger body - review manually';
  END IF;

  v_def := replace(
    v_def,
    '(v_fixture.scheduled_date)::date > CURRENT_DATE',
    '(v_fixture.scheduled_date)::date > public.app_current_date()'
  );

  EXECUTE v_def;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3) Release pending results by SAST day, caller-supplied or default
-- ─────────────────────────────────────────────────────────────
-- DROP first (not CREATE OR REPLACE) because the parameter list changes the
-- function's identity: without this the old zero-argument overload would survive
-- and `rpc('flip_pending_results')` would be ambiguous. Nothing depends on the
-- function object itself - it is only ever called over PostgREST.
DROP FUNCTION IF EXISTS public.flip_pending_results();

CREATE OR REPLACE FUNCTION public.flip_pending_results(p_today date DEFAULT NULL)
RETURNS int AS $$
DECLARE
  affected int;
BEGIN
  UPDATE fixtures SET status = 'confirmed'
  WHERE status = 'confirmed_pending'
    AND scheduled_date IS NOT NULL
    AND scheduled_date <= COALESCE(p_today, public.app_current_date());
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.flip_pending_results(date) IS
  'Promotes confirmed_pending fixtures due on or before p_today (default: today in SAST) to confirmed. Called by app/api/cron/flip-pending at 00:00 SAST so a held result is released at the START of its matchday. Firing the status update from inside the function is what keeps the on_fixture_confirmed trigger (migration 037) firing the admin notification.';

-- Server-side only (the cron route uses the service-role client).
GRANT EXECUTE ON FUNCTION public.app_current_date() TO service_role;
GRANT EXECUTE ON FUNCTION public.flip_pending_results(date) TO service_role;