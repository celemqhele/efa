-- AmaZulu 4-3 Kaizer Chiefs
-- Fixture 339f8b4c-20d4-4abb-857e-bb0ad504231e, Motsepe Foundation Championship
-- (Season 4, Division 2), matchday 10, scheduled 2026-09-29 00:00 SAST
-- (= 2026-09-28T22:00Z). AmaZulu are home, so 4-3 is home_score 4.
--
-- Admin submit requested by the league owner after the WhatsApp submission
-- path failed for this fixture. Attributed to wandile.
--
-- Deliberately does NOT call update_standings_atomic / updateLeagueStandings.
-- The on_result_insert trigger (update_standings_after_result) already applies
-- the league result to the slot-keyed standings, sets the fixture to
-- 'confirmed' and scores predictions, all in one pass. app/api/admin/
-- finalise-result/route.ts additionally calls updateLeagueStandings() after the
-- upsert, which would increment the same standings rows a second time.
begin;

-- 1. The result. The trigger handles standings, fixture status and predictions.
insert into results (fixture_id, home_score, away_score, is_abandoned, abandoned_type, finalised_by, override_reason)
values ('339f8b4c-20d4-4abb-857e-bb0ad504231e', 4, 3, false, null,
        '51743aab-c517-43af-b18c-c404bf2be984', null)
on conflict (fixture_id) do update
   set home_score    = excluded.home_score,
       away_score    = excluded.away_score,
       is_abandoned  = excluded.is_abandoned,
       abandoned_type = excluded.abandoned_type,
       finalised_by  = excluded.finalised_by,
       override_reason = excluded.override_reason;

-- 2. Supersede the pending backdoor claim on this fixture. It was filed by
--    goat_2 (AmaZulu's manager) but recorded side_claimed = 'away', i.e. it
--    would have handed the win to Kaizer Chiefs. Left pending, the auto-approve
--    pass would later apply a result contradicting this one.
update backdoor_submissions
   set status = 'void_game_played'
 where fixture_id = '339f8b4c-20d4-4abb-857e-bb0ad504231e'
   and status = 'pending';

-- 3. Notify both managers (admins are notified by the on_fixture_confirmed trigger).
insert into notifications (user_id, type, title, body, data)
values
  ('89388e8a-1cb3-4784-9c68-37c06cbf318a', 'result_confirmed', 'Result Confirmed',
   'AmaZulu 4–3 Kaizer Chiefs',
   '{"fixture_id":"339f8b4c-20d4-4abb-857e-bb0ad504231e","home_score":"4","away_score":"3"}'),
  ('30269b88-9c4d-4779-8f24-1212adc585ef', 'result_confirmed', 'Result Confirmed',
   'AmaZulu 4–3 Kaizer Chiefs',
   '{"fixture_id":"339f8b4c-20d4-4abb-857e-bb0ad504231e","home_score":"4","away_score":"3"}');

-- 4. Audit trail, matching the finalise-result route's entry.
insert into audit_log (admin_id, action, target_type, target_id, details)
values ('51743aab-c517-43af-b18c-c404bf2be984', 'finalise_result', 'fixture',
        '339f8b4c-20d4-4abb-857e-bb0ad504231e',
        '{"home_score":4,"away_score":3,"home_absent":false,"away_absent":false,"via":"admin_direct_submission"}');

commit;
