-- Create storage bucket for custom theme background images
INSERT INTO storage.buckets (id, name, public) VALUES ('theme_backgrounds', 'theme_backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Anyone can view theme backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'theme_backgrounds');

-- Authenticated users can upload their own theme backgrounds
CREATE POLICY "Users can upload their own theme background"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'theme_backgrounds'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own theme backgrounds
CREATE POLICY "Users can update their own theme background"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'theme_backgrounds'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own theme backgrounds
CREATE POLICY "Users can delete their own theme background"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'theme_backgrounds'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
