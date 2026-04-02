-- Single-query coach conversation list (replaces 4k-row scan + N per-client queries).
CREATE OR REPLACE FUNCTION public.get_coach_conversations(
  p_workspace_id uuid,
  p_coach_user_id uuid
)
RETURNS TABLE (
  client_id uuid,
  first_name text,
  last_name text,
  status text,
  unread_count bigint,
  last_message_at timestamptz,
  last_message_preview text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS client_id,
    c.first_name,
    c.last_name,
    c.status,
    COUNT(m.id) FILTER (
      WHERE m.read_at IS NULL
        AND m.recipient_id = p_coach_user_id
    )::bigint AS unread_count,
    MAX(m.created_at) AS last_message_at,
    (
      SELECT
        CASE
          WHEN m2.message_type = 'invoice' THEN 'Invoice'
          WHEN m2.message_type = 'session' THEN 'Session booking'
          ELSE LEFT(COALESCE(m2.content, ''), 200)
        END
      FROM public.messages m2
      WHERE m2.client_id = c.id
        AND m2.workspace_id = p_workspace_id
      ORDER BY m2.created_at DESC
      LIMIT 1
    ) AS last_message_preview
  FROM public.clients c
  LEFT JOIN public.messages m
    ON m.client_id = c.id
    AND m.workspace_id = c.workspace_id
  WHERE c.workspace_id = p_workspace_id
    AND c.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.coaches co
      WHERE co.user_id = auth.uid()
        AND co.user_id = p_coach_user_id
        AND co.workspace_id = p_workspace_id
    )
  GROUP BY c.id, c.first_name, c.last_name, c.status
  ORDER BY MAX(m.created_at) DESC NULLS LAST, c.first_name ASC NULLS LAST, c.last_name ASC NULLS LAST
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_coach_conversations(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_conversations(uuid, uuid) TO authenticated;
