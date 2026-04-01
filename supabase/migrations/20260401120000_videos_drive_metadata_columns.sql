-- Direct Drive streaming metadata (idempotent). Aligns with app expectations; no video bytes in Supabase.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_file_name text,
  ADD COLUMN IF NOT EXISTS drive_mime_type text,
  ADD COLUMN IF NOT EXISTS drive_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS drive_web_view_link text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

CREATE INDEX IF NOT EXISTS idx_videos_workspace_drive_file
  ON public.videos (workspace_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL AND deleted_at IS NULL;
