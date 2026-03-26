import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { completeCoachSignup } from '@/lib/complete-coach-signup'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * POST /api/auth/signup-complete — create workspace, profile, coach for the current session user.
 * Called after client-side signUp(). Uses session only (anon key); RLS allows insert when owner_id/user_id = auth.uid().
 * Rate limit: 5 attempts per 15 minutes per IP.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`signup:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many signup attempts. Please try again in 15 minutes.' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Please confirm your email first, then sign in to continue.' },
        { status: 401 }
      )
    }

    const result = await completeCoachSignup(supabase, user)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again.' },
      { status: 500 }
    )
  }
}
