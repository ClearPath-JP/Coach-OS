-- Coach dashboards filter assignments by workspace + status; complements single-column indexes.
CREATE INDEX IF NOT EXISTS idx_client_assignments_workspace_status
  ON public.client_assignments (workspace_id, status);
