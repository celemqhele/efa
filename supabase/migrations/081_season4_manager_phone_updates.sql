-- 081: Backfill two Season 4 manager WhatsApp numbers
--
-- Supplied by the user while setting up the Div 1 / Div 2 WhatsApp groups:
--   dimarco_32 (The Bees, Motsepe)      +27 77 485 6151
--   ozilotf_    (Gomora United, Motsepe) +27 69 733 3125
--
-- Stored with spaces, matching the style already present on several profiles
-- (e.g. '+27 78 829 9215'). Format is cosmetic and both call sites normalise
-- before comparing or dialling: phoneNumbersMatch() strips non-digits in
-- app/api/webhook/route.ts, and toInternationalPhone() there converts to
-- E.164 for the WhatsApp contacts API (which rejects local-format numbers
-- with error 131009).
--
-- Note on ozilotf_: this manager has TWO accounts, ozilotf and ozilotf_, and
-- 'ozilotf' already held 27697333125 - the same person, same number. This is
-- safe because the app never looks a profile up BY phone: a WhatsApp session
-- resolves to a matched_fixture_id, then to the fixture's teams, then through
-- teams.manager_id to the profile whose phone is compared. There is also no
-- unique constraint or index on profiles.phone. ozilotf_ is the account that
-- actually holds the Gomora United seat.
--
-- Idempotent: re-running rewrites the same two values.

UPDATE profiles SET phone = '+27 77 485 6151' WHERE username = 'dimarco_32';
UPDATE profiles SET phone = '+27 69 733 3125' WHERE username = 'ozilotf_';
