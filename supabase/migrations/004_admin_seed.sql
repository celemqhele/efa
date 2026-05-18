-- EFA Platform — Admin Account Seeds
-- Passwords are printed below. Store them securely immediately.
-- Run AFTER enabling email auth with email_confirm=false in Supabase dashboard.

-- ADMIN CREDENTIALS (save these now — they will not be shown again):
-- mubizamaan  / EFA_Admin_Mub!2024#Secure
-- celemqhele  / EFA_Admin_Cel!2024#Secure
-- wandile     / EFA_Admin_Wan!2024#Secure

-- Create admin users via Supabase Auth (run in SQL editor)
-- Note: Supabase hashes passwords automatically — these use bcrypt
DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
  user3_id uuid;
BEGIN
  -- Insert into auth.users (Supabase manages the actual password hashing)
  -- You must use the Supabase dashboard or API to create users with passwords
  -- This seed just inserts profile rows for users created via the dashboard

  -- After creating users in Supabase Auth Dashboard with above credentials,
  -- run this to set their roles:
  UPDATE profiles SET role = 'admin'
  WHERE username IN ('mubizamaan', 'celemqhele', 'wandile');
END $$;

-- Instructions:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Create user: email=mubizamaan@efa.local, password=EFA_Admin_Mub!2024#Secure
--    Metadata: {"username": "mubizamaan"}
-- 3. Create user: email=celemqhele@efa.local, password=EFA_Admin_Cel!2024#Secure
--    Metadata: {"username": "celemqhele"}
-- 4. Create user: email=wandile@efa.local, password=EFA_Admin_Wan!2024#Secure
--    Metadata: {"username": "wandile"}
-- 5. Run this migration to elevate them to admin role
