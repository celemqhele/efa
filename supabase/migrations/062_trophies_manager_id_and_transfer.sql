-- Migration 062: Add manager_id to trophies + backfill + transfer function
-- Trophies become manager-based (follow the manager, not just the team)

-- ============================================================
-- 1. Add manager_id column to trophies
-- ============================================================
ALTER TABLE public.trophies
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id);

-- ============================================================
-- 2. Backfill existing trophies using tenure records + manual assignments
-- ============================================================

-- Terrence (a01ab5d3) — Brentford league, Brentford x2 tournament club, Morocco intl, Al Hilal league
UPDATE public.trophies SET manager_id = 'a01ab5d3-9143-4f31-b588-32f5507e49b7'
WHERE id IN (
  'f1fbcd47-6bc9-4e66-9878-bc7a15f09634',  -- Brentford League (Jun 7)
  'ebc4e73c-dbc4-41e9-bdda-a9c438a83da6',  -- Brentford Tournament Club (Jun 14)
  'e843d0b0-b447-4d59-9506-8c053e5de4a6',  -- Brentford Tournament Club (Jun 15)
  '7764a456-4598-47cb-9e71-b1e43a4d999c',  -- Morocco Tournament Intl (Jul 1)
  'f241ddba-7283-470e-b4ea-29954c62d800'   -- Al Hilal League (Aug 22)
);

-- phiwayinkosi (401bb18b) — Brighton tournament club
UPDATE public.trophies SET manager_id = '401bb18b-8b3b-4f05-966f-36e6d5ccdc1b'
WHERE id = '89294f7c-5ba9-4d4e-8d72-e726991e8b94';

-- wandile (51743aab) — Tottenham Hotspur league
UPDATE public.trophies SET manager_id = '51743aab-c517-43af-b18c-c404bf2be984'
WHERE id = 'a0adcf18-a209-4db5-afcf-dff45c455a38';

-- dot7 (7128a84a) — Nottingham Forest league
UPDATE public.trophies SET manager_id = '7128a84a-c25f-4079-b198-d06be6ba09d2'
WHERE id = 'e9b71a5a-d8f3-47b7-9748-24bde64155b5';

-- tildedot (77b16465) — Newcastle United tournament club (Aug 24)
UPDATE public.trophies SET manager_id = '77b16465-91bb-4cf0-bbad-ff1128953a28'
WHERE id = '5901724f-a81d-45dd-9f58-db3f908b9f93';

-- Liverpool trophies (Apr 23) and Newcastle trophy (Apr 23) remain NULL
-- (no tenure records exist for Phase 1 for those teams)

-- ============================================================
-- 3. Create transfer function: move all manager data to a new account
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_manager_data(
  p_from_user_id UUID,
  p_to_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_from_username TEXT;
  v_to_username TEXT;
  v_forfeits INT := 0;
  v_tenures INT := 0;
  v_trophies INT := 0;
BEGIN
  -- Validate both users exist
  SELECT username INTO v_from_username FROM public.profiles WHERE id = p_from_user_id;
  IF v_from_username IS NULL THEN
    RAISE EXCEPTION 'Source user not found';
  END IF;

  SELECT username INTO v_to_username FROM public.profiles WHERE id = p_to_user_id;
  IF v_to_username IS NULL THEN
    RAISE EXCEPTION 'Destination user not found';
  END IF;

  -- 1. Transfer forfeit balances
  UPDATE public.forfeit_balances
  SET forfeiting_manager_id = p_to_user_id
  WHERE forfeiting_manager_id = p_from_user_id;
  GET DIAGNOSTICS v_forfeits = ROW_COUNT;

  -- 2. Transfer tenures (update manager_id and manager_username)
  UPDATE public.manager_tenures
  SET manager_id = p_to_user_id,
      manager_username = v_to_username
  WHERE manager_id = p_from_user_id;
  GET DIAGNOSTICS v_tenures = ROW_COUNT;

  -- 3. Transfer trophies
  UPDATE public.trophies
  SET manager_id = p_to_user_id
  WHERE manager_id = p_from_user_id;
  GET DIAGNOSTICS v_trophies = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'from_username', v_from_username,
    'to_username', v_to_username,
    'forfeits_transferred', v_forfeits,
    'tenures_transferred', v_tenures,
    'trophies_transferred', v_trophies
  );
END;
$$;

-- Grant execute to authenticated (admin checks happen in the API route)
GRANT EXECUTE ON FUNCTION public.transfer_manager_data(UUID, UUID) TO authenticated;
