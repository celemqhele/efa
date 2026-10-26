-- One-off: settle the agreed-postponement fixture Highbury 3-0 Siwelele
-- (match day 2026-10-25). The moved day has passed with no real result, so the
-- placeholder is final; dropping postponed_confirmed takes it off the admin
-- due/completed-pending lists and the public upcoming lists.
--
-- The attribution fix in 106_tenure_attribution_sast_match_day.sql keeps the
-- 3-0 with Terrence (in charge on the match day) and off maskandi_mfana, who was
-- assigned at 00:13 SAST on the 26th.
UPDATE public.fixtures
SET postponed_confirmed = false
WHERE id = '48421bed-f03f-4d46-a48c-de2acb384444'
  AND postponed_confirmed = true;

INSERT INTO public.audit_log (admin_id, action, target_type, target_id, details)
VALUES (
  NULL,
  'settle_postponed_fixture',
  'fixture',
  '48421bed-f03f-4d46-a48c-de2acb384444',
  jsonb_build_object(
    'reason', 'Agreed postponement (moved to 2026-10-25) passed without a real result; placeholder is final',
    'result', 'Highbury 3-0 Siwelele',
    'attribution', 'Terrence (previous Siwelele manager, tenure ended 2026-10-25T21:43:50Z)',
    'not_attributed_to', 'maskandi_mfana (assigned 2026-10-25T22:13:10Z)'
  )
);
