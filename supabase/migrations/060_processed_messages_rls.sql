-- Enable Row Level Security on processed_messages (Supabase dashboard warning).
-- service_role bypasses RLS, so webhook inserts and pg_cron cleanup are unaffected.
ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;

-- Minimal policies: match existing GRANTs from 048.
-- No SELECT policy needed — no application code reads this table.
CREATE POLICY "Authenticated can insert processed messages"
  ON public.processed_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete processed messages"
  ON public.processed_messages
  FOR DELETE
  USING (auth.role() = 'authenticated');
