-- Assignments, submissions, client rewards (XP), workspace storage aggregate.
-- RLS: coaches via coaches.workspace_id; clients via email match on clients row.

-- ---------- assignment_templates ----------
CREATE TABLE IF NOT EXISTS public.assignment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  module_id uuid REFERENCES public.program_modules(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text,
  assignment_type text NOT NULL DEFAULT 'text'
    CHECK (assignment_type IN ('text', 'video', 'file', 'checklist')),
  checklist_items jsonb,
  due_days_after_assign integer DEFAULT 7,
  points integer NOT NULL DEFAULT 10,
  is_required boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_templates_workspace
  ON public.assignment_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_program
  ON public.assignment_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_module
  ON public.assignment_templates(module_id);
CREATE INDEX IF NOT EXISTS idx_assignment_templates_deleted
  ON public.assignment_templates(workspace_id) WHERE deleted_at IS NULL;

ALTER TABLE public.assignment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_templates_coach_select"
  ON public.assignment_templates FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
    )
  );

CREATE POLICY "assignment_templates_coach_insert"
  ON public.assignment_templates FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
    )
  );

CREATE POLICY "assignment_templates_coach_update"
  ON public.assignment_templates FOR UPDATE
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
    )
  );

CREATE POLICY "assignment_templates_coach_delete"
  ON public.assignment_templates FOR DELETE
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_templates.workspace_id
    )
  );

-- ---------- client_assignments ----------
CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assignment_template_id uuid NOT NULL REFERENCES public.assignment_templates(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_program_id uuid REFERENCES public.client_programs(id) ON DELETE SET NULL,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'returned', 'overdue')),
  due_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  coach_feedback text,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_assignments_workspace
  ON public.client_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_client
  ON public.client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assignments_status
  ON public.client_assignments(status);
CREATE INDEX IF NOT EXISTS idx_client_assignments_template
  ON public.client_assignments(assignment_template_id);

ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_assignments_coach_all"
  ON public.client_assignments FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = client_assignments.workspace_id
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = client_assignments.workspace_id
    )
  );

CREATE POLICY "client_assignments_client_select"
  ON public.client_assignments FOR SELECT
  USING (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = client_assignments.workspace_id
      LIMIT 1
    )
  );

CREATE POLICY "client_assignments_client_update"
  ON public.client_assignments FOR UPDATE
  USING (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = client_assignments.workspace_id
      LIMIT 1
    )
  )
  WITH CHECK (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = client_assignments.workspace_id
      LIMIT 1
    )
  );

CREATE POLICY "assignment_templates_client_select"
  ON public.assignment_templates FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.client_assignments ca
      JOIN public.clients cl ON cl.id = ca.client_id
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE ca.assignment_template_id = assignment_templates.id
        AND cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND ca.workspace_id = assignment_templates.workspace_id
    )
  );

-- ---------- assignment_submissions ----------
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_assignment_id uuid NOT NULL REFERENCES public.client_assignments(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  submission_type text NOT NULL
    CHECK (submission_type IN ('text', 'video', 'file', 'checklist')),
  text_content text,
  video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  file_url text,
  file_size_bytes bigint,
  checklist_responses jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
  ON public.assignment_submissions(client_assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_workspace
  ON public.assignment_submissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_client
  ON public.assignment_submissions(client_id);

ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_submissions_coach_select"
  ON public.assignment_submissions FOR SELECT
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = assignment_submissions.workspace_id
    )
  );

CREATE POLICY "assignment_submissions_client_select"
  ON public.assignment_submissions FOR SELECT
  USING (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = assignment_submissions.workspace_id
      LIMIT 1
    )
  );

CREATE POLICY "assignment_submissions_client_insert"
  ON public.assignment_submissions FOR INSERT
  WITH CHECK (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = assignment_submissions.workspace_id
      LIMIT 1
    )
    AND workspace_id = (
      SELECT cl.workspace_id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
      LIMIT 1
    )
  );

-- ---------- client_rewards ----------
CREATE TABLE IF NOT EXISTS public.client_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  assignments_completed integer NOT NULL DEFAULT 0,
  assignments_total integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_client_rewards_workspace
  ON public.client_rewards(workspace_id);

ALTER TABLE public.client_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_rewards_coach_all"
  ON public.client_rewards FOR ALL
  USING (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = client_rewards.workspace_id
    )
  )
  WITH CHECK (
    workspace_id = public.current_workspace_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.user_id = auth.uid() AND c.workspace_id = client_rewards.workspace_id
    )
  );

CREATE POLICY "client_rewards_client_select"
  ON public.client_rewards FOR SELECT
  USING (
    client_id = (
      SELECT cl.id FROM public.clients cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(cl.email)) = lower(trim(p.email))
        AND cl.workspace_id = client_rewards.workspace_id
      LIMIT 1
    )
  );

-- ---------- workspaces.storage_used_bytes ----------
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;

-- Recalculate storage for one workspace (videos + assignment file bytes)
CREATE OR REPLACE FUNCTION public.recalc_workspace_storage(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workspaces w
  SET storage_used_bytes = (
    SELECT COALESCE(SUM(v.file_size_bytes), 0)::bigint
    FROM public.videos v
    WHERE v.workspace_id = p_workspace_id
      AND v.deleted_at IS NULL
      AND v.file_size_bytes IS NOT NULL
  ) + (
    SELECT COALESCE(SUM(s.file_size_bytes), 0)::bigint
    FROM public.assignment_submissions s
    WHERE s.workspace_id = p_workspace_id
      AND s.file_size_bytes IS NOT NULL
  )
  WHERE w.id = p_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_workspace_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  wid := COALESCE(NEW.workspace_id, OLD.workspace_id);
  IF wid IS NOT NULL THEN
    PERFORM public.recalc_workspace_storage(wid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalc_storage_on_video ON public.videos;
CREATE TRIGGER recalc_storage_on_video
  AFTER INSERT OR DELETE OR UPDATE OF file_size_bytes, workspace_id, deleted_at
  ON public.videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workspace_storage();

DROP TRIGGER IF EXISTS recalc_storage_on_assignment_submission ON public.assignment_submissions;
CREATE TRIGGER recalc_storage_on_assignment_submission
  AFTER INSERT OR DELETE OR UPDATE OF file_size_bytes, workspace_id
  ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workspace_storage();

-- Backfill workspace storage
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.workspaces
  LOOP
    PERFORM public.recalc_workspace_storage(r.id);
  END LOOP;
END $$;
