-- Client-uploaded assignment videos: when the client row is deleted, remove the video row (GDPR).
-- Replaces ON DELETE SET NULL so orphaned video rows are not left behind.

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_uploaded_by_client_id_fkey;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_uploaded_by_client_id_fkey
  FOREIGN KEY (uploaded_by_client_id)
  REFERENCES public.clients(id)
  ON DELETE CASCADE;
