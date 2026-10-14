-- ============================================================
-- 102 — Detect accounts still using the shared default password
-- ============================================================
-- `must_change_password` (migration 101) only flags accounts created *after*
-- that change, because it relies on the column default. It does nothing for
-- accounts that existed before, nor for accounts reset back to the default by
-- the admin reset route (app/api/admin/reset-password/route.ts) or the WhatsApp
-- reset funnel (app/api/webhook/route.ts).
--
-- Rather than a one-off data migration (which would only catch the accounts
-- that exist today), this adds an exact, permanent check: GoTrue stores bcrypt
-- hashes, so `crypt(<candidate>, encrypted_password) = encrypted_password` is a
-- direct "is the password still the default?" test. Exposing it as a SECURITY
-- DEFINER function lets the first-login prompt ask ANY account still on the
-- default to change it — before the update, after the update, and after any
-- reset — without the app ever seeing the password.

CREATE OR REPLACE FUNCTION public.password_is_default()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
  -- Only ever reports on the CALLER's own password (auth.uid()), so a user can
  -- never probe anyone else's. Anonymous callers get false (auth.uid() IS NULL).
  SELECT COALESCE(
    (
      SELECT u.encrypted_password = extensions.crypt('Efootball@2026', u.encrypted_password)
      FROM auth.users u
      WHERE u.id = auth.uid()
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.password_is_default() TO authenticated, service_role;

COMMENT ON FUNCTION public.password_is_default() IS
  'True when the calling user''s password is still the shared default (Efootball@2026). Used by components/ui/FirstLoginPasswordPrompt.tsx so pre-update accounts and reset accounts are asked to change it too.';

-- ------------------------------------------------------------
-- Immediate sweep: flag the pre-update accounts that have logged in before and
-- are still sitting on the default password, so they are asked on their next
-- login even if the RPC above is somehow unavailable. (The RPC also covers the
-- never-logged-in accounts and any future reset.) Fresh databases have no
-- auth.users rows, so this is a no-op there.
-- ------------------------------------------------------------
UPDATE public.profiles p
   SET must_change_password = true
  FROM auth.users u
 WHERE u.id = p.id
   AND u.last_sign_in_at IS NOT NULL
   AND u.encrypted_password = extensions.crypt('Efootball@2026', u.encrypted_password)
   AND p.must_change_password = false;
