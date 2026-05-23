import { NextResponse, type NextRequest } from 'next/server'
import { createServerClientForMiddleware } from '@/lib/supabase-server'
import { logAuditEvent } from '@/lib/audit-log'
import { getUpstashRedis } from '@/lib/upstash-redis'

async function sha256Hex16(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const arr = Array.from(new Uint8Array(hash))
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

/**
 * User-agent only. Including IP caused false sign-outs: X-Forwarded-For is often missing on one hop
 * and present on the next (dev server, RSC, prefetch), so UA|"" vs UA|1.2.3.4 mismatched every time.
 */
async function fingerprintFromRequest(request: NextRequest): Promise<string> {
  const ua = request.headers.get('user-agent') ?? ''
  return sha256Hex16(ua)
}

type FingerprintPortal = 'coach' | 'client'

async function enforcePortalSessionFingerprint(
  request: NextRequest,
  userId: string,
  portal: FingerprintPortal,
  signInPath: '/login'
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') return null
  if (process.env.CLEARPATH_DISABLE_SESSION_FINGERPRINT === '1') return null

  const redis = await getUpstashRedis()
  if (!redis) return null

  const fp = await fingerprintFromRequest(request)
  const key = `session:fp:v3:${portal}:${userId}`
  try {
    const existing = await redis.get<string>(key)
    if (existing == null || existing === '') {
      await redis.set(key, fp, { ex: 86_400 })
      return null
    }
    if (existing === fp) return null

    void logAuditEvent(
      'suspicious_request',
      userId,
      null,
      { reason: 'session_fingerprint_mismatch', portal },
      request
    )

    const url = new URL(signInPath, request.url)
    url.searchParams.set('reason', 'session')
    const redirectRes = NextResponse.redirect(url)
    const supabase = createServerClientForMiddleware(request, redirectRes)
    await supabase.auth.signOut()
    return redirectRes
  } catch {
    return null
  }
}

/**
 * Coach /coach/* routes: bind first-seen UA hash in Redis (24h). Mismatch → sign out → /login?reason=session.
 * Skips when Redis is not configured, in development, or when CLEARPATH_DISABLE_SESSION_FINGERPRINT=1.
 */
export async function enforceCoachSessionFingerprint(
  request: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  return enforcePortalSessionFingerprint(request, userId, 'coach', '/login')
}

/**
 * Client /client/* routes: same behavior as coach; sign out → /login?reason=session
 * (DualRoleLoginPage handles both coach and client sign-in).
 */
export async function enforceClientSessionFingerprint(
  request: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  return enforcePortalSessionFingerprint(request, userId, 'client', '/login')
}
