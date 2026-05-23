import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { signupSchema } from '@/lib/validations'

/**
 * POST /api/auth/signup — coach sign-up.
 * In dev or when no email provider is configured, auto-confirms and signs in.
 * In prod with RESEND_API_KEY set, requires email verification before sign-in.
 */
export async function POST(request: Request) {
  // Auto-confirm only when we can't send a verification email (dev or no Resend in prod)
  const shouldAutoConfirm =
    process.env.NODE_ENV === 'development' || !process.env.RESEND_API_KEY
  try {
    if (process.env.NODE_ENV !== 'development') {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'
      const { success, retryAfter } = await checkRateLimitAsync(`signup-api:${ip}`, {
        windowMs: 60 * 60 * 1000,
        max: 10,
      })
      if (!success) {
        const res = NextResponse.json(
          { error: 'Too many signup attempts. Please try again in an hour.' },
          { status: 429 },
        )
        if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
        return res
      }
    }

    const body = await request.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { email, password, firstName, lastName } = parsed.data
    const emailLower = email.trim().toLowerCase()
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    const supabase = await createClient()
    const service = createServiceClient()

    // Try normal signup first (works if email confirmation is disabled)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: emailLower,
      password,
      options: { data: { full_name: fullName } },
    })

    // If we got a session, great — we're done
    if (signUpData.session?.user) {
      return NextResponse.json({ data: { redirect: '/subscribe' } })
    }

    // Check for "already exists" errors
    if (signUpError) {
      const errMsg = (signUpError.message ?? '').toLowerCase()
      if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 400 },
        )
      }
    }

    // No session — email confirmation is required.
    // If we can't send a verification email, fall back to auto-confirm so signup isn't broken.
    if (!shouldAutoConfirm && signUpData.user?.id) {
      // Production with Resend: verification email already sent by Supabase. Tell user to check email.
      return NextResponse.json({
        data: {
          redirect: '/login?verify=1',
          message: 'Check your email to confirm your account, then sign in.',
        },
      })
    }
    if (signUpData.user?.id) {
      // Dev / no-Resend prod: auto-confirm and sign in
      await service.auth.admin.updateUserById(signUpData.user.id, {
        email_confirm: true,
      })
    } else if (signUpError) {
      // signUp failed entirely — create via admin API
      console.warn('[signup] signUp failed, using admin createUser:', signUpError.message)
      const { error: adminErr } = await service.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: shouldAutoConfirm,
        user_metadata: { full_name: fullName },
      })
      if (adminErr) {
        const adminLower = (adminErr.message ?? '').toLowerCase()
        if (adminLower.includes('already') || adminLower.includes('exists')) {
          return NextResponse.json(
            { error: 'An account with this email already exists.' },
            { status: 400 },
          )
        }
        console.error('[signup] admin createUser failed:', adminErr.message)
        return NextResponse.json(
          { error: 'Could not create account. Please try again.' },
          { status: 500 },
        )
      }
    }

    // Sign in to get a session
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password,
    })

    if (signInErr || !signInData.user) {
      console.error('[signup] signIn after create failed:', signInErr?.message)
      return NextResponse.json(
        { error: 'Account created but sign-in failed. Please go to login and sign in.' },
        { status: 200 },
      )
    }

    return NextResponse.json({ data: { redirect: '/subscribe' } })
  } catch (err) {
    console.error('[signup] unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again.' },
      { status: 500 },
    )
  }
}
