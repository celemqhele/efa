-- Forfeit balances table: tracks forfeit penalties that can be applied to future matches
CREATE TABLE IF NOT EXISTS public.forfeit_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id UUID REFERENCES public.fixtures(id) NOT NULL,
  forfeiting_team_id UUID REFERENCES public.teams(id) NOT NULL,
  opponent_team_id UUID REFERENCES public.teams(id) NOT NULL,
  opponent_score INT NOT NULL,
  forfeiting_score INT NOT NULL,
  half_time_note TEXT NOT NULL,
  remaining INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.forfeit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read forfeit_balances"
  ON public.forfeit_balances FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage forfeit_balances"
  ON public.forfeit_balances FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Standings columns for absent games and GD penalty
ALTER TABLE public.standings ADD COLUMN IF NOT EXISTS absent INT DEFAULT 0;
ALTER TABLE public.standings ADD COLUMN IF NOT EXISTS gd_penalty INT DEFAULT 0;
ALTER TABLE public.group_standings ADD COLUMN IF NOT EXISTS absent INT DEFAULT 0;
ALTER TABLE public.group_standings ADD COLUMN IF NOT EXISTS gd_penalty INT DEFAULT 0;
