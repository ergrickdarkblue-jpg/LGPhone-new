-- Screenshot storage policies: public read, authenticated write
CREATE POLICY "screenshots_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'screenshots');

CREATE POLICY "screenshots_auth_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "screenshots_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'screenshots')
  WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "screenshots_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'screenshots');
