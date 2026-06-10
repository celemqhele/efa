-- Create manager_availability table
CREATE TABLE IF NOT EXISTS public.manager_availability (
  profile_id UUID REFERENCES public.profiles(id) PRIMARY KEY,
  profile_type TEXT CHECK (profile_type IN ('EVERYDAY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM')),
  schedule JSONB NOT NULL, -- Array of 7 day objects
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.manager_availability ENABLE ROW LEVEL SECURITY;
-- Add policies (admin-only access)
CREATE POLICY "Admins can view all" ON public.manager_availability FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can insert/update all" ON public.manager_availability FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
