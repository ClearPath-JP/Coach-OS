-- Align client_goals / client_goal_updates client SELECT RLS with client_rewards:
-- profiles + case-insensitive email (avoid auth.users subqueries).

DROP POLICY IF EXISTS "goals_client_select" ON public.client_goals;
DROP POLICY IF EXISTS "goal_updates_client_select" ON public.client_goal_updates;

CREATE POLICY "goals_client_select"
  ON public.client_goals FOR SELECT
  USING (
    client_id = (
      SELECT c.id
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(c.email)) = lower(trim(p.email))
        AND c.workspace_id = public.client_goals.workspace_id
      LIMIT 1
    )
  );

CREATE POLICY "goal_updates_client_select"
  ON public.client_goal_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_goals g
      WHERE g.id = client_goal_updates.goal_id
        AND g.client_id = (
          SELECT c.id
          FROM public.clients c
          JOIN public.profiles p ON p.id = auth.uid()
          WHERE c.email IS NOT NULL
            AND p.email IS NOT NULL
            AND lower(trim(c.email)) = lower(trim(p.email))
            AND c.workspace_id = g.workspace_id
          LIMIT 1
        )
    )
  );
