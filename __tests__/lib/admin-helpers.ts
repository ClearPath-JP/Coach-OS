import { createClient } from '@supabase/supabase-js'

/**
 * Set password for an auth user by email (service role). Used after invite for API tests.
 */
export async function setAuthUserPasswordByEmail(
  email: string,
  password: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return false

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: page, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) return false
  const u = page?.users?.find((x) => x.email?.toLowerCase() === email.toLowerCase())
  if (!u?.id) return false

  const { error } = await admin.auth.admin.updateUserById(u.id, { password })
  return !error
}
