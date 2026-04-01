-- Coaches who own a workspace but lack a coaches row (or have a stale profile.workspace_id)
-- could not SELECT/UPDATE clients under RLS. Allow workspace owner the same as coach membership.

DROP POLICY IF EXISTS "clients_select_workspace" ON public.clients;
CREATE POLICY "clients_select_workspace"
  ON public.clients FOR SELECT
  USING (
    workspace_id = current_workspace_id()
    AND (
      email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = clients.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = clients.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "clients_update_workspace" ON public.clients;
CREATE POLICY "clients_update_workspace"
  ON public.clients FOR UPDATE
  USING (
    workspace_id = current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = clients.workspace_id
      )
      OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = clients.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );
