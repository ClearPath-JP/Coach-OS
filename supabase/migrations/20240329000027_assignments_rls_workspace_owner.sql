-- Workspace owners without a coaches row could not manage assignment templates or assignments.
-- Mirror clients RLS: allow access when workspaces.owner_id = auth.uid().

DROP POLICY IF EXISTS "assignment_templates_coach_select" ON public.assignment_templates;
CREATE POLICY "assignment_templates_coach_select"
  ON public.assignment_templates FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_templates.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assignment_templates_coach_insert" ON public.assignment_templates;
CREATE POLICY "assignment_templates_coach_insert"
  ON public.assignment_templates FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND coach_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_templates.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assignment_templates_coach_update" ON public.assignment_templates;
CREATE POLICY "assignment_templates_coach_update"
  ON public.assignment_templates FOR UPDATE
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_templates.workspace_id AND w.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_templates.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assignment_templates_coach_delete" ON public.assignment_templates;
CREATE POLICY "assignment_templates_coach_delete"
  ON public.assignment_templates FOR DELETE
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_templates.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "client_assignments_coach_all" ON public.client_assignments;
CREATE POLICY "client_assignments_coach_all"
  ON public.client_assignments FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = client_assignments.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = client_assignments.workspace_id AND w.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = client_assignments.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = client_assignments.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assignment_submissions_coach_select" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions_coach_select"
  ON public.assignment_submissions FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_submissions.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = assignment_submissions.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "client_rewards_coach_all" ON public.client_rewards;
CREATE POLICY "client_rewards_coach_all"
  ON public.client_rewards FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = client_rewards.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = client_rewards.workspace_id AND w.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.user_id = auth.uid() AND c.workspace_id = client_rewards.workspace_id
      )
      OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = client_rewards.workspace_id AND w.owner_id = auth.uid()
      )
    )
  );
