import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { signupSchema } from '@/lib/validations'

/**
 * POST /api/auth/signup — coach sign-up, workspace creation, session cookies.
 * Body: signupSchema (firstName, email, password, confirmPassword).
 */
export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'
      const { success, retryAfter } = await checkRateLimitAsync(`signup-api:${ip}`, {
        windowMs: 60 * 60 * 1000,
        max: 3,
      })
      if (!success) {
        const res = NextResponse.json(
          { error: 'Too many signup attempts. Please try again in an hour.' },
          { status: 429 }
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
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: emailLower,
      password,
      options: { data: { full_name: fullName } },
    })

    let sessionUser = signUpData.session?.user ?? null

    if (signUpError || !signUpData.session) {
      const errMsg = (signUpError?.message ?? '').toLowerCase()
      const isAlreadyExists =
        errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')

      if (isAlreadyExists) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 400 }
        )
      }

      // Email confirmation is required or SMTP not configured.
      // Only bypass email confirmation if COACH_SIGNUP_SKIP_EMAIL_CONFIRM is explicitly set.
      // This prevents unverified emails from creating accounts in production.
      const allowBypass =
        !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
        process.env.COACH_SIGNUP_SKIP_EMAIL_CONFIRM === 'true'

      if (allowBypass) {
        const service = createServiceClient()

        if (signUpError) {
          console.warn('[signup] signUp error, attempting admin createUser bypass:', signUpError.message)
          const { error: adminErr } = await service.auth.admin.createUser({
            email: emailLower,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          })
          if (adminErr) {
            const adminLower = (adminErr.message ?? '').toLowerCase()
            if (adminLower.includes('already') || adminLower.includes('exists')) {
              return NextResponse.json(
                { error: 'An account with this email already exists.' },
                { status: 400 }
              )
            }
            console.error('[signup] admin createUser also failed:', adminErr.message)
            return NextResponse.json(
              { error: 'Could not create account. Please try again.' },
              { status: 400 }
            )
          }
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: emailLower,
            password,
          })
          if (!signInErr && signInData.user) {
            sessionUser = signInData.user
          }
        } else if (signUpData.user?.id) {
          const { error: confirmErr } = await service.auth.admin.updateUserById(signUpData.user.id, {
            email_confirm: true,
          })
          if (!confirmErr) {
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email: emailLower,
              password,
            })
            if (!signInErr && signInData.user) {
              sessionUser = signInData.user
            }
          }
        }
      } else if (signUpError) {
        console.error('[signup] Supabase signUp error:', signUpError.message)
        return NextResponse.json(
          { error: 'Could not create account. Please try again.' },
          { status: 400 }
        )
      }
    }

    if (!sessionUser) {
      console.error('[signup] No session after signup. Email confirmation may be required. SUPABASE_SERVICE_ROLE_KEY set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: 'Account created — please check your email to confirm, then sign in.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ data: { redirect: '/subscribe' } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again.' },
      { status: 500 }
    )
  }
}
