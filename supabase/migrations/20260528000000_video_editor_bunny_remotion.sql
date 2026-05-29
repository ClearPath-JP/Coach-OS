-- Video editor (Bunny Stream + Remotion/Lambda) — 2026-05-28
-- Adds Bunny Stream identifiers to videos, and a video_edits table tracking
-- trim + burned-in-caption render jobs (rendered on AWS Lambda via Remotion).
-- Mirrors the lead_searches RLS pattern (workspace-scoped via current_workspace_id()).

-- 1. Bunny Stream columns on videos.
--    storage_provider / playback_url / thumbnail_url / duration_seconds / processing_status already exist;
--    for Bunny videos set storage_provider = 'bunny' and use playback_url for the HLS URL.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS bunny_library_id TEXT,
  ADD COLUMN IF NOT EXISTS bunny_video_guid TEXT,
  ADD COLUMN IF NOT EXISTS mp4_url TEXT,
  ADD COLUMN IF NOT EXISTS captions_vtt_url TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_bunny_guid
  ON public.videos(bunny_video_guid) WHERE bunny_video_guid IS NOT NULL;

-- 2. video_edits — one row per render job.
CREATE TABLE IF NOT EXISTS public.video_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  source_mp4_url TEXT,                 -- Bunny MP4 fed to Remotion (kept if source video is later deleted)
  trim_start_sec NUMERIC NOT NULL DEFAULT 0 CHECK (trim_start_sec >= 0),
  trim_end_sec NUMERIC CHECK (trim_end_sec IS NULL OR trim_end_sec > trim_start_sec),
  caption_style TEXT NOT NULL DEFAULT 'tiktok',
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'rendering', 'done', 'failed')),
  remotion_render_id TEXT,
  remotion_bucket TEXT,
  output_guid TEXT,                    -- Bunny GUID of the rendered output
  output_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_video_edits_workspace_created
  ON public.video_edits(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_edits_coach
  ON public.video_edits(coach_id);

ALTER TABLE public.video_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_edits_select_workspace" ON public.video_edits;
CREATE POLICY "video_edits_select_workspace" ON public.video_edits
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_edits_insert_workspace" ON public.video_edits;
CREATE POLICY "video_edits_insert_workspace" ON public.video_edits
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_edits_update_workspace" ON public.video_edits;
CREATE POLICY "video_edits_update_workspace" ON public.video_edits
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_edits_delete_workspace" ON public.video_edits;
CREATE POLICY "video_edits_delete_workspace" ON public.video_edits
  FOR DELETE USING (workspace_id = current_workspace_id());
