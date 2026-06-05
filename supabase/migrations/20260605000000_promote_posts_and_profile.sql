-- Promote content workspace — Saved Posts + Brand Voice profile. 2026-06-05
-- ADDITIVE ONLY: two new tables + workspace-scoped RLS (current_workspace_id()).
-- Mirrors the video_edits / video_categories RLS pattern. No changes to existing tables/policies.

-- 1. promote_posts — saved drafts + posted content (one row per generated/saved post).
CREATE TABLE IF NOT EXISTS public.promote_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK (path IN ('idea', 'chat', 'video')),
  kind TEXT CHECK (kind IS NULL OR kind IN ('class', 'workout', 'book1on1', 'bts')),
  platform TEXT CHECK (platform IS NULL OR platform IN ('instagram', 'facebook')),
  tone TEXT CHECK (tone IS NULL OR tone IN ('hype', 'calm', 'friendly')),
  type TEXT NOT NULL CHECK (type IN ('post', 'video')),
  content JSONB NOT NULL,                 -- the Post or VideoPlan object (single representation: render + edit)
  title TEXT,                             -- short shelf label, derived from hook/hookIdea
  source_video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promote_posts_workspace_created
  ON public.promote_posts(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promote_posts_coach
  ON public.promote_posts(coach_id);

ALTER TABLE public.promote_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promote_posts_select_workspace" ON public.promote_posts;
CREATE POLICY "promote_posts_select_workspace" ON public.promote_posts
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_posts_insert_workspace" ON public.promote_posts;
CREATE POLICY "promote_posts_insert_workspace" ON public.promote_posts
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_posts_update_workspace" ON public.promote_posts;
CREATE POLICY "promote_posts_update_workspace" ON public.promote_posts
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_posts_delete_workspace" ON public.promote_posts;
CREATE POLICY "promote_posts_delete_workspace" ON public.promote_posts
  FOR DELETE USING (workspace_id = current_workspace_id());

-- 2. promote_profile — one brand-voice row per workspace (set-once, used everywhere).
CREATE TABLE IF NOT EXISTS public.promote_profile (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  discipline TEXT,
  tone TEXT DEFAULT 'friendly' CHECK (tone IS NULL OR tone IN ('hype', 'calm', 'friendly')),
  platform TEXT DEFAULT 'instagram' CHECK (platform IS NULL OR platform IN ('instagram', 'facebook')),
  booking_url TEXT,
  signature TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promote_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promote_profile_select_workspace" ON public.promote_profile;
CREATE POLICY "promote_profile_select_workspace" ON public.promote_profile
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_profile_insert_workspace" ON public.promote_profile;
CREATE POLICY "promote_profile_insert_workspace" ON public.promote_profile
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_profile_update_workspace" ON public.promote_profile;
CREATE POLICY "promote_profile_update_workspace" ON public.promote_profile
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "promote_profile_delete_workspace" ON public.promote_profile;
CREATE POLICY "promote_profile_delete_workspace" ON public.promote_profile
  FOR DELETE USING (workspace_id = current_workspace_id());
