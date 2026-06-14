-- Add theme_preferences column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_preferences JSONB DEFAULT NULL;

-- Allow users to read their own theme_preferences (already covered by existing RLS, but ensure)
-- The existing RLS on profiles allows users to SELECT their own row

-- Allow users to update their own theme_preferences
-- This should be covered by existing RLS as well, but let's be explicit
DROP POLICY IF EXISTS "Users can update their own theme" ON public.profiles;
CREATE POLICY "Users can update their own theme"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
