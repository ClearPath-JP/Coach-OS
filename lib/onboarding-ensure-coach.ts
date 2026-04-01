import type { SupabaseClient, User } from '@supabase/supabase-js'
import { completeCoachSignup } from '@/lib/complete-coach-signup'

/**
 * Ensures the signed-in user has a coaches row + workspace (idempotent).
 * Used by onboarding API routes when signup-complete raced or failed client-side.
 */
export async function ensureCoachWorkspaceForOnboarding(
  supabase: SupabaseClient,
  user: User
): Promise<{ workspaceId: string } | { error: string; status: number }> {
  // One row per user is typical, but UNIQUE(user_id, workspace_id) allows several;
  // maybeSingle() errors when multiple rows exist — always pick a single row.
  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (coach?.workspace_id) {
    return { workspaceId: coach.workspace_id }
  }

  const result = await completeCoachSignup(supabase, user)
  if (!result.ok) {
    return { error: result.error, status: result.status }
  }

  return { workspaceId: result.workspaceId }
}
