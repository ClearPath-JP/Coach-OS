-- Recurring weekly "not available" windows: coach (by user) or client (by clients row).
-- Coaches see all rows in workspace; clients see coach rows + their own.

CREATE TABLE IF NOT EXISTS public.weekly_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  all_day BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_unavailability_subject_ck CHECK (
    (coach_user_id IS NOT NULL AND client_id IS NULL)
    OR (coach_user_id IS NULL AND client_id IS NOT NULL)
  ),
  CONSTRAINT weekly_unavailability_time_ck CHECK (
    all_day = true
    OR (
      start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_weekly_unavailability_workspace ON public.weekly_unavailability(workspace_id);
CREATE INDEX IF NOT EXISTS idx_weekly_unavailability_coach ON public.weekly_unavailability(workspace_id, coach_user_id)
  WHERE coach_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_unavailability_client ON public.weekly_unavailability(workspace_id, client_id)
  WHERE client_id IS NOT NULL;

ALTER TABLE public.weekly_unavailability ENABLE ROW LEVEL SECURITY;

-- Coaches: read all unavailability in workspace (theirs + every client's).
CREATE POLICY "weekly_unavailability_select_coach"
  ON public.weekly_unavailability FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = weekly_unavailability.workspace_id
    )
  );

-- Clients: read coach unavailability + own client rows only.
CREATE POLICY "weekly_unavailability_select_client"
  ON public.weekly_unavailability FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND (
      coach_user_id IS NOT NULL
      OR client_id IN (
        SELECT cl.id FROM public.clients cl
        WHERE cl.workspace_id = weekly_unavailability.workspace_id
          AND cl.email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
      )
    )
  );

CREATE POLICY "weekly_unavailability_insert_coach"
  ON public.weekly_unavailability FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND coach_user_id = auth.uid()
    AND client_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = weekly_unavailability.workspace_id
    )
  );

CREATE POLICY "weekly_unavailability_insert_client"
  ON public.weekly_unavailability FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND coach_user_id IS NULL
    AND client_id IN (
      SELECT cl.id FROM public.clients cl
      WHERE cl.workspace_id = public.current_workspace_id()
        AND cl.email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "weekly_unavailability_update_coach"
  ON public.weekly_unavailability FOR UPDATE
  USING (
    workspace_id = public.current_workspace_id()
    AND coach_user_id = auth.uid()
    AND client_id IS NULL
  );

CREATE POLICY "weekly_unavailability_update_client"
  ON public.weekly_unavailability FOR UPDATE
  USING (
    workspace_id = public.current_workspace_id()
    AND coach_user_id IS NULL
    AND client_id IN (
      SELECT cl.id FROM public.clients cl
      WHERE cl.workspace_id = weekly_unavailability.workspace_id
        AND cl.email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "weekly_unavailability_delete_coach"
  ON public.weekly_unavailability FOR DELETE
  USING (
    workspace_id = public.current_workspace_id()
    AND coach_user_id = auth.uid()
    AND client_id IS NULL
  );

CREATE POLICY "weekly_unavailability_delete_client"
  ON public.weekly_unavailability FOR DELETE
  USING (
    workspace_id = public.current_workspace_id()
    AND coach_user_id IS NULL
    AND client_id IN (
      SELECT cl.id FROM public.clients cl
      WHERE cl.workspace_id = weekly_unavailability.workspace_id
        AND cl.email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
