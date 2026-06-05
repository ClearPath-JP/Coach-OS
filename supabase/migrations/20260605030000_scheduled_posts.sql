-- Coach Studio Phase 3a: scheduled posts (reminder-share now; auto-post in Phase 4). ADDITIVE.
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,           -- the saved reel to post
  project_id UUID REFERENCES public.video_projects(id) ON DELETE SET NULL, -- provenance (optional)
  platforms TEXT[] NOT NULL DEFAULT '{}',                                  -- e.g. {instagram,facebook}
  caption TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  mode TEXT NOT NULL DEFAULT 'share' CHECK (mode IN ('share','auto')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','reminded','posted','failed','canceled')),
  posted_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace_time
  ON public.scheduled_posts(workspace_id, scheduled_at);
-- For the future executor: find due posts efficiently.
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
  ON public.scheduled_posts(status, scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduled_posts_select_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_select_workspace" ON public.scheduled_posts
  FOR SELECT USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_insert_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_insert_workspace" ON public.scheduled_posts
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_update_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_update_workspace" ON public.scheduled_posts
  FOR UPDATE USING (workspace_id = current_workspace_id());
DROP POLICY IF EXISTS "scheduled_posts_delete_workspace" ON public.scheduled_posts;
CREATE POLICY "scheduled_posts_delete_workspace" ON public.scheduled_posts
  FOR DELETE USING (workspace_id = current_workspace_id());
NOTIFY pgrst, 'reload schema';
