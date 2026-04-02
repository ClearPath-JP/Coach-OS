-- Dashboard "needs attention": stale threads and near-complete programs (single round-trips).

CREATE OR REPLACE FUNCTION public.get_coach_stale_thread_clients(
  p_workspace_id uuid,
  p_coach_user_id uuid,
  p_before timestamptz,
  p_limit int
)
RETURNS TABLE (
  client_id uuid,
  first_name text,
  last_name text,
  last_message_at timestamptz
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
    COALESCE(mx.last_at, c.created_at) AS last_message_at
  FROM public.clients c
  LEFT JOIN LATERAL (
    SELECT MAX(m.created_at) AS last_at
    FROM public.messages m
    WHERE m.client_id = c.id
      AND m.workspace_id = c.workspace_id
  ) mx ON true
  WHERE c.workspace_id = p_workspace_id
    AND c.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.coaches co
      WHERE co.user_id = auth.uid()
        AND co.user_id = p_coach_user_id
        AND co.workspace_id = p_workspace_id
    )
    AND COALESCE(mx.last_at, c.created_at) < p_before
  ORDER BY mx.last_at ASC NULLS FIRST, c.created_at ASC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_coach_stale_thread_clients(uuid, uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_stale_thread_clients(uuid, uuid, timestamptz, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_coach_near_complete_programs(
  p_workspace_id uuid,
  p_coach_user_id uuid,
  p_ratio double precision,
  p_limit int
)
RETURNS TABLE (
  client_id uuid,
  first_name text,
  last_name text,
  client_program_id uuid,
  program_title text,
  completed_count bigint,
  total_modules int,
  completion_ratio double precision
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
    cp.id,
    p.title,
    cnt.n::bigint,
    p.total_modules,
    (cnt.n::double precision / NULLIF(p.total_modules, 0)::double precision)
  FROM public.client_programs cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.programs p ON p.id = cp.program_id
  JOIN LATERAL (
    SELECT COUNT(*)::int AS n
    FROM public.program_progress pp
    WHERE pp.client_program_id = cp.id
      AND pp.completed_at IS NOT NULL
  ) cnt ON true
  WHERE cp.workspace_id = p_workspace_id
    AND cp.status = 'active'
    AND p.total_modules > 0
    AND cnt.n::double precision / NULLIF(p.total_modules, 0)::double precision >= p_ratio
    AND cnt.n < p.total_modules
    AND EXISTS (
      SELECT 1
      FROM public.coaches co
      WHERE co.user_id = auth.uid()
        AND co.user_id = p_coach_user_id
        AND co.workspace_id = p_workspace_id
    )
  ORDER BY (cnt.n::double precision / NULLIF(p.total_modules, 0)::double precision) DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_coach_near_complete_programs(uuid, uuid, double precision, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_near_complete_programs(uuid, uuid, double precision, int) TO authenticated;
