import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Workspace the coach is operating in for this session.
 * Prefer profiles.workspace_id (canonical for onboarding); else oldest coaches row;
 * else a workspace owned by this user (covers missing coaches row / partial signup).
 */
export async function resolveCoachWorkspaceIdForSession(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.workspace_id) {
    return profile.workspace_id
  }

  const { data: coachRows } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  const fromCoach = coachRows?.[0]?.workspace_id
  if (fromCoach) return fromCoach

  const { data: ownedRows } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  return ownedRows?.[0]?.id ?? null
}

/**
 * Whether the signed-in user may act as coach for this workspace (API layer; keep in sync with clients RLS where possible).
 */
export async function coachHasWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  if (!workspaceId) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role !== 'coach') return false
  if (profile.workspace_id === workspaceId) return true

  const { data: coachRows } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .limit(1)

  if ((coachRows?.length ?? 0) > 0) return true

  const { data: owned } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .maybeSingle()

  return !!owned
}
