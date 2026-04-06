import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyAuthNoStoreHeaders } from '@/lib/auth-response'
import {
  createRouteHandlerSupabase,
  flushSupabaseAuthCookies,
  syncProfileTenantForSessionUser,
  type SupabaseAuthCookieRow,
} from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { logAuditEvent } from '@/lib/audit-log'
import { getPostLoginRedirectPath } from '@/lib/post-login-redirect'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { normalizeEmail } from '@/lib/utils'
import { loginSchema } from '@/lib/validations'

const bodySchema = loginSchema.extend({
  /** coach | client = strict; auto = any role, client should land on / then /client/portal */
  intent: z.enum(['coach', 'client', 'auto']),
})

/**
 * POST /api/auth/login — server-side sign-in (sets cookies), audit log, no-store headers.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const { success, retryAfter } = await checkRateLimitAsync(`auth-login-api:${ip}`, {
    windowMs: 15 * 60_000,
    max: 5,
  })
  if (!success) {
    const res = applyAuthNoStoreHeaders(
      NextResponse.json(
        { error: 'Too many attempts — please wait fifteen minutes and try again' },
        { status: 429 }
      )
    )
    if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
    return res
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return applyAuthNoStoreHeaders(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return applyAuthNoStoreHeaders(
      NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    )
  }

  const { email, password, intent } = parsed.data
  const authCookieQueue: SupabaseAuthCookieRow[] = []
  let supabase
  try {
    supabase = await createRouteHandlerSupabase(authCookieQueue)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('Supabase is not configured')) {
      return applyAuthNoStoreHeaders(
        NextResponse.json({ error: 'Server configuration error — Supabase is not configured.' }, { status: 503 })
      )
    }
    throw err
  }

  const wrap = (res: NextResponse) => flushSupabaseAuthCookies(applyAuthNoStoreHeaders(res), authCookieQueue)

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    void logAuditEvent('login_failed', null, null, { intent, email: normalizeEmail(email) }, request)
    return wrap(NextResponse.json({ error: 'Invalid email or password. Please try again.' }, { status: 401 }))
  }

  await syncProfileTenantForSessionUser(supabase)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
  const role = profile?.role

  const adminBypassCoachTab = await isPlatformAdmin(supabase, data.user)
  if (intent === 'coach' && role !== 'coach' && !adminBypassCoachTab) {
    await supabase.auth.signOut()
    void logAuditEvent('login_failed', data.user.id, null, { intent, reason: 'wrong_role' }, request)
    return wrap(
      NextResponse.json(
        {
          error:
            'This account is not a coach account. Client? Use “Client sign-in” below or /client-login.',
        },
        { status: 403 }
      )
    )
  }

  if (intent === 'client' && role !== 'client') {
    await supabase.auth.signOut()
    void logAuditEvent('login_failed', data.user.id, null, { intent, reason: 'wrong_role' }, request)
    return wrap(
      NextResponse.json(
        {
          error:
            'This account is not a client portal account. Coach? Use the coach sign-in link on that page.',
        },
        { status: 403 }
      )
    )
  }

  let workspaceId: string | null = null
  if (role === 'coach') {
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', data.user.id)
      .maybeSingle()
    workspaceId = coach?.workspace_id ?? null
  } else if (role === 'client') {
    const { data: client } = await supabase
      .from('clients')
      .select('workspace_id')
      .eq('email', normalizeEmail(data.user.email))
      .maybeSingle()
    workspaceId = client?.workspace_id ?? null
  }

  void logAuditEvent('login', data.user.id, workspaceId, { intent, role }, request)

  let redirect: string
  try {
    redirect = await getPostLoginRedirectPath(supabase, data.user, role)
  } catch {
    redirect = '/'
  }

  return wrap(
    NextResponse.json({
      data: { ok: true, role, redirect },
    })
  )
}
