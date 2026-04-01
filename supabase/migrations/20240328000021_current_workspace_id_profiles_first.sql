-- Prefer profiles.workspace_id so RLS matches the coach's canonical workspace (onboarding sets it).
-- Previously coaches LIMIT 1 could pick a different row than profiles.workspace_id, hiding coach_profiles etc.

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('app.workspace_id', true)::UUID,
    (SELECT p.workspace_id FROM public.profiles p WHERE p.id = auth.uid()),
    (SELECT c.workspace_id FROM public.coaches c WHERE c.user_id = auth.uid() ORDER BY c.created_at ASC LIMIT 1),
    (SELECT cl.workspace_id FROM public.clients cl
     JOIN public.profiles p ON p.id = auth.uid()
     WHERE cl.email = p.email AND cl.workspace_id IS NOT NULL
     LIMIT 1)
  );
$$;
