import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { enforceCoachSessionFingerprint } from '@/lib/session-fingerprint'
import { createServerClientForMiddleware } from '@/lib/supabase-server'

function isSupabaseNotConfigured(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('Supabase is not configured') || msg.includes('URL and Key are required')
}

const AUTH_PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/signup',
  '/client-login',
  '/privacy',
  '/terms',
] as const

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Rate limit auth pages: 30 requests/min per IP (11-auth-permissions §4.1)
  if (AUTH_PUBLIC_PATHS.includes(pathname as (typeof AUTH_PUBLIC_PATHS)[number])) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const { success, retryAfter } = await checkRateLimitAsync(`login:${ip}`, { windowMs: 60_000, max: 30 })
    if (!success) {
      const res = new NextResponse('Too Many Requests', { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const response = NextResponse.next({ request })
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return NextResponse.next({ request })
      throw err
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

      if (pathname === '/client-login') {
        if (profile?.role === 'client') {
          return NextResponse.redirect(new URL('/client/portal', request.url))
        }
        if (profile?.role === 'coach') {
          return NextResponse.redirect(new URL('/coach/dashboard', request.url))
        }
      }

      if (pathname === '/login' || pathname === '/signup') {
        if (profile?.role === 'client') {
          return NextResponse.redirect(new URL('/client/portal', request.url))
        }
        if (profile?.role === 'coach') {
          const { data: coach } = await supabase
            .from('coaches')
            .select('workspace_id')
            .eq('user_id', user.id)
            .maybeSingle()
          if (coach?.workspace_id) {
            const { data: workspace } = await supabase
              .from('workspaces')
              .select('completed_onboarding')
              .eq('id', coach.workspace_id)
              .maybeSingle()
            if (!workspace?.completed_onboarding) {
              return NextResponse.redirect(new URL('/onboarding', request.url))
            }
          }
          return NextResponse.redirect(new URL('/coach/dashboard', request.url))
        }
      }

      if (pathname === '/forgot-password') {
        if (profile?.role === 'client') {
          return NextResponse.redirect(new URL('/client/portal', request.url))
        }
        if (profile?.role === 'coach') {
          return NextResponse.redirect(new URL('/coach/dashboard', request.url))
        }
      }
    }
    return response
  }

  // /onboarding — authenticated coaches only; if completed_onboarding → /coach/dashboard
  if (pathname.startsWith('/onboarding')) {
    const response = NextResponse.next({ request })
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return NextResponse.next({ request })
      throw err
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (!user || authError) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.redirect(new URL('/client/portal', request.url))
    }
    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (coach?.workspace_id) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('completed_onboarding')
        .eq('id', coach.workspace_id)
        .maybeSingle()
      if (workspace?.completed_onboarding) {
        return NextResponse.redirect(new URL('/coach/dashboard', request.url))
      }
    }
    return response
  }

  // Session check for /coach/*, /client/*, /billing — redirect to /login?next=pathname if no session
  if (pathname.startsWith('/coach') || pathname.startsWith('/client') || pathname === '/billing') {
    const response = NextResponse.next({ request })
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return NextResponse.next({ request })
      throw err
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (!user || authError) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

    if (pathname.startsWith('/coach')) {
      if (profile?.role !== 'coach') {
        return NextResponse.redirect(new URL('/client/portal', request.url))
      }
    }
    if (pathname.startsWith('/client')) {
      if (profile?.role !== 'client' && profile?.role !== 'coach') {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    // /billing is coach-only; clients go to portal
    if (pathname === '/billing' && profile?.role !== 'coach') {
      return NextResponse.redirect(
        new URL(profile?.role === 'client' ? '/client/portal' : '/coach/dashboard', request.url)
      )
    }

    // Clients with a temporary password must set a new password before using the portal
    if (pathname.startsWith('/client') && profile?.role === 'client') {
      const mustChange = user.user_metadata?.must_change_password === true
      if (mustChange && !pathname.startsWith('/client/change-password')) {
        return NextResponse.redirect(new URL('/client/change-password', request.url))
      }
      if (!mustChange && pathname.startsWith('/client/change-password')) {
        return NextResponse.redirect(new URL('/client/portal', request.url))
      }
    }
    // Coach with incomplete onboarding → /onboarding
    if (profile?.role === 'coach') {
      const { data: coach } = await supabase
        .from('coaches')
        .select('workspace_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (coach?.workspace_id) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('completed_onboarding')
          .eq('id', coach.workspace_id)
          .maybeSingle()
        if (!workspace?.completed_onboarding) {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
        // Subscription check for /coach/* only (not /billing)
        if (pathname.startsWith('/coach')) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status, trial_ends_at, current_period_end')
            .eq('workspace_id', coach.workspace_id)
            .maybeSingle()

          // No row: coach is pre-Stripe or in implicit free trial — allow access until they subscribe via Stripe.
          if (!sub) {
            // intentionally allow
          } else {
            const now = Date.now()
            const trialActive =
              sub.trial_ends_at != null && new Date(sub.trial_ends_at).getTime() > now
            const statusAllows =
              sub.status === 'active' || sub.status === 'trialing' || trialActive

            if (statusAllows) {
              // allow
            } else if (sub.status === 'past_due') {
              return NextResponse.redirect(new URL('/billing?warning=subscription', request.url))
            } else if (
              sub.status === 'cancelled' &&
              sub.current_period_end &&
              new Date(sub.current_period_end).getTime() < now
            ) {
              return NextResponse.redirect(new URL('/billing?warning=subscription', request.url))
            }
            // paused, cancelled but still within paid period, etc. — allow
          }
        }
      }
    }
    if (pathname.startsWith('/coach') && profile?.role === 'coach' && user) {
      const fpRes = await enforceCoachSessionFingerprint(request, user.id)
      if (fpRes) return fpRes
    }
    return response
  }

  // /api/*: CORS and OPTIONS only; auth enforced per route (11-auth §4.1)
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next()
    const origin = request.headers.get('origin')
    const allowed = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.split(',').map((o) => o.trim()).filter(Boolean)
      : [request.nextUrl.origin]
    if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    return response
  }

  return NextResponse.next()
}

export default proxy

export const config = {
  matcher: [
    '/api/:path*',
    '/coach/:path*',
    '/client/:path*',
    '/billing',
    '/onboarding',
    '/onboarding/:path*',
    '/login',
    '/forgot-password',
    '/signup',
    '/client-login',
    '/privacy',
    '/terms',
  ],
}
