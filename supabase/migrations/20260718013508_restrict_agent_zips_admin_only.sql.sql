-- Make agent-zips bucket private (not public)
UPDATE storage.buckets SET public = false WHERE id = 'agent-zips';

-- Drop existing public policies on agent-zips
DROP POLICY IF EXISTS "public_read_agent_zips" ON storage.objects;
DROP POLICY IF EXISTS "public_upload_agent_zips" ON storage.objects;
DROP POLICY IF EXISTS "public_delete_agent_zips" ON storage.objects;

-- Admin-only read policy for agent-zips
CREATE POLICY "admin_read_agent_zips" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'agent-zips' AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Admin-only write policy for agent-zips
CREATE POLICY "admin_write_agent_zips" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-zips' AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Admin-only delete policy for agent-zips
CREATE POLICY "admin_delete_agent_zips" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'agent-zips' AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Admin-only update policy for agent-zips
CREATE POLICY "admin_update_agent_zips" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'agent-zips' AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (bucket_id = 'agent-zips' AND EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
