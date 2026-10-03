-- 089: Return the Motsepe (division 2) seat to Venda FC.
--
-- Lamontville Golden Arrows is a division 1 club (Betway Premiership) but also
-- held the Motsepe division 2 seat, making it the only club in both divisions
-- (16 + 16 seats with 1 overlap = 31 distinct clubs).
--
-- Cause: that div-2 seat is Venda FC's original seat. reclaimManagerSlots()
-- mutates an existing seat's team_id in place rather than creating a new one, so
-- when jigsaw_rsa moved from Venda FC (a div-2 club) to Golden Arrows (a div-1
-- club) on 2026-09-30, the reclaim matched the vacated div-2 seat and rewrote
-- team_id to Golden Arrows. The seat's history shows the handover:
--
--   MD1  2026-09-28  Venda FC          5-3 AmaZulu
--   MD9  2026-09-29  Venda FC          2-1 Cape Town City
--   MD17 2026-09-30  Vacant            0-3 Kaizer Chiefs   (managerless gap)
--   MD25 2026-10-01  Golden Arrows     0-3 Casric Stars
--   MD33 2026-10-02  Golden Arrows     0-0 Ben 10
--
-- So this is a restore, not an insert: point the seat back at Venda FC. Venda FC
-- has no manager (teams.manager_id is null) and the admin wants it to hold the
-- seat regardless, so the seat stays managerless and forfeitUnmanagedClubSlots()
-- stamps its 0-3 forfeits once it is run.
--
-- Standings need no fixture rewrite for the played games: standings-core.ts
-- resolveSide() prefers the participant row's team_id over the fixture's team_id
-- ("the team copy on an already-played fixture is a historical snapshot...
-- fall back to it only for legacy fixtures without a seat"). Repointing the seat
-- therefore re-attributes MD1-MD33 to Venda FC in one step, which also removes
-- the two div-2 wins Golden Arrows was wrongly inheriting from Venda FC.

begin;

-- 1. The seat itself: back to Venda FC, managerless. Golden Arrows keeps its
--    separate division 1 seat 601b4cf7-df27-491b-bfc5-2f82cbbb0922 untouched.
update public.tournament_participants
   set team_id = 'b874ffb5-3a8f-4fe8-a335-ca4aa8931954', -- Venda FC
       user_id = null,
       vacated_from_team_id = null
 where id = '1e37bed4-9aa6-4a86-8792-6e5b2d7ec7fe';

-- 2. Live fixtures follow the seat. Already-played fixtures keep their team_id
--    copy so the public record still shows who actually played; standings read
--    the participant row, so both sides agree after the repoint above.
update public.fixtures
   set home_team_id = 'b874ffb5-3a8f-4fe8-a335-ca4aa8931954'
 where home_participant_id = '1e37bed4-9aa6-4a86-8792-6e5b2d7ec7fe'
   and status in ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

update public.fixtures
   set away_team_id = 'b874ffb5-3a8f-4fe8-a335-ca4aa8931954'
 where away_participant_id = '1e37bed4-9aa6-4a86-8792-6e5b2d7ec7fe'
   and status in ('scheduled', 'awaiting_confirmation', 'confirmed_pending');

-- 3. Standings row follows the seat (recalculateStandings would do this too, but
--    the row should never be left pointing at a club that left the division).
update public.standings
   set team_id = 'b874ffb5-3a8f-4fe8-a335-ca4aa8931954'
 where participant_id = '1e37bed4-9aa6-4a86-8792-6e5b2d7ec7fe';

update public.group_standings
   set team_id = 'b874ffb5-3a8f-4fe8-a335-ca4aa8931954'
 where participant_id = '1e37bed4-9aa6-4a86-8792-6e5b2d7ec7fe';

commit;
