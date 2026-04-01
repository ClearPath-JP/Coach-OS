-- Internal notes visible only to super-admin (read/write via service role admin APIs).
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN public.workspaces.admin_notes IS 'Super-admin only; not exposed to coaches or clients.';
