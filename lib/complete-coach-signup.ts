import type { SupabaseClient, User } from '@supabase/supabase-js'

export type CompleteCoachSignupResult =
  | { ok: true; workspaceId: string; alreadyCompleted: boolean }
  | { ok: false; error: string; status: number }

/**
 * Create workspace, profile, and coach row for the given auth user (coach).
 * Idempotent if coach already exists.
 */
export async function completeCoachSignup(
  supabase: SupabaseClient,
  user: User
): Promise<CompleteCoachSignupResult> {
  const { data: existingCoach } = await supabase
    .from('coaches')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingCoach?.workspace_id) {
    return {
      ok: true,
      workspaceId: existingCoach.workspace_id,
      alreadyCompleted: true,
    }
  }

  // Paywall-first: workspaces are only created by Stripe activation
  // (lib/new-coach-activation.ts) after a completed checkout. A user with no coach
  // row here has NOT paid, so we do not mint a free workspace — we tell the caller to
  // send them to choose a plan. This stays idempotent for paid coaches: the early
  // return above hands back the workspace that activation already created.
  return {
    ok: false,
    error: 'Please choose a plan to finish setting up your workspace.',
    status: 402,
  }
}
