/**
 * Next.js 16+ middleware entry — this file is the edge middleware (do not add root `middleware.ts`; the
 * bundler rejects both). Default export + `config.matcher` are required.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin-email'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { enforceCoachSessionFingerprint } from '@/lib/session-fingerprint'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createServerClientForMiddleware } from '@/lib/supabase-server'

function isSupabaseNotConfigured(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('Supabase is not configured') || msg.includes('URL and Key are required')
}

/** Forward pathname so server layouts can run backup guards (e.g. must_change_password). */
function nextWithPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

const AUTH_PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/signup',
  '/client-login',
  '/privacy',
  '/terms',
] as const

const LEGAL_STATIC_PATHS = ['/privacy', '/terms'] as const

function isLegalStaticPath(p: string): boolean {
  return (LEGAL_STATIC_PATHS as readonly string[]).includes(p)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Root: send guests to login immediately (same as app/page.tsx; avoids extra RSC work).
  if (pathname === '/' && request.method === 'GET') {
    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
      throw err
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Rate limit auth pages per IP (defense in depth with API route limits).
  if (AUTH_PUBLIC_PATHS.includes(pathname as (typeof AUTH_PUBLIC_PATHS)[number])) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    if (!isLegalStaticPath(pathname)) {
      let key: string
      let windowMs: number
      let max: number
      if (pathname === '/login' || pathname === '/client-login') {
        key = `auth-page-login:${ip}`
        windowMs = 15 * 60_000
        max = 5
      } else if (pathname === '/signup') {
        key = `auth-page-signup:${ip}`
        windowMs = 60 * 60_000
        max = 3
      } else if (pathname === '/forgot-password') {
        key = `auth-page-forgot:${ip}`
        windowMs = 60 * 60_000
        max = 3
      } else {
        key = `auth-page:${ip}`
        windowMs = 60_000
        max = 30
      }
      const { success, retryAfter } = await checkRateLimitAsync(key, { windowMs, max })
      if (!success) {
        const res = new NextResponse('Too Many Requests', { status: 429 })
        if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
        return res
      }
    } else {
      const { success, retryAfter } = await checkRateLimitAsync(`legal-page:${ip}`, { windowMs: 60_000, max: 120 })
      if (!success) {
        const res = new NextResponse('Too Many Requests', { status: 429 })
        if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
        return res
      }
    }

    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
      throw err
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      if (isAdminEmail(user.email)) {
        return NextResponse.redirect(new URL('/admin/overview', request.url))
      }

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
          const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
          if (workspaceId) {
            const { data: workspace } = await supabase
              .from('workspaces')
              .select('completed_onboarding')
              .eq('id', workspaceId)
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
    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
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
    if (isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL('/admin/overview', request.url))
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.redirect(new URL('/client/portal', request.url))
    }
    const onboardingWorkspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (onboardingWorkspaceId) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('completed_onboarding')
        .eq('id', onboardingWorkspaceId)
        .maybeSingle()
      if (workspace?.completed_onboarding) {
        return NextResponse.redirect(new URL('/coach/dashboard', request.url))
      }
    }
    return response
  }

  // /admin — only ADMIN_EMAIL; non-matching signed-in users get opaque 403 (no redirect to login).
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/not-authorized' || pathname.startsWith('/admin/not-authorized/')) {
      return nextWithPathname(request)
    }
    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
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
    if (!isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL('/admin/not-authorized', request.url))
    }
    return response
  }

  // Session check for /coach/*, /client/*, /billing — redirect to /login?next=pathname if no session
  if (pathname.startsWith('/coach') || pathname.startsWith('/client') || pathname === '/billing') {
    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
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
    if (isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL('/admin/overview', request.url))
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

    if (pathname.startsWith('/coach')) {
      if (profile?.role !== 'coach') {
        return NextResponse.redirect(new URL('/client/portal', request.url))
      }
    }
    if (pathname.startsWith('/client')) {
      if (profile?.role !== 'client') {
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
      const coachWorkspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
      if (coachWorkspaceId) {
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('completed_onboarding')
          .eq('id', coachWorkspaceId)
          .maybeSingle()
        if (!workspace?.completed_onboarding) {
          return NextResponse.redirect(new URL('/onboarding', request.url))
        }
        // Subscription check for /coach/* only (not /billing)
        if (pathname.startsWith('/coach')) {
          const { data: wsRow } = await supabase
            .from('workspaces')
            .select('status')
            .eq('id', coachWorkspaceId)
            .maybeSingle()
          if (wsRow?.status === 'suspended' && !pathname.startsWith('/coach/suspended')) {
            return NextResponse.redirect(new URL('/coach/suspended', request.url))
          }
          if (wsRow?.status !== 'suspended' && pathname.startsWith('/coach/suspended')) {
            return NextResponse.redirect(new URL('/coach/dashboard', request.url))
          }

          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status, trial_ends_at, current_period_end')
            .eq('workspace_id', coachWorkspaceId)
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
    '/',
    '/api/:path*',
    '/coach/:path*',
    '/client/:path*',
    '/admin',
    '/admin/:path*',
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
