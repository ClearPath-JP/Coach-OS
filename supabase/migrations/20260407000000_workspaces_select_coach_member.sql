-- Coaches linked via public.coaches must read their workspace row for onboarding flags,
-- subscription/suspend checks, and branding. Owner-only SELECT hid completed_onboarding from
-- team coaches and broke login redirect + middleware for non-owner coaches.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspaces'
      AND policyname = 'workspaces_select_if_coach_member'
  ) THEN
    CREATE POLICY "workspaces_select_if_coach_member"
      ON public.workspaces
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.coaches c
          WHERE c.workspace_id = workspaces.id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;
