-- Client assignment video uploads: dedicated bucket + link to uploader for stream access before submit.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assignment-submissions',
  'assignment-submissions',
  true,
  104857600,
  ARRAY[
    'video/mp4'::text,
    'video/quicktime'::text,
    'video/webm'::text,
    'video/x-msvideo'::text,
    'video/x-matroska'::text,
    'video/3gpp'::text,
    'video/ogg'::text
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "assignment_submissions_public_select" ON storage.objects;
CREATE POLICY "assignment_submissions_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'assignment-submissions');

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS uploaded_by_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_uploaded_by_client
  ON public.videos (uploaded_by_client_id)
  WHERE uploaded_by_client_id IS NOT NULL;
