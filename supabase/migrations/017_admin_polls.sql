-- Admin polls for team selection applications
-- Allows admins to create polls where users can apply for teams first-come-first-served

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  share_code TEXT UNIQUE NOT NULL,
  allowed_leagues TEXT[] DEFAULT '{}',
  allowed_international BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- ============================================================
-- POLL APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.poll_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES public.profiles(id) NOT NULL,
  team_name TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  team_league TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, team_slug, team_league)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_applications ENABLE ROW LEVEL SECURITY;

-- Polls: anyone can read open polls; admins can manage all
CREATE POLICY "Anyone can read open polls"
  ON public.polls FOR SELECT
  USING (status = 'open' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage polls" ON public.polls;
CREATE POLICY "Admins can manage polls"
  ON public.polls FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Poll applications: anyone can read; users insert/update their own; admins manage all
CREATE POLICY "Anyone can read poll applications"
  ON public.poll_applications FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own applications"
  ON public.poll_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Users can update their own applications"
  ON public.poll_applications FOR UPDATE
  USING (auth.uid() = applicant_id);

CREATE POLICY "Admins can manage all poll applications"
  ON public.poll_applications FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
