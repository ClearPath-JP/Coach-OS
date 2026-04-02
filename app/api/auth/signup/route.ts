import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { completeCoachSignup } from '@/lib/complete-coach-signup'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { signupSchema } from '@/lib/validations'

/**
 * POST /api/auth/signup — coach sign-up, workspace creation, session cookies.
 * Body: signupSchema (firstName, email, password, confirmPassword).
 */
export async function POST(request: Request) {
  try {
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

    if (signUpError) {
      const msg = 'Could not create account. Please try again.'
      const lower = msg.toLowerCase()
      if (
        lower.includes('already') ||
        lower.includes('registered') ||
        lower.includes('exists')
      ) {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    let sessionUser = signUpData.session?.user ?? null

    if (!signUpData.session && signUpData.user?.id && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      const service = createServiceClient()
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

    if (!sessionUser) {
      return NextResponse.json(
        {
          error:
            'Please confirm your email first, then sign in to continue. If email confirmation is disabled in Supabase, ensure SUPABASE_SERVICE_ROLE_KEY is set for local signup.',
        },
        { status: 401 }
      )
    }

    const { data: { user: freshUser } } = await supabase.auth.getUser()
    const u = freshUser ?? sessionUser
    const result = await completeCoachSignup(supabase, u)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      data: {
        redirect: '/onboarding',
        workspaceId: result.workspaceId,
        workspaceCreated: !result.alreadyCompleted,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again.' },
      { status: 500 }
    )
  }
}
