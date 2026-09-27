-- GLOBAL RESET: lift every manager's sack cooldown.
--
-- What profiles.sacked_at actually is in this codebase:
--   It is NOT an "unemployed"/"sacked" status flag. Nothing in the app filters,
--   hides or badges anyone based on it, and no UI reads it for display. Its only
--   effect is as a 7-day REASSIGNMENT COOLDOWN, enforced at four call sites:
--     app/api/admin/managers/assign/route.ts:68      -> 409 SACK_COOLDOWN
--     lib/slot-utils.ts:692                          -> approveSeasonApplication gate
--     app/api/webhook/route.ts:3204                  -> WhatsApp application gate
--     app/(admin)/admin/tournament-applications/_review.tsx
--   It is written in 3 places (admin/managers/sack, admin/sack,
--   admin/finalise-result) and is NEVER cleared anywhere in the codebase, so a
--   value from months ago lingers forever as a meaningless historical marker.
--
-- Use this script when a cooldown needs lifting in bulk, e.g. at the start of a
-- new season so nobody is blocked from picking up a club. The app has no global
-- override for this: each individual site can only be bypassed one at a time
-- with its own `override` flag, so a full reset is SQL-only by design.
--
-- teams.manager_id is the canonical "has a club" signal and is NOT touched here.
-- manager_tenures is NOT touched here.
--
-- Safe to re-run: it only nulls a nullable column.

UPDATE public.profiles
SET sacked_at = NULL
WHERE sacked_at IS NOT NULL;
