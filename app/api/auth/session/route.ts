import { NextResponse } from 'next/server'
import { applyAuthNoStoreHeaders } from '@/lib/auth-response'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { z } from 'zod'

const sessionBodySchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
})

/**
 * POST /api/auth/session — set Supabase session from access + refresh tokens (server sets cookies).
 * Used by API integration tests and trusted server-to-server flows; rate limited.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return applyAuthNoStoreHeaders(NextResponse.json({ error: 'Not available' }, { status: 404 }))
  }
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`auth-session:${ip}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = applyAuthNoStoreHeaders(
        NextResponse.json(
          { error: 'Too many attempts — please wait a minute and try again' },
          { status: 429 }
        )
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = sessionBodySchema.safeParse(body)
    if (!parsed.success) {
      return applyAuthNoStoreHeaders(NextResponse.json({ error: 'Invalid request' }, { status: 400 }))
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.setSession({
      access_token: parsed.data.access_token,
      refresh_token: parsed.data.refresh_token,
    })
    if (error) {
      return applyAuthNoStoreHeaders(
        NextResponse.json(
          { error: 'Invalid session' },
          { status: 401 }
        )
      )
    }

    return applyAuthNoStoreHeaders(NextResponse.json({ data: 'ok' }))
  } catch {
    return applyAuthNoStoreHeaders(
      NextResponse.json(
        { error: 'Something went wrong — check your connection and try again' },
        { status: 500 }
      )
    )
  }
}
