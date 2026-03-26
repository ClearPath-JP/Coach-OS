-- Ensure videos.category exists for library grouping (may already exist from base schema)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_workspace_category ON public.videos(workspace_id, category)
  WHERE deleted_at IS NULL;
