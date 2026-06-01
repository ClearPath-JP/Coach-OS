-- Per-lead CRM state for Lead Research (2026-06-01).
-- Lazy: a row exists only after a coach sets a status, types a note, or saves a lead.
-- Leads themselves stay in lead_searches.results (JSONB). Keyed by lead_key so state
-- follows a lead across re-searches.
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','replied','converted','not_interested')),
  notes TEXT,
  saved_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, lead_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_workspace
  ON public.lead_interactions(workspace_id);

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_interactions_select_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_select_workspace" ON public.lead_interactions
  FOR SELECT USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_interactions_insert_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_insert_workspace" ON public.lead_interactions
  FOR INSERT WITH CHECK (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_interactions_update_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_update_workspace" ON public.lead_interactions
  FOR UPDATE USING (workspace_id = current_workspace_id());

DROP POLICY IF EXISTS "lead_interactions_delete_workspace" ON public.lead_interactions;
CREATE POLICY "lead_interactions_delete_workspace" ON public.lead_interactions
  FOR DELETE USING (workspace_id = current_workspace_id());
