-- Security hardening (Supabase advisor, security lints) — 2026-06-07
-- Non-breaking by design:
--   * get_coach_* RPCs already self-authorize via auth.uid() and are called by the app as
--     `authenticated` (grant preserved below). We only remove unauthenticated reachability.
--   * is_super_admin() / current_workspace_id() are intentionally left fully granted because
--     they are referenced inside RLS policies and must remain executable by anon+authenticated.
--   * Trigger functions never need a direct EXECUTE grant (the trigger fires regardless).

-- Lint 0011 (function_search_path_mutable): pin search_path on the 3 flagged functions.
alter function public.is_super_admin() set search_path = '';
alter function public.payments_set_updated_at() set search_path = '';
alter function public.client_goals_set_updated_at() set search_path = '';

-- Lint 0028 (anon can execute SECURITY DEFINER): remove anon/PUBLIC execute on data RPCs,
-- preserve authenticated (the app calls these as the signed-in coach).
revoke execute on function public.get_coach_conversations(uuid, uuid) from public, anon;
grant  execute on function public.get_coach_conversations(uuid, uuid) to authenticated;

revoke execute on function public.get_coach_near_complete_programs(uuid, uuid, double precision, integer) from public, anon;
grant  execute on function public.get_coach_near_complete_programs(uuid, uuid, double precision, integer) to authenticated;

revoke execute on function public.get_coach_reengagement_inactive_clients(uuid, uuid, timestamptz, integer) from public, anon;
grant  execute on function public.get_coach_reengagement_inactive_clients(uuid, uuid, timestamptz, integer) to authenticated;

revoke execute on function public.get_coach_stale_thread_clients(uuid, uuid, timestamptz, integer) from public, anon;
grant  execute on function public.get_coach_stale_thread_clients(uuid, uuid, timestamptz, integer) to authenticated;

revoke execute on function public.recalc_workspace_storage(uuid) from public, anon;
grant  execute on function public.recalc_workspace_storage(uuid) to authenticated;

-- Trigger-only functions: lock down fully.
revoke execute on function public.update_workspace_storage() from public, anon, authenticated;
revoke execute on function public.prevent_admin_self_grant() from public, anon, authenticated;
