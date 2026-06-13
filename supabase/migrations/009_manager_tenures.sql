-- Create manager_tenures table for career stats tracking
CREATE TABLE IF NOT EXISTS public.manager_tenures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) NOT NULL,
  manager_id UUID REFERENCES public.profiles(id) NOT NULL,
  manager_username TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  wins INT DEFAULT 0,
  draws INT DEFAULT 0,
  losses INT DEFAULT 0,
  goals_for INT DEFAULT 0,
  goals_against INT DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.manager_tenures ENABLE ROW LEVEL SECURITY;

-- Policies: public read, admin write
DROP POLICY IF EXISTS "Anyone can read manager tenures" ON public.manager_tenures;
CREATE POLICY "Anyone can read manager tenures"
  ON public.manager_tenures FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage tenures" ON public.manager_tenures;
CREATE POLICY "Admins can manage tenures"
  ON public.manager_tenures FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
