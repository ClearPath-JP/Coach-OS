-- Direct Drive streaming: metadata columns (no video bytes in Supabase)
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS drive_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS drive_web_view_link TEXT;

-- drive_file_id, drive_file_name, duration_seconds, file_size_bytes already exist from 20240316000009_videos.sql
