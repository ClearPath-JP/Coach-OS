import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/admin-email'

/**
 * Platform admin access: `ADMIN_EMAIL` matches the session email, or `profiles.is_super_admin`
 * (set only via service role / setup-admin — not self-grantable in app UI).
 */
export async function isPlatformAdmin(supabase: SupabaseClient, user: User): Promise<boolean> {
  if (isAdminEmail(user.email)) return true
  const { data } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle()
  return data?.is_super_admin === true
}
