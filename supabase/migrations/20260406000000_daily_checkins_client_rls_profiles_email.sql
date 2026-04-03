-- Fix client RLS on daily_checkins: avoid auth.users subqueries (can error under RLS)
-- and match client_rewards — profiles.email + case-insensitive clients.email.

DROP POLICY IF EXISTS "checkins_client_insert" ON public.daily_checkins;
DROP POLICY IF EXISTS "checkins_client_select" ON public.daily_checkins;

CREATE POLICY "checkins_client_insert"
  ON public.daily_checkins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = daily_checkins.client_id
        AND c.workspace_id = daily_checkins.workspace_id
        AND c.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(c.email)) = lower(trim(p.email))
    )
  );

CREATE POLICY "checkins_client_select"
  ON public.daily_checkins FOR SELECT
  USING (
    client_id = (
      SELECT c.id
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.email IS NOT NULL
        AND p.email IS NOT NULL
        AND lower(trim(c.email)) = lower(trim(p.email))
      LIMIT 1
    )
  );
