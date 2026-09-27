-- Move ozilotf (Panama) out of the Premiership group on the "2026 SA Club
-- Selection" poll, following promote_blessing_100sk_to_premiership.sql.
--
-- ozilotf is recovering in hospital from broken legs and cannot participate in
-- any tournament until further notice, so his Premiership slot passes down the
-- combined group-stage board to blessing_100sk (Cote D Ivoire), the next
-- manager below parmalat_. This keeps the Premiership group at 16, matching the
-- 16 PSL clubs, instead of leaving 17 claimants for 16 teams.
--
-- No profile status is changed: the injury is temporary, and profiles.sacked_at
-- means permanently sacked (it feeds vacancy, forfeit and Hall of Fame logic),
-- so it would be the wrong flag for "until further notice".
--
-- Post-state of the Premiership group: ranks 1-13, calvin (15), parmalat_ (16),
-- blessing_100sk (17). Demoted to Motsepe/ABC: ghost (10), ozilotf (15),
-- and the rest of the bottom half.

UPDATE polls
SET voter_restrictions = jsonb_set(
  voter_restrictions,
  '{d7093fb0-2e3b-469d-9d89-6358b212a7c5}',  -- ozilotf (Panama)
  '["motsepe-foundation-championship-2026-2027.football-logos.cc","abc-motsepe-league-2026-2027.football-logos.cc"]'::jsonb
)
WHERE share_code = 'f79b9129';
