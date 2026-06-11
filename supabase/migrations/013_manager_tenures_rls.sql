-- Add RLS policies for manager_tenures (table existed without policies)
-- This is needed because the original migration 009 was never applied to prod

CREATE POLICY "Anyone can read manager tenures"
  ON public.manager_tenures FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tenures"
  ON public.manager_tenures FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
