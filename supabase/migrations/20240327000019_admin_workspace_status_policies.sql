-- Workspace lifecycle for admin suspend; extra super-admin read policies; prevent self-granting is_super_admin.

ALTER TABLE public.profiles
  ALTER COLUMN is_super_admin SET DEFAULT false;

UPDATE public.profiles SET is_super_admin = false WHERE is_super_admin IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN is_super_admin SET NOT NULL;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_status_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_status_check CHECK (status IN ('active', 'suspended'));

-- Super-admin read policies (RLS) — service role still used for admin APIs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'admin_read_all_payments'
  ) THEN
    CREATE POLICY "admin_read_all_payments"
    ON public.payments FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'admin_read_all_messages'
  ) THEN
    CREATE POLICY "admin_read_all_messages"
    ON public.messages FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'admin_read_all_sessions'
  ) THEN
    CREATE POLICY "admin_read_all_sessions"
    ON public.sessions FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'programs' AND policyname = 'admin_read_all_programs'
  ) THEN
    CREATE POLICY "admin_read_all_programs"
    ON public.programs FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'videos' AND policyname = 'admin_read_all_videos'
  ) THEN
    CREATE POLICY "admin_read_all_videos"
    ON public.videos FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'admin_read_all_audit_logs'
  ) THEN
    CREATE POLICY "admin_read_all_audit_logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_super_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_admin_self_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin = true AND COALESCE(OLD.is_super_admin, false) = false THEN
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Admin role cannot be self-granted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_admin_grant ON public.profiles;
CREATE TRIGGER prevent_admin_grant
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_admin_self_grant();
