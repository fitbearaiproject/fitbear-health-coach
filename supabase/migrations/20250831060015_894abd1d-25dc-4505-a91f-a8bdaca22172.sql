-- Create ingest bucket for temporary image uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ingest', 'ingest', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create RLS policies for ingest bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'ingest_upload_policy'
  ) THEN
    CREATE POLICY "ingest_upload_policy"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'ingest' AND auth.uid() IS NOT NULL);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'ingest_select_policy'
  ) THEN
    CREATE POLICY "ingest_select_policy"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'ingest');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'ingest_delete_policy'
  ) THEN
    CREATE POLICY "ingest_delete_policy"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'ingest' AND auth.uid() IS NOT NULL);
  END IF;
END $$;