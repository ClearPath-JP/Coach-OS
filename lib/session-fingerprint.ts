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

async function fingerprintFromRequest(request: NextRequest): Promise<string> {
  const ua = request.headers.get('user-agent') ?? ''
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    ''
  return sha256Hex16(`${ua}|${ip}`)
}

/**
 * Coach routes: bind first-seen UA+IP hash in Redis (24h). Mismatch → audit, sign out, redirect to login.
 * Skips when Redis is not configured (local dev).
 */
export async function enforceCoachSessionFingerprint(
  request: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  const redis = await getUpstashRedis()
  if (!redis) return null

  const fp = await fingerprintFromRequest(request)
  const key = `session:fp:${userId}`
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
      { reason: 'session_fingerprint_mismatch' },
      request
    )

    const redirectRes = NextResponse.redirect(new URL('/login?reason=session', request.url))
    const supabase = createServerClientForMiddleware(request, redirectRes)
    await supabase.auth.signOut()
    return redirectRes
  } catch {
    return null
  }
}
