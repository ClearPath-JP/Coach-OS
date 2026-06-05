-- Coach Studio Phase 2a: audio bucket for uploaded music + recorded voiceovers.
-- Public bucket (matches the existing 'videos'/'assignment-submissions' media buckets) so the
-- Remotion Lambda renderer + the editor can fetch via getPublicUrl. Paths are workspace-prefixed
-- and validated server-side. Uploads go through the service-role client (RLS bypass), so only a
-- public SELECT policy is needed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-audio', 'studio-audio', true, 26214400,
  ARRAY['audio/mpeg'::text, 'audio/mp3'::text, 'audio/wav'::text, 'audio/x-wav'::text,
        'audio/ogg'::text, 'audio/webm'::text, 'audio/mp4'::text, 'audio/aac'::text, 'audio/m4a'::text])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "studio_audio_public_select" ON storage.objects;
CREATE POLICY "studio_audio_public_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'studio-audio');
