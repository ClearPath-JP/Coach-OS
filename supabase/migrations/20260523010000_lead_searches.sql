-- Lead research feature (Phase 3 — 2026-05-23)
-- Coaches search for potential clients via Claude API + web_search tool.
-- Results stored as JSONB. Per-workspace, per-plan monthly cap enforced in app code.

CREATE TABLE IF NOT EXISTS public.lead_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL CHECK (char_length(query) BETWEEN 5 AND 500),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'failed')),
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_count INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.lead_searches.results IS
  'Array of { name, platform, handle, url, email, bio, followers }';

CREATE INDEX IF NOT EXISTS idx_lead_searches_workspace_created
  ON public.lead_searches(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_searches_coach
  ON public.lead_searches(coach_id);

ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_searches_select_workspace" ON public.lead_searches;
CREATE POLICY "lead_searches_select_workspace" ON public.lead_searches
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_searches_insert_workspace" ON public.lead_searches;
CREATE POLICY "lead_searches_insert_workspace" ON public.lead_searches
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_searches_update_workspace" ON public.lead_searches;
CREATE POLICY "lead_searches_update_workspace" ON public.lead_searches
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_searches_delete_workspace" ON public.lead_searches;
CREATE POLICY "lead_searches_delete_workspace" ON public.lead_searches
  FOR DELETE USING (workspace_id = current_workspace_id());
