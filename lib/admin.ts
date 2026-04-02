import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'

/** Admin API: `ADMIN_EMAIL` or `profiles.is_super_admin` (no in-app self-grant). */
export async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (!user || error) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  if (!(await isPlatformAdmin(supabase, user))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user }
}

/**
 * Use in admin API route handlers: rate limit + session + ADMIN_EMAIL check.
 * Returns NextResponse on failure, otherwise the authenticated admin user.
 */
export async function assertAdminApi(request: Request): Promise<NextResponse | User> {
  const limited = await enforceAdminApiRateLimit(request)
  if (limited) return limited
  const auth = await requireSuperAdmin()
  if ('error' in auth) return auth.error
  return auth.user
}

/** Rate limit admin mutating/read-heavy APIs: 120 req/min per IP. */
export async function enforceAdminApiRateLimit(request: Request | NextRequest): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const { success, retryAfter } = await checkRateLimitAsync(`admin-api:${ip}`, { windowMs: 60_000, max: 120 })
  if (success) return null
  const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
  return res
}

export async function logAdminAudit(params: {
  action: string
  userId: string
  workspaceId?: string | null
  request?: NextRequest | Request
  metadata?: Record<string, unknown>
}) {
  try {
    const service = createServiceClient()
    const ip =
      params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      params.request?.headers.get('x-real-ip') ??
      null
    const ua = params.request?.headers.get('user-agent') ?? null
    await service.from('audit_logs').insert({
      action: params.action,
      user_id: params.userId,
      workspace_id: params.workspaceId ?? null,
      ip_address: ip,
      user_agent: ua,
      metadata: params.metadata ?? {},
    })
  } catch {
    // Avoid failing request if audit logging fails.
  }
}
