-- ============================================================
-- 101 — Flag brand-new accounts to change their default password
-- ============================================================
-- Every account created by the platform starts on the shared default password
-- (DEFAULT_USER_PASSWORD = 'Efootball@2026' in app/api/webhook/route.ts, and the
-- same value in the one-off create-* scripts). We now want first-login users to
-- be prompted to set their own password.
--
-- The column defaults to TRUE, so any profile row inserted from now on (the
-- on_auth_user_created trigger, WhatsApp onboarding, the create-* scripts, or a
-- defensive insert) is flagged automatically — no creation path has to remember
-- to set it. Existing accounts are immediately set back to FALSE so nobody who
-- is already using the app is prompted.
--
-- The flag is cleared by components/ui/ChangePasswordModal.tsx after a
-- successful password change (RLS `profiles_update_own` permits a user to update
-- their own row).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

-- Existing accounts: never prompt. Only rows inserted after this migration keep
-- the default TRUE.
UPDATE public.profiles
  SET must_change_password = false
  WHERE must_change_password = true;
