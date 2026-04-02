-- Testimonials, workspace auto check-in settings, client auto check-in tracking,
-- RPC for re-engagement inactive clients (message + activity).

CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  client_name text NOT NULL,
  content text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  is_approved boolean DEFAULT false,
  is_public boolean DEFAULT false,
  source text DEFAULT 'in_app'
    CHECK (source IN ('in_app', 'manual')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_workspace"
  ON public.testimonials FOR ALL
  USING (workspace_id = public.current_workspace_id());

CREATE POLICY "testimonials_client_insert"
  ON public.testimonials FOR INSERT
  WITH CHECK (
    workspace_id = (
      SELECT c.workspace_id FROM public.clients c
      WHERE c.id = testimonials.client_id
        AND c.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
      LIMIT 1
    )
  );

CREATE POLICY "testimonials_client_select"
  ON public.testimonials FOR SELECT
  USING (
    client_id = (
      SELECT c.id FROM public.clients c
      WHERE c.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
      LIMIT 1
    )
  );

CREATE INDEX idx_testimonials_workspace_created
  ON public.testimonials(workspace_id, created_at DESC);

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS auto_checkin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_checkin_message text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_auto_checkin_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_coach_reengagement_inactive_clients(
  p_workspace_id uuid,
  p_coach_user_id uuid,
  p_before timestamptz,
  p_limit int
)
RETURNS TABLE (
  client_id uuid,
  first_name text,
  last_name text,
  email text,
  coach_id uuid,
  last_engagement_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.coach_id,
    GREATEST(
      COALESCE(mx.mx_at, c.created_at),
      COALESCE(r.last_activity_at, c.created_at)
    ) AS last_engagement_at
  FROM public.clients c
  LEFT JOIN LATERAL (
    SELECT MAX(m.created_at) AS mx_at
    FROM public.messages m
    WHERE m.client_id = c.id AND m.workspace_id = c.workspace_id
  ) mx ON true
  LEFT JOIN public.client_rewards r
    ON r.client_id = c.id AND r.workspace_id = c.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND c.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.coaches co
      WHERE co.user_id = auth.uid()
        AND co.user_id = p_coach_user_id
        AND co.workspace_id = p_workspace_id
    )
    AND GREATEST(
      COALESCE(mx.mx_at, c.created_at),
      COALESCE(r.last_activity_at, c.created_at)
    ) < p_before
  ORDER BY last_engagement_at ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_coach_reengagement_inactive_clients(uuid, uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_reengagement_inactive_clients(uuid, uuid, timestamptz, int) TO authenticated;
