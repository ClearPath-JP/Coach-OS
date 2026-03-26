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
    .maybeSingle()

  if (existingCoach?.workspace_id) {
    return {
      ok: true,
      workspaceId: existingCoach.workspace_id,
      alreadyCompleted: true,
    }
  }

  const firstName = (user.user_metadata?.full_name as string)?.trim() || 'Coach'
  const workspaceName = `${firstName}'s Workspace`
  const emailTrimmed = (user.email ?? '').trim().toLowerCase()

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, owner_id: user.id })
    .select('id')
    .single()

  if (workspaceError || !workspace?.id) {
    return {
      ok: false,
      error:
        workspaceError?.message ??
        'Could not create your workspace — please try again.',
      status: 500,
    }
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? emailTrimmed,
      full_name: firstName,
      role: 'coach',
      workspace_id: workspace.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profileError) {
    return {
      ok: false,
      error:
        profileError.message ?? 'Could not create your profile — please try again.',
      status: 500,
    }
  }

  const { error: coachError } = await supabase.from('coaches').insert({
    user_id: user.id,
    workspace_id: workspace.id,
    role: 'owner',
  })
  if (coachError) {
    return {
      ok: false,
      error: coachError.message ?? 'Could not link your account — please try again.',
      status: 500,
    }
  }

  return { ok: true, workspaceId: workspace.id, alreadyCompleted: false }
}
