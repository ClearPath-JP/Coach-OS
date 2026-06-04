-- In-app /admin error feed: allow SERVER-side error rows in frontend_error_logs.
-- Server errors have no associated user (user_id) and use role='server'.
-- Owner: apply via the Supabase dashboard SQL editor or `supabase db push`.
-- UNTIL APPLIED, lib/log-server-error.ts no-ops safely (its insert is fail-silent), so
-- shipping the code before this migration is harmless — server errors simply won't be
-- recorded in-app yet (Sentry + Vercel logs still capture them).

ALTER TABLE public.frontend_error_logs ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.frontend_error_logs DROP CONSTRAINT IF EXISTS frontend_error_logs_role_check;
ALTER TABLE public.frontend_error_logs ADD CONSTRAINT frontend_error_logs_role_check
  CHECK (role IN ('coach', 'client', 'server'));
