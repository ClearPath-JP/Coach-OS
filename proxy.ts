/**
 * Next.js 16+ middleware entry — this file is the edge middleware (do not add root `middleware.ts`; the
 * bundler rejects both). Default export + `config.matcher` are required.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { isPlatformAdmin } from '@/lib/platform-admin'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { enforceClientSessionFingerprint, enforceCoachSessionFingerprint } from '@/lib/session-fingerprint'
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
  '/privacy',
  '/terms',
] as const

const LEGAL_STATIC_PATHS = ['/privacy', '/terms'] as const

function isLegalStaticPath(p: string): boolean {
  return (LEGAL_STATIC_PATHS as readonly string[]).includes(p)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Root: anonymous visitors see the public landing page (app/page.tsx).
  // Authenticated users get sent to their portal.
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
    // Anonymous → serve the public landing page
    if (!user || authError) {
      return response
    }
    // Admin → admin overview
    if (await isPlatformAdmin(supabase, user)) {
      return NextResponse.redirect(new URL('/admin/overview', request.url))
    }
    // Coach or client → their respective portal
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role === 'coach') {
      return NextResponse.redirect(new URL('/coach/dashboard', request.url))
    }
    if (profile?.role === 'client') {
      return NextResponse.redirect(new URL('/client/portal', request.url))
    }
    return response
  }

  // Rate limit auth pages per IP (defense in depth with API route limits).
  // NOTE: These limits apply to every GET (page load, prefetch, redirect from /). Keep ceilings high
  // enough for normal use; brute-force protection for credentials lives on POST /api/auth/* (stricter).
  if (AUTH_PUBLIC_PATHS.includes(pathname as (typeof AUTH_PUBLIC_PATHS)[number])) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    if (!isLegalStaticPath(pathname)) {
      let key: string
      let windowMs: number
      let max: number
      if (pathname === '/login') {
        key = `auth-page-login:v2:${ip}`
        windowMs = 15 * 60_000
        max = 120
      } else if (pathname === '/signup') {
        key = `auth-page-signup:${ip}`
        windowMs = 60 * 60_000
        max = 30
      } else if (pathname === '/forgot-password') {
        key = `auth-page-forgot:${ip}`
        windowMs = 60 * 60_000
        max = 20
      } else {
        key = `auth-page:${ip}`
        windowMs = 60_000
        max = 300
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
      if (await isPlatformAdmin(supabase, user)) {
        return NextResponse.redirect(new URL('/admin/overview', request.url))
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

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
            return NextResponse.redirect(new URL('/coach/dashboard', request.url))
          }
          // Coach without workspace — send to subscribe to pick a plan
          return NextResponse.redirect(new URL('/subscribe', request.url))
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

  // /subscribe — authenticated users without a workspace pick a plan here
  if (pathname === '/subscribe') {
    const response = nextWithPathname(request)
    let supabase
    try {
      supabase = createServerClientForMiddleware(request, response)
    } catch (err) {
      if (isSupabaseNotConfigured(err)) return nextWithPathname(request)
      throw err
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.redirect(new URL('/login?next=/subscribe', request.url))
    }
    // If already has a workspace, go to dashboard
    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (workspaceId) {
      return NextResponse.redirect(new URL('/coach/dashboard', request.url))
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
    if (await isPlatformAdmin(supabase, user)) {
      return NextResponse.redirect(new URL('/admin/overview', request.url))
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.redirect(new URL('/client/portal', request.url))
    }
    const onboardingWorkspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    // Paywall-first: no workspace means checkout isn't finished — pick a plan first
    // (don't let /onboarding mint a free workspace).
    if (!onboardingWorkspaceId) {
      return NextResponse.redirect(new URL('/subscribe', request.url))
    }
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('completed_onboarding')
      .eq('id', onboardingWorkspaceId)
      .maybeSingle()
    if (workspace?.completed_onboarding) {
      return NextResponse.redirect(new URL('/coach/dashboard', request.url))
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
    if (!(await isPlatformAdmin(supabase, user))) {
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
    if (await isPlatformAdmin(supabase, user)) {
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
    // Coaches with a temporary password must set a new password first
    if (pathname.startsWith('/coach') && profile?.role === 'coach') {
      const mustChange = user.user_metadata?.must_change_password === true
      if (mustChange && pathname !== '/auth/set-password') {
        return NextResponse.redirect(new URL('/auth/set-password', request.url))
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

          // No subscription row. Workspace creation is now gated behind Stripe checkout
          // (paywall-first, see lib/complete-coach-signup.ts), so a row-less workspace
          // should only be a demo/seeded or legacy pre-Stripe account — allow rather than
          // lock those out.
          if (!sub) {
            // intentionally allow (demo / legacy)
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
    if (pathname.startsWith('/client') && profile?.role === 'client' && user) {
      const fpRes = await enforceClientSessionFingerprint(request, user.id)
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
    '/privacy',
    '/terms',
    '/subscribe',
    '/auth/set-password',
  ],
}
