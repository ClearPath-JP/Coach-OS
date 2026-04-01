-- Add is_super_admin to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- Set admin for your email
UPDATE public.profiles
  SET is_super_admin = true
  WHERE email = 'jpotesta15@outlook.com';

-- is_super_admin() function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin
     FROM public.profiles
     WHERE id = auth.uid()),
    false
  )
$$;

-- Allow super admin to read all workspaces
DROP POLICY IF EXISTS "admin_select_all_workspaces" ON public.workspaces;
CREATE POLICY "admin_select_all_workspaces"
  ON public.workspaces
  FOR SELECT
  USING (is_super_admin());

-- Allow super admin to read all coaches
DROP POLICY IF EXISTS "admin_select_all_coaches" ON public.coaches;
CREATE POLICY "admin_select_all_coaches"
  ON public.coaches
  FOR SELECT
  USING (is_super_admin());

-- Allow super admin to read all clients
DROP POLICY IF EXISTS "admin_select_all_clients" ON public.clients;
CREATE POLICY "admin_select_all_clients"
  ON public.clients
  FOR SELECT
  USING (is_super_admin());

-- Allow super admin to read all subscriptions
DROP POLICY IF EXISTS "admin_select_all_subs" ON public.subscriptions;
CREATE POLICY "admin_select_all_subs"
  ON public.subscriptions
  FOR SELECT
  USING (is_super_admin());
