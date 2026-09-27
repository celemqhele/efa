-- Promote blessing_100sk (Cote D Ivoire) into the Premiership group on the
-- "2026 SA Club Selection" poll.
--
-- Combined EFA International Cup group-stage board (points desc, then GD desc,
-- then goals for desc), per lib/poll-voter-restrictions.ts rankTournamentManagers:
--   rank 15  ozilotf          Panama         9 pts  GD  +2   (already PSL)
--   rank 16  calvin           Spain          9 pts  GD  -1   (already PSL)
--   rank 17  parmalat_        England        9 pts  GD -11   (already PSL)
--   rank 18  blessing_100sk   Cote D Ivoire  7 pts  GD  +3   <- promoted here
--
-- blessing_100sk is the manager directly below parmalat_ on that board, who was
-- promoted into the top 16 by swap_ghost_parmalat_poll_voters.sql. Each folder
-- list is a single-folder array, so the value is replaced wholesale.
--
-- Note: this takes the Premiership group to 17 managers against 16 PSL clubs.
-- ozilotf (rank 15) is in hospital recovering from broken legs and cannot
-- participate until further notice, so the effective number of active PSL
-- claimants stays at 16.

UPDATE polls
SET voter_restrictions = jsonb_set(
  voter_restrictions,
  '{8f3a9489-8c31-421d-91bc-b890088ed44d}',  -- blessing_100sk (Cote D Ivoire)
  '["south-african-premiership-2026-2027.football-logos.cc"]'::jsonb
)
WHERE share_code = 'f79b9129';
