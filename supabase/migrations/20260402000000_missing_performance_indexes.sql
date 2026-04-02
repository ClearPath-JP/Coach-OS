-- Gaps vs list-query patterns: session lists by client + status, assignment due ordering, Drive dedupe by file id.

CREATE INDEX IF NOT EXISTS idx_sessions_client_status
  ON public.sessions (client_id, status);

CREATE INDEX IF NOT EXISTS idx_client_assignments_client_due_at
  ON public.client_assignments (client_id, due_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_videos_drive_file_id
  ON public.videos (drive_file_id)
  WHERE drive_file_id IS NOT NULL AND deleted_at IS NULL;
