-- Coach Studio Phase 1: multi-clip editor projects.
-- ADDITIVE ONLY. video_edits already exists (20260528000000). Nothing existing is dropped.

CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  aspect TEXT NOT NULL DEFAULT '9:16',
  caption_style TEXT NOT NULL DEFAULT 'tiktok'
    CHECK (caption_style IN ('tiktok', 'minimal', 'karaoke', 'none')),
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'rendering', 'rendered', 'failed')),
  last_render_edit_id UUID, -- latest render's video_edits.id; plain column (no FK) to avoid a video_edits<->video_projects cycle; app-managed

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_projects_workspace_updated
  ON public.video_projects(workspace_id, updated_at DESC);

-- A render job can point at a multi-clip project (source_video_id stays nullable for single-clip).
ALTER TABLE public.video_edits
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.video_projects(id) ON DELETE CASCADE;

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_projects_select_workspace" ON public.video_projects;
CREATE POLICY "video_projects_select_workspace" ON public.video_projects
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_insert_workspace" ON public.video_projects;
CREATE POLICY "video_projects_insert_workspace" ON public.video_projects
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_update_workspace" ON public.video_projects;
CREATE POLICY "video_projects_update_workspace" ON public.video_projects
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "video_projects_delete_workspace" ON public.video_projects;
CREATE POLICY "video_projects_delete_workspace" ON public.video_projects
  FOR DELETE USING (workspace_id = current_workspace_id());

NOTIFY pgrst, 'reload schema';
