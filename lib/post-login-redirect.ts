import 'server-only'

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isPlatformAdmin } from '@/lib/platform-admin'

/**
 * Same routing as `app/page.tsx` for an authenticated user: admin → /admin/overview,
 * coach → /coach/dashboard or /onboarding, else client portal.
 *
 * @param roleHint - when already loaded (e.g. login API), avoids an extra profiles read
 */
export async function getPostLoginRedirectPath(
  supabase: SupabaseClient,
  user: User,
  roleHint?: string | null
): Promise<string> {
  if (await isPlatformAdmin(supabase, user)) {
    return '/admin/overview'
  }

  let role = roleHint ?? undefined
  if (role == null) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    role = profile?.role ?? undefined
  }

  if (role === 'coach') {
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (coach?.workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('completed_onboarding')
        .eq('id', coach.workspace_id)
        .maybeSingle()
      if (workspace?.completed_onboarding) {
        return '/coach/dashboard'
      }
    }
    return '/onboarding'
  }

  return '/client/portal'
}
