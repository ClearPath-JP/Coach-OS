import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getClientId } from '@/lib/config'

export type SupabaseAuthCookieRow = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

/**
 * Align profiles.tenant_id with app client id for RLS (same logic as legacy createClient tail).
 */
export async function syncProfileTenantForSessionUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const clientId = getClientId()
  if (user && clientId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.tenant_id !== clientId) {
      await supabase.from('profiles').update({ tenant_id: clientId }).eq('id', user.id)
    }
  }
}

/**
 * Route Handlers that return `NextResponse.json()` must attach Supabase session cookies on that same
 * response. Mutating `cookies()` from `next/headers` does not always emit Set-Cookie on the JSON body
 * response in the App Router, so login appears to succeed but the browser never stores the session.
 */
export async function createRouteHandlerSupabase(cookieQueue: SupabaseAuthCookieRow[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const c of cookiesToSet) {
          const idx = cookieQueue.findIndex((x) => x.name === c.name)
          if (idx >= 0) cookieQueue[idx] = c
          else cookieQueue.push(c)
        }
      },
    },
  })
}

export function flushSupabaseAuthCookies(
  res: NextResponse,
  cookieQueue: readonly SupabaseAuthCookieRow[]
): NextResponse {
  for (const { name, value, options } of cookieQueue) {
    if (options !== undefined) {
      res.cookies.set(name, value, options)
    } else {
      res.cookies.set(name, value)
    }
  }
  return res
}

/**
 * Server Supabase client for Server Components, Server Actions, and API routes.
 * Uses next/headers cookies and syncs profiles.tenant_id for RLS.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local. See https://supabase.com/dashboard/project/_/settings/api'
    )
  }
  const cookieStore = await cookies()
  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components (e.g. during redirect)
          }
        },
      },
    }
  )

  await syncProfileTenantForSessionUser(supabase)

  return supabase
}

/**
 * Server client for middleware (edge). Pass request and response so cookies
 * can be read from the request and written to the response for session refresh.
 */
export function createServerClientForMiddleware(
  request: NextRequest,
  response: NextResponse
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
    )
  }
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
