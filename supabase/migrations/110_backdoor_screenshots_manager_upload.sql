-- Allow authenticated managers to upload backdoor/dispute screenshots directly
-- to Supabase Storage (client-side direct upload to bypass Vercel body cap).
-- Mirrors the match-screenshots INSERT policy.

CREATE POLICY "Managers can upload backdoor screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backdoor-screenshots'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
);

-- Allow authenticated users to read their own uploaded objects via signed URLs
-- (signed URLs bypass RLS, but SELECT is needed for some client helpers).
CREATE POLICY "Managers can read backdoor screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backdoor-screenshots');
